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


def _artifact_name(method: str | None, mode: str | None, *, comparison: bool = False) -> str | None:
    if not method or not mode:
        return None
    if comparison:
        return f"comparison{'-live' if mode == 'live' else ''}.json"
    prefix = "baseline" if method == "baseline" else "agent"
    return f"{prefix}{'-live' if mode == 'live' else ''}.json"


def _last_run_payload() -> dict | None:
    if _eval_state["running"] or not _eval_state["finished_at"]:
        return None
    method = _eval_state["method"]
    mode = _eval_state["mode"]
    if not method or not mode:
        return None
    artifact = _artifact_name(str(method), str(mode))
    if not artifact:
        return None
    payload = _load_json(artifact)
    summary = (payload or {}).get("summary") or {}
    cases = (payload or {}).get("cases") or []
    stem = artifact.replace(".json", "")
    next_steps = _next_steps(str(method), str(mode))
    return {
        "method": method,
        "mode": mode,
        "finished_at": _eval_state["finished_at"],
        "error": _eval_state["error"],
        "summary": summary,
        "cases": cases,
        "case_count": len(cases),
        "micro_recall": summary.get("micro_recall"),
        "micro_precision": summary.get("micro_precision"),
        "benchmark_claim": summary.get("benchmark_claim"),
        "artifact_md": f"evaluation/results/{stem}.md",
        "artifact_json": f"evaluation/results/{artifact}",
        "next_steps": next_steps,
    }


def _next_steps(method: str, mode: str) -> list[str]:
    if mode == "mock":
        if method == "baseline":
            return [
                "Mock baseline finished — offline smoke test only, not a hackathon benchmark claim.",
                "Next: run agent (mock) to confirm the pipeline, or run both live runs for measured scores.",
            ]
        return [
            "Mock agent finished — confirms rules + pipeline work offline.",
            "Next: run baseline (live) then agent (live) for scores to show judges (or use existing comparison-live.md).",
        ]
    if method == "baseline":
        return [
            "Live baseline scores saved to evaluation/results/baseline-live.md.",
            "Next: run agent (live) to refresh comparison-live.md with side-by-side improvement.",
        ]
    return [
        "Live agent scores saved to evaluation/results/agent-live.md and comparison-live.md.",
        "Next: show Admin → Baseline & LLM or comparison-live.md in your hackathon video.",
        "Optional: open EVAL-03 in the clinician dashboard to demo the workflow.",
    ]


def _load_json(name: str) -> dict | None:
    path = Path(settings.EVALUATION_DIR) / "results" / name
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def _iso_now() -> str:
    return datetime.now(dt_timezone.utc).isoformat()


def _result_json_name(method: str, mode: str) -> str:
    if method == "baseline":
        return f"baseline{'-live' if mode == 'live' else ''}.json"
    return f"agent{'-live' if mode == 'live' else ''}.json"


def _next_steps(method: str | None, mode: str | None) -> str:
    if not method or not mode:
        return (
            "Run baseline (live) then agent (live) for the hackathon benchmark story, "
            "or use mock runs to smoke-test the pipeline offline."
        )
    if mode == "mock":
        if method == "baseline":
            return (
                "Mock baseline finished — offline smoke test only. "
                "Next: run agent (mock) or switch to live runs for measured scores."
            )
        return (
            "Mock agent finished — confirms the pipeline runs, not an AI benchmark claim. "
            "Next: enable live runs (restart backend with LLM_API_KEY) and run baseline (live) "
            "then agent (live)."
        )
    if method == "baseline":
        return (
            "Live baseline scores saved. Next: run agent (live) on the same 12 cases — "
            "that refreshes comparison-live.md for judges."
        )
    return (
        "Live agent + comparison updated. Show the metric cards above and "
        "evaluation/results/comparison-live.md in your demo video."
    )


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
        "next_steps": _next_steps(str(method), str(mode)),
    }
    if _eval_state["error"]:
        return payload
    result_name = _result_json_name(str(method), str(mode))
    result = _load_json(result_name)
    if result:
        summary = result.get("summary") or {}
        payload["summary"] = summary
        payload["cases"] = result.get("cases") or []
        payload["artifact_md"] = f"evaluation/results/{result_name.replace('.json', '.md')}"
        payload["artifact_json"] = f"evaluation/results/{result_name}"
        if str(method) == "agent":
            comp_name = (
                "comparison-live.json" if str(mode) == "live" else "comparison.json"
            )
            payload["comparison_md"] = (
                f"evaluation/results/{comp_name.replace('.json', '.md')}"
            )
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
                    "env_file_hint": str(_env_file()),
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
                "last_run": _last_run_payload(),
                "live_runs_require_restart": (
                    get_system_setting("LLM_PROVIDER") == "live"
                    and not settings.LLM_API_KEY
                ),
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
