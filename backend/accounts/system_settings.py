"""Runtime system settings — DB overrides with .env fallback for secrets."""
from __future__ import annotations

from django.conf import settings as django_settings

DEFAULT_SETTINGS: list[dict[str, str | bool]] = [
    {
        "key": "LLM_PROVIDER",
        "label": "LLM provider mode",
        "help_text": "mock = offline UI; live = real API (requires .env key); replay = stored traces.",
        "category": "llm",
        "editable": True,
        "is_secret": False,
    },
    {
        "key": "LLM_MODEL",
        "label": "LLM model name",
        "help_text": "Example Groq: openai/gpt-oss-120b. Must match your provider.",
        "category": "llm",
        "editable": True,
        "is_secret": False,
    },
    {
        "key": "LLM_BASE_URL",
        "label": "LLM API base URL",
        "help_text": "Groq example: https://api.groq.com/openai/v1",
        "category": "llm",
        "editable": True,
        "is_secret": False,
    },
    {
        "key": "LLM_API_KEY",
        "label": "LLM API key",
        "help_text": "Never stored in database. Set LLM_API_KEY in server .env only.",
        "category": "llm",
        "editable": False,
        "is_secret": True,
    },
    {
        "key": "EVALUATION_DISCLAIMER",
        "label": "Evaluation disclaimer",
        "help_text": "Shown with benchmark results in admin.",
        "category": "evaluation",
        "editable": True,
        "is_secret": False,
    },
]


def env_default(key: str) -> str:
    mapping = {
        "LLM_PROVIDER": django_settings.LLM_PROVIDER,
        "LLM_MODEL": django_settings.LLM_MODEL,
        "LLM_BASE_URL": django_settings.LLM_BASE_URL,
        "LLM_API_KEY": django_settings.LLM_API_KEY,
        "EVALUATION_DISCLAIMER": (
            "12 synthetic cases demonstrate prototype behaviour, "
            "not clinical efficacy or lives saved."
        ),
    }
    return str(mapping.get(key, "") or "")


def get_system_setting(key: str) -> str:
    from accounts.models import SystemSetting

    try:
        row = SystemSetting.objects.get(key=key)
        if row.is_secret:
            return env_default(key)
        return row.value or env_default(key)
    except SystemSetting.DoesNotExist:
        return env_default(key)


def ensure_default_settings() -> None:
    from accounts.models import SystemSetting

    for spec in DEFAULT_SETTINGS:
        SystemSetting.objects.get_or_create(
            key=spec["key"],
            defaults={
                "label": spec["label"],
                "help_text": spec["help_text"],
                "category": spec["category"],
                "editable": spec["editable"],
                "is_secret": spec["is_secret"],
                "value": "" if spec["is_secret"] else env_default(spec["key"]),
            },
        )
