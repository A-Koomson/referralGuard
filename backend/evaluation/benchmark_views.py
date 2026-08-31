"""Evaluation benchmark transparency API for super-admins."""
from __future__ import annotations

import json
import threading
from datetime import UTC, datetime
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


def _env_file() -> Path:
    return Path(getattr(settings, "REPO_ROOT", settings.BASE_DIR.parent)) / ".env"


def _refresh_llm_env_from_dotenv() -> bool:
    """Re-read root .env in dev so API key changes apply without a full server restart."""
    if settings.LLM_API_KEY:
        return True
    env_path = _env_file()
    if not env_path.exists():
        return False
    try:
        from dotenv import dotenv_values

        vals = dotenv_values(env_path)
        key = (vals.get("LLM_API_KEY") or "").strip()
        if not key:
            return False
        settings.LLM_API_KEY = key
        if vals.get("LLM_PROVIDER"):
            settings.LLM_PROVIDER = vals["LLM_PROVIDER"]
        if vals.get("LLM_MODEL"):
            settings.LLM_MODEL = vals["LLM_MODEL"]
        if vals.get("LLM_BASE_URL"):
            settings.LLM_BASE_URL = vals["LLM_BASE_URL"]
        return True
    except ImportError:
        return False


def _load_json(name: str) -> dict | None:
    path = Path(settings.EVALUATION_DIR) / "results" / name
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


def _result_json_name(method: str, mode: str) -> str:
    if method == "baseline":
        return f"baseline{'-live' if mode == 'live' else ''}.json"
    return f"agent{'-live' if mode == 'live' else ''}.json"


def _last_run_payload() -> dict | None:
    if _eval_state["running"] or not _eval_state["finished_at"]:
        return None
    method = _eval_state["method"]
    mode = _eval_state["mode"]
    if not method or not mode:
        return None
    payload: dict = {
        "method": method,
        "mode": mode,
        "finished_at": _eval_state["finished_at"],
        "error": _eval_state["error"],
    }
    if _eval_state["error"]:
        return payload
    result_name = _result_json_name(str(method), str(mode))
    result = _load_json(result_name)
    if not result:
        return payload
    summary = result.get("summary") or {}
    cases = result.get("cases") or []
    stem = result_name.replace(".json", "")
    payload.update(
        {
            "case_count": len(cases),
            "micro_recall": summary.get("micro_recall"),
            "micro_precision": summary.get("micro_precision"),
            "benchmark_claim": summary.get("benchmark_claim"),
            "artifact_md": f"evaluation/results/{stem}.md",
            "artifact_json": f"evaluation/results/{result_name}",
        }
    )
    if str(method) == "agent":
        comp_name = "comparison-live.json" if str(mode) == "live" else "comparison.json"
        payload["comparison_md"] = f"evaluation/results/{comp_name.replace('.json', '.md')}"
    return payload


def _run_eval_worker(*, method: str, mode: str) -> None:
    _refresh_llm_env_from_dotenv()
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
        _refresh_llm_env_from_dotenv()
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
                "last_run": _last_run_payload(),
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
                        "Single direct LLM prompt without deterministic checklist rules "
                        "or orchestrated pipeline."
                    ),
                    "agent": (
                        "Deterministic verification rules plus an orchestrated pipeline "
                        "with bounded LLM fact extraction."
                    ),
                    "llm_role": (
                        "The LLM supports structured extraction. Rule-based checklist "
                        "logic produces most verification findings."
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
            }
        )


class EvaluationRunView(APIView):
    """Start baseline or agent evaluation in the background."""

    permission_classes = [IsSuperAdmin]

    def post(self, request):
        _refresh_llm_env_from_dotenv()
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
                        "message": "LLM API key is not configured.",
                        "hint": "Set LLM_API_KEY in the server environment and reload.",
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
                            "hint": "Wait for the current run to finish.",
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
                "message": "Evaluation started.",
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
