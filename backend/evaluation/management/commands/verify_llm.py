"""Verify live LLM provider connectivity before evaluation runs."""
from __future__ import annotations

from django.core.management.base import BaseCommand

from agents.providers import get_provider


class Command(BaseCommand):
    help = "Ping the configured live LLM provider with a minimal JSON request."

    def handle(self, *args, **options):
        try:
            provider = get_provider("live")
        except RuntimeError as exc:
            self.stderr.write(self.style.ERROR(f"NOT RUN: {exc}"))
            return
        self.stdout.write(f"Provider: live · model={provider.model_name}")
        try:
            result = provider.complete_json(
                system="You extract documented facts only. Return valid JSON.",
                user='{"probe": "ReferralGuard connectivity test"}',
                schema_name="FactExtractionResult",
            )
        except RuntimeError as exc:
            self.stderr.write(self.style.ERROR(f"LIVE FAILED: {exc}"))
            self.stderr.write(
                "Tip: For Groq, set LLM_MODEL=llama-3.3-70b-versatile in .env"
            )
            return
        self.stdout.write(self.style.SUCCESS(f"LIVE OK: {result.get('summary', result)}"))
