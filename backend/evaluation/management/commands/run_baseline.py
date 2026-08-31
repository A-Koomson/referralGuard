"""Run baseline (direct prompt) — does not reuse the improved verification pipeline."""
from __future__ import annotations

import time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from agents.providers import get_provider
from evaluation.models import EvaluationRun
from evaluation.scoring import aggregate, load_ground_truth, score_case, write_results
from referrals.models import ReferralCase


class Command(BaseCommand):
    help = (
        "Baseline: one direct prompt with basic instructions. "
        "Does NOT reuse the improved verification pipeline. "
        "Mock mode is functionality-only, not a measured AI claim."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--mode",
            choices=["mock", "live", "replay"],
            default="mock",
        )

    def handle(self, *args, **options):
        mode = options["mode"]
        gt = load_ground_truth()
        run = EvaluationRun.objects.create(
            method=EvaluationRun.Method.BASELINE,
            mode=mode,
            status="RUNNING",
            case_count=len(gt["cases"]),
        )
        if mode == "live":
            try:
                provider = get_provider("live")
            except RuntimeError as exc:
                run.status = "NOT_RUN"
                run.not_run_reason = str(exc)
                run.finished_at = timezone.now()
                run.save()
                write_results(
                    "baseline",
                    [],
                    {
                        "status": "NOT_RUN",
                        "reason": str(exc),
                        "note": "Submission blocker if live comparison required.",
                    },
                )
                self.stderr.write(self.style.ERROR(f"NOT RUN: {exc}"))
                raise CommandError(str(exc)) from exc
        else:
            provider = get_provider("mock")

        scores = []
        errors: list[str] = []
        for case_meta in gt["cases"]:
            case_id = case_meta["id"]
            referral = ReferralCase.objects.filter(synthetic_case_id=case_id).first()
            t0 = time.perf_counter()
            try:
                result = provider.complete_json(
                    system="List any problems in this referral as JSON facts/unsupported_statements.",
                    user=(
                        f"case={case_id} reason={getattr(referral, 'referral_reason', '')} "
                        f"ga={getattr(referral, 'gestational_age_weeks', None)}"
                    ),
                    schema_name="FactExtractionResult",
                )
            except RuntimeError as exc:
                errors.append(f"{case_id}: {exc}")
                result = {
                    "summary": "LIVE_CALL_FAILED",
                    "facts": [],
                    "unsupported_statements": [],
                    "invented_facts": [],
                }
            latency = int((time.perf_counter() - t0) * 1000)
            predicted = []
            for u in result.get("unsupported_statements") or []:
                predicted.append({"category": "UNSUPPORTED", "severity": "MAJOR", "message": u})
            # Naive baseline often misses structured omissions
            predicted_ready = len(predicted) == 0
            scores.append(
                score_case(
                    case_id=case_id,
                    method="baseline",
                    mode=mode,
                    expected_defects=case_meta.get("expected_defects") or [],
                    predicted_findings=predicted,
                    expected_readiness=case_meta.get("expected_readiness", "not_ready"),
                    predicted_ready=predicted_ready,
                    invented_fact_count=len(result.get("invented_facts") or []),
                    latency_ms=latency,
                )
            )

        summary = aggregate(scores)
        summary["method"] = "baseline"
        summary["mode"] = mode
        summary["provider"] = provider.name
        summary["model_name"] = provider.model_name
        summary["is_mock"] = provider.is_mock
        if errors:
            summary["live_errors"] = errors
            summary["live_error_count"] = len(errors)
        if mode == "mock":
            summary["benchmark_claim"] = "MOCK — not an AI benchmark"
        elif errors:
            summary["benchmark_claim"] = (
                "LIVE — partial or failed LLM calls recorded; see live_errors"
            )
        else:
            summary["benchmark_claim"] = "LIVE — measured provider run"
        paths = write_results("baseline", scores, summary)
        if mode == "live":
            paths["live_archive"] = write_results("baseline-live", scores, summary)
        run.status = "SUCCEEDED"
        run.summary = summary
        run.result_paths = paths
        run.provider = provider.name
        run.model_name = provider.model_name
        run.finished_at = timezone.now()
        run.save()
        self.stdout.write(self.style.SUCCESS(f"Baseline written: {paths}"))
