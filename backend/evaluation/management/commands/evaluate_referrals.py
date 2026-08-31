"""Evaluate final agent pipeline on the same 12 frozen cases as baseline."""
from __future__ import annotations

import time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from agents.pipeline import run_verification_pipeline
from evaluation.models import EvaluationRun
from evaluation.scoring import aggregate, load_ground_truth, score_case, write_results
from referrals.models import ReferralCase, ResolutionState
from referrals.verification import has_blocking_open_findings, run_deterministic_checks


class Command(BaseCommand):
    help = (
        "Run final agent+deterministic evaluation on the frozen 12-case suite. "
        "Mock mode exercises functionality only."
    )

    def add_arguments(self, parser):
        parser.add_argument("--mode", choices=["mock", "live", "replay"], default="mock")

    def handle(self, *args, **options):
        mode = options["mode"]
        gt = load_ground_truth()
        run = EvaluationRun.objects.create(
            method=EvaluationRun.Method.AGENT,
            mode=mode,
            status="RUNNING",
            case_count=len(gt["cases"]),
        )
        if mode == "live":
            from agents.providers import get_provider

            try:
                live_provider = get_provider("live")
            except RuntimeError as exc:
                run.status = "NOT_RUN"
                run.not_run_reason = str(exc)
                run.finished_at = timezone.now()
                run.save()
                write_results(
                    "agent",
                    [],
                    {"status": "NOT_RUN", "reason": str(exc)},
                )
                self.stderr.write(self.style.ERROR(f"NOT RUN: {exc}"))
                raise CommandError(str(exc)) from exc
            provider_model = live_provider.model_name
        else:
            provider_model = "mock"

        scores = []
        for case_meta in gt["cases"]:
            case_id = case_meta["id"]
            referral = ReferralCase.objects.filter(synthetic_case_id=case_id).first()
            if not referral:
                self.stderr.write(f"Missing case {case_id} — run bootstrap_demo")
                continue
            # Reset open findings for clean eval pass
            referral.findings.filter(resolution_state=ResolutionState.OPEN).delete()
            t0 = time.perf_counter()
            findings = run_deterministic_checks(referral)
            agent_out = run_verification_pipeline(referral, mode=mode)
            latency = int((time.perf_counter() - t0) * 1000)
            predicted = [
                {
                    "category": f.category,
                    "severity": f.severity,
                    "message": f.message,
                    "code": f.message,
                }
                for f in findings
            ]
            # citation accuracy: findings with citations or absence_stated
            cited_ok = sum(1 for f in findings if f.evidence_citations or f.absence_stated)
            predicted_ready = not has_blocking_open_findings(referral)
            scores.append(
                score_case(
                    case_id=case_id,
                    method="agent",
                    mode=mode,
                    expected_defects=case_meta.get("expected_defects") or [],
                    predicted_findings=predicted,
                    expected_readiness=case_meta.get("expected_readiness", "not_ready"),
                    predicted_ready=predicted_ready,
                    invented_fact_count=len(
                        (agent_out.get("result") or {}).get("invented_facts") or []
                    ),
                    cited_ok=cited_ok,
                    cited_total=len(findings) or 0,
                    latency_ms=latency,
                )
            )

        summary = aggregate(scores)
        summary["method"] = "agent"
        summary["mode"] = mode
        summary["model_name"] = provider_model if mode == "live" else "mock-deterministic"
        if mode == "mock":
            summary["benchmark_claim"] = "MOCK — not an AI benchmark"
        else:
            summary["benchmark_claim"] = "LIVE — agent pipeline (deterministic + LLM extraction)"
        paths = write_results("agent", scores, summary)
        if mode == "live":
            paths["live_archive"] = write_results("agent-live", scores, summary)

        # Comparison if baseline exists
        baseline_path = settings_eval_baseline(mode)
        if baseline_path and baseline_path.exists():
            import json

            baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
            comparison = {
                "baseline_micro_recall": baseline.get("summary", {}).get("micro_recall"),
                "agent_micro_recall": summary.get("micro_recall"),
                "baseline_micro_precision": baseline.get("summary", {}).get("micro_precision"),
                "agent_micro_precision": summary.get("micro_precision"),
                "mode": mode,
                "note": (
                    "Compare only when both runs share mode/provider. "
                    "Mock comparison is not a measured AI-improvement claim."
                ),
            }
            comp_paths = write_results(
                "comparison",
                scores,
                {**summary, "comparison": comparison},
            )
            paths["comparison"] = comp_paths
            if mode == "live":
                paths["comparison_live"] = write_results(
                    "comparison-live",
                    scores,
                    {**summary, "comparison": comparison},
                )

        run.status = "SUCCEEDED"
        run.summary = summary
        run.result_paths = paths
        run.finished_at = timezone.now()
        run.save()
        self.stdout.write(self.style.SUCCESS(f"Agent evaluation written: {paths}"))


def settings_eval_baseline(mode: str):
    from pathlib import Path

    from django.conf import settings

    name = "baseline-live.json" if mode == "live" else "baseline.json"
    return Path(settings.EVALUATION_DIR) / "results" / name
