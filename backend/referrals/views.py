"""Referral API views."""
from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from accounts.permissions import HasReferralObjectAccess, IsReferralParticipant
from config.exceptions import InvalidStateTransition, invalid_transition_response
from facilities.models import AvailabilityUpdate, Facility, FacilityCapability
from referrals.verification import has_blocking_open_findings, run_deterministic_checks

from .models import (
    AcceptanceRecord,
    AuditEvent,
    Clarification,
    ClinicalObservation,
    ClinicianApproval,
    FacilityMatch,
    ReferralCase,
    ReferralDraft,
    ReferralFinding,
    ReferralStatus,
    ResolutionState,
    TimelineEvent,
    TreatmentEvent,
)
from .serializers import (
    AcceptanceRecordSerializer,
    ClarificationResponseSerializer,
    ClarificationSerializer,
    ClinicalObservationSerializer,
    ClinicianApprovalSerializer,
    FacilityMatchSerializer,
    IncompleteExportSerializer,
    ReferralCaseCreateSerializer,
    ReferralCaseSerializer,
    ReferralCaseUpdateSerializer,
    ReferralDraftSerializer,
    ReferralFindingSerializer,
    ResolveFindingSerializer,
    TimelineEventSerializer,
    TreatmentEventSerializer,
)


class AnalysisThrottle(UserRateThrottle):
    rate = "20/min"


