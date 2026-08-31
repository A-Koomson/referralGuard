"""Referral domain models and explicit status state machine."""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from config.exceptions import InvalidStateTransition


class ReferralStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    ANALYSING = "ANALYSING", "Analysing"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION", "Needs clarification"
    READY_FOR_MATCHING = "READY_FOR_MATCHING", "Ready for matching"
    AWAITING_ACCEPTANCE = "AWAITING_ACCEPTANCE", "Awaiting acceptance"
    ACCEPTED = "ACCEPTED", "Accepted"
    IN_TRANSIT = "IN_TRANSIT", "In transit"
    ARRIVED = "ARRIVED", "Arrived"
    CLOSED = "CLOSED", "Closed"


class Urgency(models.TextChoices):
    ROUTINE = "ROUTINE", "Routine"
    URGENT = "URGENT", "Urgent"
    EMERGENCY = "EMERGENCY", "Emergency"


ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    ReferralStatus.DRAFT: {ReferralStatus.ANALYSING},
    ReferralStatus.ANALYSING: {
        ReferralStatus.NEEDS_CLARIFICATION,
        ReferralStatus.READY_FOR_MATCHING,
        ReferralStatus.DRAFT,  # explicit retry after failed analysis
    },
    ReferralStatus.NEEDS_CLARIFICATION: {
        ReferralStatus.ANALYSING,
        ReferralStatus.READY_FOR_MATCHING,
    },
    ReferralStatus.READY_FOR_MATCHING: {ReferralStatus.AWAITING_ACCEPTANCE},
    ReferralStatus.AWAITING_ACCEPTANCE: {
        ReferralStatus.ACCEPTED,
        ReferralStatus.READY_FOR_MATCHING,  # rejected / re-match
    },
    ReferralStatus.ACCEPTED: {ReferralStatus.IN_TRANSIT},
    ReferralStatus.IN_TRANSIT: {ReferralStatus.ARRIVED},
    ReferralStatus.ARRIVED: {ReferralStatus.CLOSED},
    ReferralStatus.CLOSED: set(),
}


class FindingCategory(models.TextChoices):
    MISSING = "MISSING", "Missing information"
    CONTRADICTION = "CONTRADICTION", "Contradiction"
    UNSUPPORTED = "UNSUPPORTED", "Unsupported statement"
    POLICY = "POLICY", "Policy checklist"
    SECURITY = "SECURITY", "Security / injection"
    OTHER = "OTHER", "Other"


class FindingSeverity(models.TextChoices):
    CRITICAL = "CRITICAL", "Critical"
    MAJOR = "MAJOR", "Major"
    MINOR = "MINOR", "Minor"
    INFO = "INFO", "Info"


class ResolutionState(models.TextChoices):
    OPEN = "OPEN", "Open"
    RESOLVED = "RESOLVED", "Resolved"
    ACCEPTED_RISK = "ACCEPTED_RISK", "Accepted risk (documented)"
    WAIVED_INCOMPLETE_EXPORT = "WAIVED_INCOMPLETE_EXPORT", "Shown on incomplete export"


class ReferralCase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    synthetic_case_id = models.CharField(max_length=64, unique=True, db_index=True)
    creating_facility = models.ForeignKey(
        "facilities.Facility",
        on_delete=models.PROTECT,
        related_name="created_referrals",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_referrals",
    )
    assigned_reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_referrals",
    )
    status = models.CharField(
        max_length=32, choices=ReferralStatus.choices, default=ReferralStatus.DRAFT
    )
    workflow_version = models.PositiveIntegerField(default=1)
    urgency = models.CharField(
        max_length=16, choices=Urgency.choices, default=Urgency.EMERGENCY
    )
    referral_reason = models.TextField(blank=True)
    gestational_age_weeks = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True
    )
    gravida = models.PositiveSmallIntegerField(null=True, blank=True)
    para = models.PositiveSmallIntegerField(null=True, blank=True)
    patient_display_label = models.CharField(
        max_length=128,
        default="Synthetic patient",
        help_text="Synthetic label only — never real identifiers.",
    )
    clinician_confirmed_needs = models.JSONField(
        default=list,
        blank=True,
        help_text="Capability codes confirmed by clinician (not AI-inferred).",
    )
    fully_verified = models.BooleanField(
        default=False,
        help_text="True only after findings resolved and clinician approval.",
    )
    incomplete_export_reason = models.TextField(blank=True)
    incomplete_exported_at = models.DateTimeField(null=True, blank=True)
    incomplete_exported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="incomplete_exports",
    )
    is_evaluation_case = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"{self.synthetic_case_id} [{self.status}]"

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in ALLOWED_TRANSITIONS.get(self.status, set())

    def transition_to(self, new_status: str, *, actor=None, note: str = "") -> None:
        if not self.can_transition_to(new_status):
            raise InvalidStateTransition(
                f"Cannot transition from {self.status} to {new_status}.",
                from_status=self.status,
                to_status=new_status,
            )
        old = self.status
        self.status = new_status
        self.workflow_version += 1
        self.save(update_fields=["status", "workflow_version", "updated_at"])
        TimelineEvent.objects.create(
            referral=self,
            event_type="STATUS_CHANGE",
            occurred_at=timezone.now(),
            source="system",
            display_text=f"Status {old} → {new_status}"
            + (f": {note}" if note else ""),
            actor=actor,
        )

    @transaction.atomic
    def conditional_transition(
        self,
        *,
        expected_version: int,
        expected_status: str,
        new_status: str,
        actor=None,
        note: str = "",
    ) -> bool:
        """
        Optimistic concurrency for SQLite (no select_for_update reliance).
        Returns True if update applied.
        """
        if new_status not in ALLOWED_TRANSITIONS.get(expected_status, set()):
            raise InvalidStateTransition(
                f"Cannot transition from {expected_status} to {new_status}.",
                from_status=expected_status,
                to_status=new_status,
            )
        updated = ReferralCase.objects.filter(
            pk=self.pk,
            workflow_version=expected_version,
            status=expected_status,
        ).update(
            status=new_status,
            workflow_version=expected_version + 1,
            updated_at=timezone.now(),
        )
        if not updated:
            return False
        self.refresh_from_db()
        TimelineEvent.objects.create(
            referral=self,
            event_type="STATUS_CHANGE",
            occurred_at=timezone.now(),
            source="system",
            display_text=f"Status {expected_status} → {new_status}"
            + (f": {note}" if note else ""),
            actor=actor,
        )
        return True


