from django.contrib import admin

from referrals.models import AuditEvent

from .models import AvailabilityUpdate, Capability, Facility, FacilityCapability


class FacilityCapabilityInline(admin.TabularInline):
    model = FacilityCapability
    extra = 0


@admin.register(Facility)
class FacilityAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "facility_type",
        "district",
        "region",
        "is_active",
        "is_fictional",
    )
    list_filter = ("facility_type", "region", "is_active", "is_fictional")
    search_fields = ("name", "district", "region")
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [FacilityCapabilityInline]

    def save_model(self, request, obj, form, change):
        before = ""
        if change and obj.pk:
            prior = Facility.objects.filter(pk=obj.pk).first()
            if prior:
                before = f"active={prior.is_active}; name={prior.name}"
        super().save_model(request, obj, form, change)
        AuditEvent.objects.create(
            actor=request.user,
            action="admin.facility.create" if not change else "admin.facility.update",
            object_type="Facility",
            object_id=str(obj.pk),
            before_summary=before,
            after_summary=f"active={obj.is_active}; name={obj.name}; fictional={obj.is_fictional}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )


@admin.register(Capability)
class CapabilityAdmin(admin.ModelAdmin):
    list_display = ("code", "name")
    search_fields = ("code", "name")
    readonly_fields = ("id", "created_at")


@admin.register(FacilityCapability)
class FacilityCapabilityAdmin(admin.ModelAdmin):
    list_display = ("facility", "capability", "availability_state", "updated_at")
    list_filter = ("availability_state", "capability")
    search_fields = ("facility__name", "capability__code")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(AvailabilityUpdate)
class AvailabilityUpdateAdmin(admin.ModelAdmin):
    list_display = (
        "facility_capability",
        "state",
        "confirmed_by",
        "confirmed_at",
        "expires_at",
    )
    list_filter = ("state",)
    readonly_fields = ("id", "created_at")
