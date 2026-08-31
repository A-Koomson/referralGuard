"""Evaluation benchmark transparency API for super-admins."""
from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin
from accounts.system_settings import get_system_setting


def _load_json(name: str) -> dict | None:
    path = Path(settings.EVALUATION_DIR) / "results" / name
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


class EvaluationBenchmarkView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        baseline_live = _load_json("baseline-live.json")
        agent_live = _load_json("agent-live.json")
        comparison_live = _load_json("comparison-live.json")
        baseline_mock = _load_json("baseline.json")
        agent_mock = _load_json("agent.json")
        comparison_mock = _load_json("comparison.json")
        gt_path = Path(settings.SYNTHETIC_DATA_DIR) / "ground_truth.json"
        ground_truth = None
        if gt_path.exists():
            with gt_path.open(encoding="utf-8") as fh:
                ground_truth = json.load(fh)

        return Response(
            {
                "disclaimer": get_system_setting("EVALUATION_DISCLAIMER"),
                "primary_metric": ground_truth.get("primary_metric") if ground_truth else None,
                "case_count": ground_truth.get("case_count") if ground_truth else 12,
                "current_llm": {
                    "provider": get_system_setting("LLM_PROVIDER"),
                    "model": get_system_setting("LLM_MODEL"),
                    "base_url": get_system_setting("LLM_BASE_URL"),
                    "api_key_configured": bool(settings.LLM_API_KEY),
                },
                "architecture": {
                    "baseline": (
                        "Single direct LLM prompt (run_baseline). Does NOT use deterministic "
                        "checklist or orchestrated pipeline. Intentionally weak comparison point."
                    ),
                    "agent": (
                        "Deterministic verification rules + orchestrated pipeline with one bounded "
                        "LLM fact-extraction pass (evaluate_referrals / analyse)."
                    ),
                    "llm_role": (
                        "LLM assists structured extraction only. Most findings come from rule-based "
                        "checklist — not from asking the model to 'find all problems'."
                    ),
                },
                "artifacts": {
                    "baseline_live": baseline_live,
                    "agent_live": agent_live,
                    "comparison_live": comparison_live,
                    "baseline_mock": baseline_mock,
                    "agent_mock": agent_mock,
                    "comparison_mock": comparison_mock,
                },
                "artifact_paths": {
                    "baseline_live": "evaluation/results/baseline-live.md",
                    "agent_live": "evaluation/results/agent-live.md",
                    "comparison_live": "evaluation/results/comparison-live.md",
                },
            }
        )


class EvaluationRunView(APIView):
    """Trigger baseline or agent evaluation (super-admin). Live mode may take several minutes."""

    permission_classes = [IsSuperAdmin]

    def post(self, request):
        method = (request.data.get("method") or "agent").lower()
        mode = (request.data.get("mode") or "mock").lower()
        if method not in {"baseline", "agent"}:
            return Response(
                {"error": {"message": "method must be baseline or agent"}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if mode not in {"mock", "live", "replay"}:
            return Response(
                {"error": {"message": "mode must be mock, live, or replay"}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cmd = "run_baseline" if method == "baseline" else "evaluate_referrals"
        try:
            call_command(cmd, mode=mode)
        except Exception as exc:  # noqa: BLE001 — surface to admin UI
            return Response(
                {
                    "error": {
                        "message": str(exc),
                        "hint": "Live mode requires LLM_API_KEY in .env. Mock mode works offline.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        suffix = f"{method}-live" if mode == "live" else method
        if method == "agent" and mode == "live":
            comparison = _load_json("comparison-live.json")
        elif method == "agent":
            comparison = _load_json("comparison.json")
        else:
            comparison = _load_json(f"baseline{'-live' if mode == 'live' else ''}.json")
        return Response(
            {
                "status": "completed",
                "method": method,
                "mode": mode,
                "result": comparison,
            }
        )
