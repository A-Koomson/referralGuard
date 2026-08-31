"""Referral API serializers."""
from __future__ import annotations

from rest_framework import serializers

from .models import (
    AcceptanceRecord,
    Clarification,
    ClinicalObservation,
    ClinicianApproval,
    FacilityMatch,
    ReferralCase,
    ReferralDraft,
    ReferralFinding,
    TimelineEvent,
    TreatmentEvent,
)


class ClinicalObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicalObservation
        fields = [
            "id",
            "observation_type",
            "value",
            "unit",
            "observed_at",
            "source_reference",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class TreatmentEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreatmentEvent
        fields = [
            "id",
            "treatment_name",
            "dose",
            "route",
            "administered_at",
            "administered_by",
            "source_reference",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ReferralFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferralFinding
        fields = [
            "id",
            "category",
            "severity",
            "message",
            "evidence_citations",
            "absence_stated",
            "resolution_state",
            "resolved_by",
            "resolved_at",
            "resolution_note",
            "deterministic",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "category",
            "severity",
            "message",
            "evidence_citations",
            "absence_stated",
            "deterministic",
            "resolved_by",
            "resolved_at",
            "created_at",
        ]


class ClarificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Clarification
        fields = [
            "id",
            "question",
            "status",
            "clinician_response",
            "resolved_by",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = ["id", "question", "resolved_by", "resolved_at", "created_at"]


class FacilityMatchSerializer(serializers.ModelSerializer):
    facility_name = serializers.CharField(source="facility.name", read_only=True)

    class Meta:
        model = FacilityMatch
        fields = [
            "id",
            "facility",
            "facility_name",
            "capability_coverage",
            "distance_km",
            "availability_freshness",
            "explanation",
            "rank",
            "created_at",
        ]


class TimelineEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimelineEvent
        fields = [
            "id",
            "event_type",
            "occurred_at",
            "source",
            "display_text",
            "actor",
            "created_at",
        ]


class ReferralDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferralDraft
        fields = [
            "id",
            "version",
            "structured_content",
            "narrative",
            "submitted_at",
            "created_at",
        ]
        read_only_fields = ["id", "version", "created_at"]


class ClinicianApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicianApproval
        fields = [
            "id",
            "approved_by",
            "approved_at",
            "attestation",
            "workflow_version_at_approval",
            "created_at",
        ]
        read_only_fields = fields


class AcceptanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcceptanceRecord
        fields = [
            "id",
            "facility",
            "decision",
            "confirmer_role",
            "confirmed_by",
            "confirmed_at",
            "reference",
            "instructions",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "confirmer_role",
            "confirmed_by",
            "confirmed_at",
            "created_at",
        ]


class ReferralCaseSerializer(serializers.ModelSerializer):
    observations = ClinicalObservationSerializer(many=True, read_only=True)
    treatments = TreatmentEventSerializer(many=True, read_only=True)
    findings = ReferralFindingSerializer(many=True, read_only=True)
    creating_facility_name = serializers.CharField(
        source="creating_facility.name", read_only=True
    )

    class Meta:
        model = ReferralCase
        fields = [
            "id",
            "synthetic_case_id",
            "creating_facility",
            "creating_facility_name",
            "created_by",
            "assigned_reviewer",
            "status",
            "workflow_version",
            "urgency",
            "referral_reason",
            "gestational_age_weeks",
            "gravida",
            "para",
            "patient_display_label",
            "clinician_confirmed_needs",
            "fully_verified",
            "incomplete_export_reason",
            "incomplete_exported_at",
            "is_evaluation_case",
            "observations",
            "treatments",
            "findings",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "status",
            "workflow_version",
            "fully_verified",
            "incomplete_export_reason",
            "incomplete_exported_at",
            "created_at",
            "updated_at",
        ]


class ReferralCaseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferralCase
        fields = [
            "synthetic_case_id",
            "creating_facility",
            "urgency",
            "referral_reason",
            "gestational_age_weeks",
            "gravida",
            "para",
            "patient_display_label",
            "clinician_confirmed_needs",
        ]


class ReferralCaseUpdateSerializer(serializers.ModelSerializer):
    """Limited clinician edits while case is in progress."""

    class Meta:
        model = ReferralCase
        fields = [
            "referral_reason",
            "patient_display_label",
            "gestational_age_weeks",
            "gravida",
            "para",
            "clinician_confirmed_needs",
        ]


class IncompleteExportSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=10, max_length=2000)


class ResolveFindingSerializer(serializers.Serializer):
    resolution_state = serializers.ChoiceField(
        choices=["RESOLVED", "ACCEPTED_RISK"],
        help_text=(
            "RESOLVED = confirmed/corrected with note; "
            "ACCEPTED_RISK = dismiss with documented reason (human judgment)."
        ),
    )
    resolution_note = serializers.CharField(required=True, min_length=3)


class ClarificationResponseSerializer(serializers.Serializer):
    clinician_response = serializers.CharField(min_length=1)
