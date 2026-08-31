from django.contrib import admin

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
    TimelineEvent,
    TreatmentEvent,
)


class ObservationInline(admin.TabularInline):
    model = ClinicalObservation
    extra = 0


class TreatmentInline(admin.TabularInline):
    model = TreatmentEvent
    extra = 0


class FindingInline(admin.TabularInline):
    model = ReferralFinding
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(ReferralCase)
class ReferralCaseAdmin(admin.ModelAdmin):
    list_display = (
        "synthetic_case_id",
        "status",
        "urgency",
        "creating_facility",
        "fully_verified",
        "is_evaluation_case",
        "updated_at",
    )
    list_filter = ("status", "urgency", "fully_verified", "is_evaluation_case")
    search_fields = ("synthetic_case_id", "referral_reason", "patient_display_label")
    readonly_fields = (
        "id",
        "workflow_version",
        "created_at",
        "updated_at",
        "incomplete_exported_at",
    )
    inlines = [ObservationInline, TreatmentInline, FindingInline]


@admin.register(ReferralFinding)
class ReferralFindingAdmin(admin.ModelAdmin):
    list_display = ("referral", "category", "severity", "resolution_state", "deterministic")
    list_filter = ("category", "severity", "resolution_state")
    search_fields = ("message", "referral__synthetic_case_id")
    readonly_fields = ("id", "created_at")


@admin.register(Clarification)
class ClarificationAdmin(admin.ModelAdmin):
    list_display = ("referral", "status", "resolved_at")
    list_filter = ("status",)
    readonly_fields = ("id", "created_at")


@admin.register(FacilityMatch)
class FacilityMatchAdmin(admin.ModelAdmin):
    list_display = ("referral", "facility", "rank", "availability_freshness")
    readonly_fields = ("id", "created_at")


@admin.register(AcceptanceRecord)
class AcceptanceRecordAdmin(admin.ModelAdmin):
    list_display = ("referral", "facility", "decision", "confirmed_at")
    readonly_fields = ("id", "approval_token", "created_at")


@admin.register(ClinicianApproval)
class ClinicianApprovalAdmin(admin.ModelAdmin):
    list_display = ("referral", "approved_by", "approved_at")
    readonly_fields = ("id", "created_at", "workflow_version_at_approval")


@admin.register(TimelineEvent)
class TimelineEventAdmin(admin.ModelAdmin):
    list_display = ("referral", "event_type", "occurred_at", "source")
    list_filter = ("event_type", "source")
    readonly_fields = ("id", "created_at")


@admin.register(ReferralDraft)
class ReferralDraftAdmin(admin.ModelAdmin):
    list_display = ("referral", "version", "submitted_at")
    readonly_fields = ("id", "created_at")


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    """Append-only audit trail — not cryptographically tamper-proof."""

    list_display = ("action", "object_type", "object_id", "actor", "created_at")
    list_filter = ("action", "object_type")
    search_fields = ("object_id", "before_summary", "after_summary")
    readonly_fields = (
        "id",
        "actor",
        "action",
        "object_type",
        "object_id",
        "before_summary",
        "after_summary",
        "ip_address",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
