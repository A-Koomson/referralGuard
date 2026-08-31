"""LLM provider interface — mock never silently substitutes for live failures."""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

from django.conf import settings
from pydantic import BaseModel, Field, ValidationError

from accounts.system_settings import get_system_setting


def _cfg(name: str) -> str:
    return get_system_setting(name) or getattr(settings, name, "") or ""


class FactExtractionResult(BaseModel):
    summary: str = Field(description="Brief extraction summary")
    facts: list[dict[str, str]] = Field(default_factory=list)
    unsupported_statements: list[str] = Field(default_factory=list)
    invented_facts: list[str] = Field(
        default_factory=list,
        description="Must remain empty — inventing facts is a failure.",
    )


class Provider(ABC):
    name: str
    model_name: str = ""
    is_mock: bool = False
    is_replay: bool = False

    @abstractmethod
    def complete_json(self, *, system: str, user: str, schema_name: str) -> dict[str, Any]:
        raise NotImplementedError


class MockProvider(Provider):
    name = "mock"
    model_name = "mock-deterministic"
    is_mock = True

    def complete_json(self, *, system: str, user: str, schema_name: str) -> dict[str, Any]:
        # Deterministic offline response — clearly marked
        data = FactExtractionResult(
            summary="MOCK extraction — not an AI benchmark",
            facts=[],
            unsupported_statements=[],
            invented_facts=[],
        )
        return data.model_dump()


class LiveProvider(Provider):
    name = "live"
    is_mock = False

    def __init__(self) -> None:
        self.model_name = _cfg("LLM_MODEL")
        self.api_key = settings.LLM_API_KEY or ""
        self.base_url = _cfg("LLM_BASE_URL") or "https://api.openai.com/v1"
        if not self.api_key:
            raise RuntimeError(
                "LLM_API_KEY is required for live mode. "
                "Refusing to fall back to mock on missing credentials."
            )
        if not self.model_name:
            raise RuntimeError("LLM_MODEL is required for live mode.")

    def complete_json(self, *, system: str, user: str, schema_name: str) -> dict[str, Any]:

        schema_hint = (
            "Return JSON with keys: summary (string), facts (array of objects), "
            "unsupported_statements (array of strings), invented_facts (array, must be empty)."
        )
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": f"{system}\n\n{schema_hint}"},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0,
        }
        raw_text = self._call(url, headers, body)
        parsed = self._validate(raw_text)
        if parsed is not None:
            return parsed

        # One repair retry
        repair_body = {
            **body,
            "messages": [
                {"role": "system", "content": f"{system}\n\n{schema_hint}"},
                {"role": "user", "content": user},
                {
                    "role": "user",
                    "content": (
                        "Your previous response was invalid JSON for schema "
                        f"{schema_name}. Reply with valid JSON only, no markdown fences."
                    ),
                },
            ],
        }
        raw_text2 = self._call(url, headers, repair_body)
        parsed2 = self._validate(raw_text2)
        if parsed2 is None:
            raise RuntimeError("Live provider returned invalid JSON after one repair retry.")
        return parsed2

    def _call(self, url: str, headers: dict, body: dict) -> str:
        import httpx

        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(url, headers=headers, json=body)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:  # noqa: BLE001
            # Never silently fall back to mock
            raise RuntimeError(f"Live LLM provider call failed: {exc}") from exc
        return data["choices"][0]["message"]["content"]

    def _validate(self, raw: str) -> dict[str, Any] | None:
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3].strip()
            data = json.loads(cleaned)
            return FactExtractionResult.model_validate(data).model_dump()
        except (json.JSONDecodeError, ValidationError, TypeError, KeyError):
            return None


class ReplayProvider(Provider):
    name = "replay"
    is_replay = True
    model_name = "replay-stored"

    def __init__(self, artifact: dict[str, Any]) -> None:
        self.artifact = artifact

    def complete_json(self, *, system: str, user: str, schema_name: str) -> dict[str, Any]:
        return {
            **self.artifact,
            "summary": "REPLAY — stored real-model output (not a fresh live run)",
        }


def get_provider(mode: str, *, replay_artifact: dict[str, Any] | None = None) -> Provider:
    mode = (mode or _cfg("LLM_PROVIDER") or "mock").lower()
    if mode == "mock":
        return MockProvider()
    if mode == "replay":
        if not replay_artifact:
            raise RuntimeError("Replay mode requires a stored artifact.")
        return ReplayProvider(replay_artifact)
    if mode == "live":
        return LiveProvider()
    raise RuntimeError(f"Unknown LLM provider mode: {mode}")
