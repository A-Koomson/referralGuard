"""Super-admin system settings API."""
from __future__ import annotations

from django.conf import settings as django_settings
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import SystemSetting
from accounts.permissions import IsSuperAdmin
from accounts.system_settings import ensure_default_settings, env_default


class SystemSettingSerializer(serializers.ModelSerializer):
    configured = serializers.SerializerMethodField()
    display_value = serializers.SerializerMethodField()

    class Meta:
        model = SystemSetting
        fields = [
            "key",
            "label",
            "help_text",
            "category",
            "value",
            "display_value",
            "editable",
            "is_secret",
            "configured",
            "updated_at",
        ]
        read_only_fields = ["key", "label", "help_text", "category", "editable", "is_secret", "updated_at"]

    def get_configured(self, obj: SystemSetting) -> bool:
        if obj.is_secret:
            return bool(env_default(obj.key))
        return bool((obj.value or env_default(obj.key)).strip())

    def get_display_value(self, obj: SystemSetting) -> str:
        if obj.is_secret:
            return "*** configured in .env ***" if env_default(obj.key) else "(not set in .env)"
        return obj.value or env_default(obj.key)


class SystemSettingsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        ensure_default_settings()
        qs = SystemSetting.objects.all()
        return Response(
            {
                "settings": SystemSettingSerializer(qs, many=True).data,
                "architecture_note": (
                    "Configure LLM provider, model, and evaluation settings for this workspace."
                ),
                "env_fallback": {
                    "LLM_PROVIDER": django_settings.LLM_PROVIDER,
                    "LLM_MODEL": django_settings.LLM_MODEL or "(empty)",
                    "LLM_BASE_URL": django_settings.LLM_BASE_URL or "(empty)",
                    "llm_api_key_set": bool(django_settings.LLM_API_KEY),
                },
            }
        )

    def patch(self, request):
        ensure_default_settings()
        updates = request.data.get("settings") or request.data
        if not isinstance(updates, dict):
            raise serializers.ValidationError("Expected object of key → value pairs.")
        changed = []
        for key, value in updates.items():
            if key == "settings":
                continue
            try:
                row = SystemSetting.objects.get(key=key)
            except SystemSetting.DoesNotExist:
                continue
            if not row.editable or row.is_secret:
                continue
            row.value = str(value)
            row.save(update_fields=["value", "updated_at"])
            changed.append(key)
        qs = SystemSetting.objects.all()
        return Response(
            {
                "updated": changed,
                "settings": SystemSettingSerializer(qs, many=True).data,
            }
        )


class SystemSettingCreateView(APIView):
    """Allow super-admin to add custom non-secret settings."""

    permission_classes = [IsSuperAdmin]

    def post(self, request):
        key = (request.data.get("key") or "").strip().upper().replace(" ", "_")
        if not key or len(key) < 3:
            return Response(
                {"error": {"message": "key required (min 3 chars)"}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if SystemSetting.objects.filter(key=key).exists():
            return Response(
                {"error": {"message": "Setting already exists."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        row = SystemSetting.objects.create(
            key=key,
            label=request.data.get("label") or key.replace("_", " ").title(),
            help_text=request.data.get("help_text") or "",
            category=request.data.get("category") or "custom",
            value=str(request.data.get("value") or ""),
            editable=True,
            is_secret=False,
        )
        return Response(SystemSettingSerializer(row).data, status=status.HTTP_201_CREATED)
