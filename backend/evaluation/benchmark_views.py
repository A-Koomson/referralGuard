"""Evaluation benchmark transparency API for super-admins."""
from __future__ import annotations

import json
import threading
from datetime import datetime, timezone as dt_timezone
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin
from accounts.system_settings import get_system_setting

_eval_lock = threading.Lock()
_eval_state: dict[str, object | None] = {
    "running": False,
    "method": None,
    "mode": None,
    "error": None,
    "started_at": None,
    "finished_at": None,
}


def _load_json(name: str) -> dict | None:
    path = Path(settings.EVALUATION_DIR) / "results" / name
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def _iso_now() -> str:
    return datetime.now(dt_timezone.utc).isoformat()


def _run_eval_worker(*, method: str, mode: str) -> None:
    cmd = "run_baseline" if method == "baseline" else "evaluate_referrals"
    try:
        call_command(cmd, mode=mode)
    except CommandError as exc:
        _eval_state["error"] = str(exc)
    except Exception as exc:  # noqa: BLE001 — surface to admin UI
        _eval_state["error"] = str(exc)
    finally:
        _eval_state["running"] = False
        _eval_state["finished_at"] = _iso_now()


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
                "primary_metric_label": (
                    (ground_truth.get("primary_metric") or "")
                    .replace("_", " ")
                    .strip()
                    if ground_truth
                    else None
                ),
                "case_count": ground_truth.get("case_count") if ground_truth else 12,
                "current_llm": {
                    "provider": get_system_setting("LLM_PROVIDER"),
                    "model": get_system_setting("LLM_MODEL"),
                    "base_url": get_system_setting("LLM_BASE_URL"),
                    "api_key_configured": bool(settings.LLM_API_KEY),
                },
                "run_status": {
                    "running": bool(_eval_state["running"]),
                    "method": _eval_state["method"],
                    "mode": _eval_state["mode"],
                    "error": _eval_state["error"],
                    "started_at": _eval_state["started_at"],
                    "finished_at": _eval_state["finished_at"],
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
    """Start baseline or agent evaluation in the background (live runs may take several minutes)."""

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
        if mode == "live" and not settings.LLM_API_KEY:
            return Response(
                {
                    "error": {
                        "message": "LLM_API_KEY is not set in server .env",
                        "hint": "Add your Groq key to .env, set LLM_PROVIDER=live, restart runserver.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with _eval_lock:
            if _eval_state["running"]:
                return Response(
                    {
                        "error": {
                            "message": "An evaluation is already running.",
                            "hint": "Wait for it to finish or refresh the status panel.",
                        }
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            _eval_state["running"] = True
            _eval_state["method"] = method
            _eval_state["mode"] = mode
            _eval_state["error"] = None
            _eval_state["started_at"] = _iso_now()
            _eval_state["finished_at"] = None

        thread = threading.Thread(
            target=_run_eval_worker,
            kwargs={"method": method, "mode": mode},
            daemon=True,
        )
        thread.start()

        return Response(
            {
                "status": "started",
                "method": method,
                "mode": mode,
                "message": (
                    "Evaluation started in the background. "
                    "Live runs may take several minutes — keep this page open."
                ),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class EvaluationRunStatusView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return Response(
            {
                "running": bool(_eval_state["running"]),
                "method": _eval_state["method"],
                "mode": _eval_state["mode"],
                "error": _eval_state["error"],
                "started_at": _eval_state["started_at"],
                "finished_at": _eval_state["finished_at"],
            }
        )