class ClinicalObservation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        ReferralCase, on_delete=models.CASCADE, related_name="observations"
    )
    observation_type = models.CharField(max_length=128)
    value = models.CharField(max_length=512)
    unit = models.CharField(max_length=64, blank=True)
    observed_at = models.DateTimeField(null=True, blank=True)
    source_reference = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["observed_at", "created_at"]


class TreatmentEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        ReferralCase, on_delete=models.CASCADE, related_name="treatments"
    )
    treatment_name = models.CharField(max_length=255)
    dose = models.CharField(max_length=128, blank=True)
    route = models.CharField(max_length=64, blank=True)
    administered_at = models.DateTimeField(null=True, blank=True)
    administered_by = models.CharField(max_length=255, blank=True)
    source_reference = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["administered_at", "created_at"]


class ReferralDraft(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        ReferralCase, on_delete=models.CASCADE, related_name="drafts"
    )
    version = models.PositiveIntegerField()
    structured_content = models.JSONField(default=dict)
    narrative = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("referral", "version")
        ordering = ["-version"]


class ReferralFinding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        ReferralCase, on_delete=models.CASCADE, related_name="findings"
    )
    category = models.CharField(max_length=32, choices=FindingCategory.choices)
    severity = models.CharField(max_length=16, choices=FindingSeverity.choices)
    message = models.TextField()
    evidence_citations = models.JSONField(
        default=list,
        help_text="List of citation objects; empty only if absence is explicit.",
    )
    absence_stated = models.BooleanField(
        default=False,
        help_text="True when required information was absent from evidence.",
    )
    resolution_state = models.CharField(
        max_length=32,
        choices=ResolutionState.choices,
        default=ResolutionState.OPEN,
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resolved_findings",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(blank=True)
    deterministic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-severity", "created_at"]


class Clarification(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        ANSWERED = "ANSWERED", "Answered"
        DISMISSED = "DISMISSED", "Dismissed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        ReferralCase, on_delete=models.CASCADE, related_name="clarifications"
    )
    question = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    clinician_response = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="clarification_resolutions",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class FacilityMatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        ReferralCase, on_delete=models.CASCADE, related_name="facility_matches"
    )
    facility = models.ForeignKey(
        "facilities.Facility", on_delete=models.CASCADE, related_name="matches"
    )
    capability_coverage = models.JSONField(default=dict)
    distance_km = models.FloatField(null=True, blank=True)
    availability_freshness = models.CharField(max_length=32, default="unknown")
    explanation = models.TextField()
    rank = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["rank"]
        unique_together = ("referral", "facility", "rank")


class AcceptanceRecord(models.Model):
    class Decision(models.TextChoices):
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        ReferralCase, on_delete=models.CASCADE, related_name="acceptances"
    )
    facility = models.ForeignKey(
        "facilities.Facility", on_delete=models.PROTECT, related_name="acceptances"
    )
    decision = models.CharField(max_length=16, choices=Decision.choices)
    confirmer_role = models.CharField(max_length=64)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="acceptance_confirmations",
    )
    confirmed_at = models.DateTimeField(default=timezone.now)
    reference = models.CharField(max_length=255, blank=True)
    instructions = models.TextField(blank=True)
    # Prevent duplicate acceptance approvals via conditional create
    approval_token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class TimelineEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        ReferralCase, on_delete=models.CASCADE, related_name="timeline_events"
    )
    event_type = models.CharField(max_length=64)
    occurred_at = models.DateTimeField()
    source = models.CharField(max_length=64)
    display_text = models.TextField()
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="timeline_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["occurred_at", "created_at"]


class ClinicianApproval(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.OneToOneField(
        ReferralCase, on_delete=models.CASCADE, related_name="clinician_approval"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="clinician_approvals",
    )
    approved_at = models.DateTimeField(default=timezone.now)
    attestation = models.TextField(
        default=(
            "I confirm I have reviewed the findings and evidence. "
            "This approval documents clinician judgment for a synthetic prototype "
            "and is not medical clearance for real-world care."
        )
    )
    workflow_version_at_approval = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)


class AuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events",
    )
    action = models.CharField(max_length=128)
    object_type = models.CharField(max_length=64)
    object_id = models.CharField(max_length=64)
    before_summary = models.TextField(blank=True)
    after_summary = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