class ReferralViewSet(viewsets.ModelViewSet):
    permission_classes = [IsReferralParticipant, HasReferralObjectAccess]
    filterset_fields = ["status", "urgency", "creating_facility", "is_evaluation_case"]
    search_fields = ["synthetic_case_id", "referral_reason", "patient_display_label"]
    ordering_fields = ["updated_at", "created_at", "status"]

    def get_queryset(self):
        from django.db.models import Q

        qs = ReferralCase.objects.select_related(
            "creating_facility", "created_by", "assigned_reviewer"
        ).prefetch_related("observations", "treatments", "findings")
        user = self.request.user
        if user.is_super_admin:
            return qs
        filters = Q(created_by=user)
        if user.facility_id:
            filters |= Q(creating_facility_id=user.facility_id)
            filters |= Q(facility_matches__facility_id=user.facility_id)
            filters |= Q(acceptances__facility_id=user.facility_id)
        return qs.filter(filters).distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return ReferralCaseCreateSerializer
        if self.action in ("update", "partial_update"):
            return ReferralCaseUpdateSerializer
        return ReferralCaseSerializer

    def partial_update(self, request, *args, **kwargs):
        referral = self.get_object()
        if referral.status == ReferralStatus.ACCEPTED:
            raise ValidationError("Cannot edit a referral after acceptance.")
        serializer = self.get_serializer(referral, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if referral.fully_verified or ClinicianApproval.objects.filter(referral=referral).exists():
            ClinicianApproval.objects.filter(referral=referral).delete()
            referral.fully_verified = False
            referral.save(update_fields=["fully_verified", "updated_at"])
        AuditEvent.objects.create(
            actor=request.user,
            action="referral.update",
            object_type="ReferralCase",
            object_id=str(referral.id),
            after_summary="clinical fields updated",
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        referral.refresh_from_db()
        return Response(ReferralCaseSerializer(referral).data)

    def perform_create(self, serializer):
        case = serializer.save(created_by=self.request.user)
        doc_status = self.request.data.get("documentation_status") or {}
        if isinstance(doc_status, dict) and doc_status:
            ReferralDraft.objects.create(
                referral=case,
                version=1,
                structured_content={"documentation_status": doc_status},
                narrative="",
                submitted_at=timezone.now(),
            )
        TimelineEvent.objects.create(
            referral=case,
            event_type="CREATED",
            occurred_at=timezone.now(),
            source="clinician",
            display_text="Referral case created",
            actor=self.request.user,
        )
        AuditEvent.objects.create(
            actor=self.request.user,
            action="referral.create",
            object_type="ReferralCase",
            object_id=str(case.id),
            after_summary=case.synthetic_case_id,
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        case = serializer.instance
        return Response(ReferralCaseSerializer(case).data, status=201)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)
        return Response(ReferralCaseSerializer(instance).data)

    @action(detail=True, methods=["post"], throttle_classes=[AnalysisThrottle])
    def analyse(self, request, pk=None):
        """Start deterministic analysis (+ agent hook). Does not hold DB txn during LLM."""
        referral = self.get_object()

        # Allow saving an edited referral reason in the same request (demo UX).
        incoming_reason = request.data.get("referral_reason")
        if isinstance(incoming_reason, str):
            trimmed = incoming_reason.strip()
            if trimmed and trimmed != (referral.referral_reason or "").strip():
                if referral.status == ReferralStatus.ACCEPTED:
                    raise ValidationError("Cannot edit a referral after acceptance.")
                referral.referral_reason = trimmed
                referral.save(update_fields=["referral_reason", "updated_at"])
                AuditEvent.objects.create(
                    actor=request.user,
                    action="referral.update",
                    object_type="ReferralCase",
                    object_id=str(referral.id),
                    after_summary="referral_reason updated via analyse",
                    ip_address=request.META.get("REMOTE_ADDR"),
                )

        try:
            if referral.status == ReferralStatus.DRAFT:
                referral.transition_to(ReferralStatus.ANALYSING, actor=request.user)
            elif referral.status in {
                ReferralStatus.NEEDS_CLARIFICATION,
                ReferralStatus.ANALYSING,
            }:
                # Explicit retry path: reset to ANALYSING if needed
                if referral.status != ReferralStatus.ANALYSING:
                    referral.transition_to(ReferralStatus.ANALYSING, actor=request.user)
            else:
                raise InvalidStateTransition(
                    f"Cannot start analysis from {referral.status}.",
                    from_status=referral.status,
                    to_status=ReferralStatus.ANALYSING,
                )
        except InvalidStateTransition as exc:
            return invalid_transition_response(exc)

        # Clear prior open deterministic findings for re-run (keep resolved history lightly)
        referral.findings.filter(
            deterministic=True, resolution_state=ResolutionState.OPEN
        ).delete()

        # Deterministic checks outside long-lived write txn for LLM (LLM added later)
        referral.refresh_from_db()
        findings = run_deterministic_checks(referral)

        # Optional agent pipeline (imported lazily). Never silently swap providers.
        agent_summary = None
        try:
            from django.conf import settings as dj_settings

            from agents.pipeline import run_verification_pipeline

            mode = (dj_settings.LLM_PROVIDER or "mock").lower()
            agent_summary = run_verification_pipeline(referral, mode=mode)
        except Exception as exc:  # noqa: BLE001 — surface failure without crashing API
            agent_summary = {"status": "failed", "error": str(exc)[:500]}

        referral.refresh_from_db()
        if has_blocking_open_findings(referral):
            referral.transition_to(
                ReferralStatus.NEEDS_CLARIFICATION,
                actor=request.user,
                note="blocking findings open",
            )
        else:
            referral.transition_to(
                ReferralStatus.READY_FOR_MATCHING,
                actor=request.user,
                note="no blocking findings",
            )

        referral.refresh_from_db()
        return Response(
            {
                "referral": ReferralCaseSerializer(referral).data,
                "findings_created": len(findings),
                "agent": agent_summary,
                "next_step": (
                    "match_facilities"
                    if referral.status == ReferralStatus.READY_FOR_MATCHING
                    else "resolve_findings"
                ),
                "disclaimer": (
                    "Hackathon prototype — synthetic data — not for clinical use. "
                    "Documentation readiness is not medical clearance."
                ),
            }
        )

    @action(detail=True, methods=["get"])
    def readiness(self, request, pk=None):
        referral = self.get_object()
        open_critical = referral.findings.filter(
            resolution_state=ResolutionState.OPEN,
            severity__in=["CRITICAL", "MAJOR"],
        ).count()
        has_approval = ClinicianApproval.objects.filter(referral=referral).exists()
        return Response(
            {
                "synthetic_case_id": referral.synthetic_case_id,
                "status": referral.status,
                "fully_verified": referral.fully_verified,
                "blocking_open_findings": open_critical,
                "ready_for_verified_label": open_critical == 0 and has_approval,
                "incomplete_export_available": True,
                "disclaimer": (
                    "Documentation readiness is NOT medical clearance. "
                    "Blocking applies only to the fully verified handoff label."
                ),
            }
        )

    @action(detail=True, methods=["post"], url_path="export-incomplete")
    def export_incomplete(self, request, pk=None):
        referral = self.get_object()
        ser = IncompleteExportSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        open_findings = list(
            referral.findings.filter(resolution_state=ResolutionState.OPEN)
        )
        referral.incomplete_export_reason = ser.validated_data["reason"]
        referral.incomplete_exported_at = timezone.now()
        referral.incomplete_exported_by = request.user
        referral.fully_verified = False
        referral.save(
            update_fields=[
                "incomplete_export_reason",
                "incomplete_exported_at",
                "incomplete_exported_by",
                "fully_verified",
                "updated_at",
            ]
        )
        for f in open_findings:
            f.resolution_state = ResolutionState.WAIVED_INCOMPLETE_EXPORT
            f.save(update_fields=["resolution_state"])
        AuditEvent.objects.create(
            actor=request.user,
            action="referral.export_incomplete",
            object_type="ReferralCase",
            object_id=str(referral.id),
            after_summary=ser.validated_data["reason"][:500],
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        TimelineEvent.objects.create(
            referral=referral,
            event_type="INCOMPLETE_EXPORT",
            occurred_at=timezone.now(),
            source="clinician",
            display_text="Incomplete emergency handoff exported (unverified)",
            actor=request.user,
        )
        return Response(
            {
                "fully_verified": False,
                "unresolved_findings": ReferralFindingSerializer(open_findings, many=True).data,
                "reason": referral.incomplete_export_reason,
                "exported_at": referral.incomplete_exported_at,
                "disclaimer": "Incomplete export does NOT mark missing facts as verified.",
            }
        )

    @action(detail=True, methods=["get", "post"])
    def drafts(self, request, pk=None):
        referral = self.get_object()
        if request.method == "GET":
            return Response(
                ReferralDraftSerializer(referral.drafts.all(), many=True).data
            )
        latest = referral.drafts.order_by("-version").first()
        version = (latest.version + 1) if latest else 1
        draft = ReferralDraft.objects.create(
            referral=referral,
            version=version,
            structured_content=request.data.get("structured_content") or {},
            narrative=request.data.get("narrative") or "",
            submitted_at=timezone.now(),
        )
        return Response(ReferralDraftSerializer(draft).data, status=201)

    @action(detail=True, methods=["get", "post"])
    def observations(self, request, pk=None):
        referral = self.get_object()
        if request.method == "GET":
            return Response(
                ClinicalObservationSerializer(referral.observations.all(), many=True).data
            )
        ser = ClinicalObservationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obs = ClinicalObservation.objects.create(referral=referral, **ser.validated_data)
        return Response(ClinicalObservationSerializer(obs).data, status=201)

    @action(detail=True, methods=["get", "post"])
    def treatments(self, request, pk=None):
        referral = self.get_object()
        if request.method == "GET":
            return Response(
                TreatmentEventSerializer(referral.treatments.all(), many=True).data
            )
        ser = TreatmentEventSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        tx = TreatmentEvent.objects.create(referral=referral, **ser.validated_data)
        return Response(TreatmentEventSerializer(tx).data, status=201)

    @action(detail=True, methods=["get"])
    def findings(self, request, pk=None):
        referral = self.get_object()
        return Response(
            ReferralFindingSerializer(referral.findings.all(), many=True).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path=r"findings/(?P<finding_id>[^/.]+)/resolve",
    )
    def resolve_finding(self, request, pk=None, finding_id=None):
        referral = self.get_object()
        try:
            finding = referral.findings.get(pk=finding_id)
        except ReferralFinding.DoesNotExist as exc:
            raise ValidationError("Finding not found.") from exc
        ser = ResolveFindingSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        before = finding.resolution_state
        finding.resolution_state = ser.validated_data["resolution_state"]
        finding.resolution_note = ser.validated_data.get("resolution_note", "")
        finding.resolved_by = request.user
        finding.resolved_at = timezone.now()
        finding.save()
        blocking_open = has_blocking_open_findings(referral)
        workflow_hint = None
        if referral.status == ReferralStatus.NEEDS_CLARIFICATION and not blocking_open:
            workflow_hint = (
                "All critical/major findings are reviewed. "
                "Click Run analysis to re-check documentation and advance the workflow."
            )
        elif finding.resolution_state in {
            ResolutionState.RESOLVED,
            ResolutionState.ACCEPTED_RISK,
        }:
            workflow_hint = (
                "Finding resolution recorded. This does not edit referral clinical fields — "
                "update the referral reason in Clinical summary if needed, then Run analysis."
            )
        AuditEvent.objects.create(
            actor=request.user,
            action="finding.resolve",
            object_type="ReferralFinding",
            object_id=str(finding.id),
            before_summary=before,
            after_summary=f"{finding.resolution_state}: {finding.resolution_note[:200]}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        payload = ReferralFindingSerializer(finding).data
        if workflow_hint:
            payload = {**payload, "workflow_hint": workflow_hint}
        return Response(payload)

    @action(detail=False, methods=["get"], url_path="dashboard-summary")
    def dashboard_summary(self, request):
        """Persisted counts for authorised referrals (not hardcoded UI metrics)."""
        qs = self.get_queryset()
        return Response(
            {
                "total": qs.count(),
                "needs_attention": qs.filter(
                    status__in=[
                        ReferralStatus.DRAFT,
                        ReferralStatus.ANALYSING,
                        ReferralStatus.NEEDS_CLARIFICATION,
                    ]
                ).count(),
                "emergency": qs.filter(urgency="EMERGENCY").count(),
                "fully_verified": qs.filter(fully_verified=True).count(),
                "disclaimer": (
                    "Counts reflect authorised synthetic records only. "
                    "Fully verified is documentation readiness, not medical clearance."
                ),
            }
        )

    @action(detail=True, methods=["get", "post"])
    def clarifications(self, request, pk=None):
        referral = self.get_object()
        if request.method == "GET":
            return Response(
                ClarificationSerializer(referral.clarifications.all(), many=True).data
            )
        q = request.data.get("question")
        if not q:
            raise ValidationError({"question": "Required."})
        c = Clarification.objects.create(referral=referral, question=q)
        return Response(ClarificationSerializer(c).data, status=201)

    @action(
        detail=True,
        methods=["post"],
        url_path=r"clarifications/(?P<clarification_id>[^/.]+)/respond",
    )
    def respond_clarification(self, request, pk=None, clarification_id=None):
        referral = self.get_object()
        try:
            item = referral.clarifications.get(pk=clarification_id)
        except Clarification.DoesNotExist as exc:
            raise ValidationError("Clarification not found.") from exc
        ser = ClarificationResponseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        item.clinician_response = ser.validated_data["clinician_response"]
        item.status = Clarification.Status.ANSWERED
        item.resolved_by = request.user
        item.resolved_at = timezone.now()
        item.save()
        return Response(ClarificationSerializer(item).data)

    @action(detail=True, methods=["post"], url_path="match-facilities")
    def match_facilities(self, request, pk=None):
        referral = self.get_object()
        if referral.status not in {
            ReferralStatus.READY_FOR_MATCHING,
            ReferralStatus.AWAITING_ACCEPTANCE,
        }:
            return invalid_transition_response(
                InvalidStateTransition(
                    f"Matching not allowed from {referral.status}.",
                    from_status=referral.status,
                    to_status=ReferralStatus.AWAITING_ACCEPTANCE,
                )
            )
        needs = referral.clinician_confirmed_needs or []
        if not needs:
            raise ValidationError(
                "Clinician-confirmed capability needs are required before matching."
            )

        referral.facility_matches.all().delete()
        matches = []
        now = timezone.now()
        for rank, facility in enumerate(
            Facility.objects.filter(is_active=True).order_by("name"), start=1
        ):
            coverage = {}
            freshness_flags = []
            for code in needs:
                fc = FacilityCapability.objects.filter(
                    facility=facility, capability__code=code
                ).first()
                if not fc:
                    coverage[code] = {"present": False, "state": "UNKNOWN", "fresh": False}
                    freshness_flags.append("missing")
                    continue
                latest = (
                    AvailabilityUpdate.objects.filter(facility_capability=fc)
                    .order_by("-confirmed_at")
                    .first()
                )
                fresh = bool(latest and latest.expires_at > now)
                coverage[code] = {
                    "present": True,
                    "state": fc.availability_state,
                    "fresh": fresh,
                    "expires_at": latest.expires_at.isoformat() if latest else None,
                }
                freshness_flags.append("fresh" if fresh else "stale")
            overall = (
                "fresh"
                if freshness_flags and all(f == "fresh" for f in freshness_flags)
                else "stale_or_incomplete"
            )
            # Haversine-lite synthetic distance from creating facility
            dist = _approx_km(
                referral.creating_facility.latitude,
                referral.creating_facility.longitude,
                facility.latitude,
                facility.longitude,
            )
            covered = sum(1 for v in coverage.values() if v.get("present"))
            explanation = (
                f"Synthetic match: {covered}/{len(needs)} clinician-confirmed capabilities. "
                f"Availability freshness: {overall}. Stale capacity is NOT treated as confirmed. "
                "Automatic acceptance is never performed."
            )
            matches.append(
                FacilityMatch(
                    referral=referral,
                    facility=facility,
                    capability_coverage=coverage,
                    distance_km=round(dist, 1),
                    availability_freshness=overall,
                    explanation=explanation,
                    rank=rank,
                )
            )
        # Rank by coverage then distance
        matches.sort(
            key=lambda m: (
                -sum(1 for v in m.capability_coverage.values() if v.get("present") and v.get("fresh")),
                m.distance_km or 9999,
            )
        )
        for i, m in enumerate(matches, start=1):
            m.rank = i
        FacilityMatch.objects.bulk_create(matches)
        if referral.status == ReferralStatus.READY_FOR_MATCHING:
            referral.transition_to(
                ReferralStatus.AWAITING_ACCEPTANCE, actor=request.user
            )
        return Response(FacilityMatchSerializer(matches, many=True).data)

    @action(detail=True, methods=["get"])
    def matches(self, request, pk=None):
        referral = self.get_object()
        return Response(
            FacilityMatchSerializer(referral.facility_matches.all(), many=True).data
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        referral = self.get_object()
        if referral.status != ReferralStatus.AWAITING_ACCEPTANCE:
            raise ValidationError(
                "Clinician approval is allowed only after facility matching "
                "(status: Awaiting acceptance)."
            )
        if not referral.facility_matches.exists():
            raise ValidationError(
                "Run facility matching before recording clinician approval."
            )
        if has_blocking_open_findings(referral):
            raise ValidationError(
                "Cannot fully approve while critical/major findings remain open. "
                "Resolve findings or use incomplete emergency export."
            )
        if ClinicianApproval.objects.filter(referral=referral).exists():
            raise ValidationError("Clinician approval already recorded.")
        approval = ClinicianApproval.objects.create(
            referral=referral,
            approved_by=request.user,
            approved_at=timezone.now(),
            attestation=request.data.get("attestation")
            or ClinicianApproval._meta.get_field("attestation").default,
            workflow_version_at_approval=referral.workflow_version,
        )
        referral.fully_verified = True
        referral.save(update_fields=["fully_verified", "updated_at"])
        AuditEvent.objects.create(
            actor=request.user,
            action="referral.clinician_approve",
            object_type="ReferralCase",
            object_id=str(referral.id),
            after_summary=f"workflow_version={referral.workflow_version}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        return Response(ClinicianApprovalSerializer(approval).data, status=201)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        referral = self.get_object()
        if referral.status != ReferralStatus.AWAITING_ACCEPTANCE:
            return invalid_transition_response(
                InvalidStateTransition(
                    f"Acceptance not allowed from {referral.status}.",
                    from_status=referral.status,
                    to_status=ReferralStatus.ACCEPTED,
                )
            )
        if not ClinicianApproval.objects.filter(referral=referral).exists():
            raise ValidationError(
                "Clinician approval is required before recording facility acceptance."
            )
        ser = AcceptanceRecordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        facility = ser.validated_data["facility"]
        decision = ser.validated_data["decision"]
        token = f"{referral.id}:{facility.id}:{referral.workflow_version}"
        try:
            with transaction.atomic():
                record = AcceptanceRecord.objects.create(
                    referral=referral,
                    facility=facility,
                    decision=decision,
                    confirmer_role=request.user.role,
                    confirmed_by=request.user,
                    confirmed_at=timezone.now(),
                    reference=ser.validated_data.get("reference", ""),
                    instructions=ser.validated_data.get("instructions", ""),
                    approval_token=token,
                )
                if decision == AcceptanceRecord.Decision.ACCEPTED:
                    ok = referral.conditional_transition(
                        expected_version=referral.workflow_version,
                        expected_status=ReferralStatus.AWAITING_ACCEPTANCE,
                        new_status=ReferralStatus.ACCEPTED,
                        actor=request.user,
                    )
                    if not ok:
                        raise ValidationError("Concurrent update — refresh and retry.")
        except IntegrityError as exc:
            raise ValidationError(
                "Duplicate acceptance prevented for this workflow version."
            ) from exc
        except InvalidStateTransition as exc:
            return invalid_transition_response(exc)
        return Response(AcceptanceRecordSerializer(record).data, status=201)

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        referral = self.get_object()
        return Response(
            TimelineEventSerializer(referral.timeline_events.all(), many=True).data
        )

    @action(detail=True, methods=["get"], url_path="handoff")
    def handoff(self, request, pk=None):
        referral = self.get_object()
        approval = None
        try:
            approval = referral.clinician_approval
        except ClinicianApproval.DoesNotExist:
            approval = None
        acceptance = referral.acceptances.order_by("-confirmed_at").first()
        top_match = referral.facility_matches.order_by("rank").first()
        open_findings = referral.findings.filter(resolution_state="OPEN")
        return Response(
            {
                "synthetic_case_id": referral.synthetic_case_id,
                "patient_display_label": referral.patient_display_label,
                "urgency": referral.urgency,
                "status": referral.status,
                "fully_verified": referral.fully_verified,
                "referral_reason": referral.referral_reason,
                "gestational_age_weeks": referral.gestational_age_weeks,
                "gravida": referral.gravida,
                "para": referral.para,
                "creating_facility": referral.creating_facility.name,
                "clinician_confirmed_needs": referral.clinician_confirmed_needs,
                "incomplete_export_reason": referral.incomplete_export_reason,
                "incomplete_exported_at": referral.incomplete_exported_at,
                "clinician_approval": (
                    ClinicianApprovalSerializer(approval).data if approval else None
                ),
                "acceptance": (
                    AcceptanceRecordSerializer(acceptance).data if acceptance else None
                ),
                "top_match": (
                    FacilityMatchSerializer(top_match).data if top_match else None
                ),
                "findings": ReferralFindingSerializer(
                    referral.findings.all(), many=True
                ).data,
                "open_finding_count": open_findings.count(),
                "observations": ClinicalObservationSerializer(
                    referral.observations.all(), many=True
                ).data,
                "treatments": TreatmentEventSerializer(
                    referral.treatments.all(), many=True
                ).data,
                "generated_at": timezone.now().isoformat(),
                "disclaimer": (
                    "Hackathon prototype — synthetic data — not for clinical use. "
                    "Human review required. Documentation readiness is not medical clearance."
                ),
            }
        )


def _approx_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Equirectangular approximation sufficient for synthetic demo distances
    import math

    x = math.radians(lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2))
    y = math.radians(lat2 - lat1)
    return 6371.0 * math.sqrt(x * x + y * y)
