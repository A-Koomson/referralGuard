from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from referrals.models import AuditEvent

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = ("email", "full_name", "role", "facility", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "full_name")
    readonly_fields = ("id", "date_joined", "updated_at", "last_login")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "role", "facility", "is_active")}),
        (
            "Permissions",
            {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Audit", {"fields": ("id", "date_joined", "updated_at", "last_login")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "full_name",
                    "role",
                    "facility",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )
    filter_horizontal = ("groups", "user_permissions")

    def save_model(self, request, obj, form, change):
        before = ""
        if change and obj.pk:
            prior = User.objects.filter(pk=obj.pk).first()
            if prior:
                before = (
                    f"role={prior.role}; facility={prior.facility_id}; "
                    f"active={prior.is_active}"
                )
        super().save_model(request, obj, form, change)
        AuditEvent.objects.create(
            actor=request.user,
            action="admin.user.create" if not change else "admin.user.update",
            object_type="User",
            object_id=str(obj.pk),
            before_summary=before,
            after_summary=(
                f"role={obj.role}; facility={obj.facility_id}; active={obj.is_active}"
            ),
            ip_address=request.META.get("REMOTE_ADDR"),
        )