"""Shared evaluation scoring — baseline and agent use identical cases."""
from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from django.conf import settings


@dataclass
class CaseScore:
    case_id: str
    method: str
    mode: str
    true_positives: int
    false_positives: int
    false_negatives: int
    precision: float | None
    recall: float | None
    readiness_correct: bool
    invented_fact_count: int
    citation_accuracy: float | None
    latency_ms: int | None
    notes: str = ""


def load_ground_truth() -> dict[str, Any]:
    path = Path(settings.SYNTHETIC_DATA_DIR) / "ground_truth.json"
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def match_defect(expected: dict[str, Any], predicted: dict[str, Any]) -> bool:
    """Correct defect matching: category (+ optional code substring in message)."""
    if expected.get("category") != predicted.get("category"):
        return False
    code = expected.get("code")
    if code and code not in (predicted.get("message") or "") and code not in (
        predicted.get("code") or ""
    ):
        # soft match on category+severity when code not embedded
        return expected.get("severity") == predicted.get("severity")
    return True


def score_case(
    *,
    case_id: str,
    method: str,
    mode: str,
    expected_defects: list[dict[str, Any]],
    predicted_findings: list[dict[str, Any]],
    expected_readiness: str,
    predicted_ready: bool,
    invented_fact_count: int = 0,
    cited_ok: int = 0,
    cited_total: int = 0,
    latency_ms: int | None = None,
) -> CaseScore:
    matched_expected = set()
    matched_predicted = set()
    for ei, exp in enumerate(expected_defects):
        for pi, pred in enumerate(predicted_findings):
            if pi in matched_predicted:
                continue
            if match_defect(exp, pred):
                matched_expected.add(ei)
                matched_predicted.add(pi)
                break
    tp = len(matched_expected)
    fn = len(expected_defects) - tp
    fp = len(predicted_findings) - len(matched_predicted)
    precision = (tp / (tp + fp)) if (tp + fp) else None
    recall = (tp / (tp + fn)) if (tp + fn) else (1.0 if not expected_defects else None)
    # Zero-defect case: recall undefined conventionally → treat as 1.0 if fp==0 else 0 for false-alarm
    if not expected_defects:
        recall = 1.0 if fp == 0 else 0.0
        precision = 1.0 if fp == 0 else 0.0
    readiness_correct = (expected_readiness == "ready" and predicted_ready) or (
        expected_readiness == "not_ready" and not predicted_ready
    )
    citation_accuracy = (cited_ok / cited_total) if cited_total else None
    return CaseScore(
        case_id=case_id,
        method=method,
        mode=mode,
        true_positives=tp,
        false_positives=fp,
        false_negatives=fn,
        precision=precision,
        recall=recall,
        readiness_correct=readiness_correct,
        invented_fact_count=invented_fact_count,
        citation_accuracy=citation_accuracy,
        latency_ms=latency_ms,
    )


def aggregate(scores: list[CaseScore]) -> dict[str, Any]:
    tp = sum(s.true_positives for s in scores)
    fp = sum(s.false_positives for s in scores)
    fn = sum(s.false_negatives for s in scores)
    recalls = [s.recall for s in scores if s.recall is not None]
    precisions = [s.precision for s in scores if s.precision is not None]
    complete = next((s for s in scores if s.case_id == "EVAL-01"), None)
    return {
        "case_count": len(scores),
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "micro_recall": (tp / (tp + fn)) if (tp + fn) else None,
        "micro_precision": (tp / (tp + fp)) if (tp + fp) else None,
        "macro_recall": sum(recalls) / len(recalls) if recalls else None,
        "macro_precision": sum(precisions) / len(precisions) if precisions else None,
        "false_positive_rate_proxy": (fp / max(fp + tp, 1)),
        "complete_case_false_alarm_rate": (
            1.0 if complete and complete.false_positives > 0 else 0.0
        )
        if complete
        else None,
        "readiness_accuracy": sum(1 for s in scores if s.readiness_correct) / len(scores)
        if scores
        else None,
        "invented_fact_total": sum(s.invented_fact_count for s in scores),
        "primary_metric": "critical_omission_and_contradiction_recall",
        "uncertainty": (
            "12 synthetic cases demonstrate prototype behaviour, "
            "not clinical efficacy or lives saved."
        ),
    }


def write_results(prefix: str, scores: list[CaseScore], summary: dict[str, Any]) -> dict[str, str]:
    out_dir = Path(settings.EVALUATION_DIR) / "results"
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {}
    json_path = out_dir / f"{prefix}.json"
    payload = {"summary": summary, "cases": [asdict(s) for s in scores]}
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    paths["json"] = str(json_path)

    csv_path = out_dir / f"{prefix}.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(asdict(scores[0]).keys()) if scores else [])
        if scores:
            writer.writeheader()
            for s in scores:
                writer.writerow(asdict(s))
    paths["csv"] = str(csv_path)

    md_path = out_dir / f"{prefix}.md"
    lines = [
        f"# Evaluation: {prefix}",
        "",
        f"- Mode: {summary.get('mode', 'unknown')}",
        f"- Model: {summary.get('model_name', summary.get('provider', 'n/a'))}",
        f"- Benchmark claim: {summary.get('benchmark_claim', 'see summary JSON')}",
        f"- Cases: {summary.get('case_count')}",
        f"- Micro recall (primary): {summary.get('micro_recall')}",
        f"- Micro precision: {summary.get('micro_precision')}",
        f"- TP/FP/FN: {summary.get('true_positives')}/{summary.get('false_positives')}/{summary.get('false_negatives')}",
        f"- Complete-case false-alarm rate: {summary.get('complete_case_false_alarm_rate')}",
        "",
        summary.get("uncertainty", ""),
        "",
        "| Case | TP | FP | FN | Recall | Precision | Ready OK |",
        "|------|----|----|----|--------|-----------|----------|",
    ]
    for s in scores:
        lines.append(
            f"| {s.case_id} | {s.true_positives} | {s.false_positives} | {s.false_negatives} | "
            f"{s.recall} | {s.precision} | {s.readiness_correct} |"
        )
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    paths["md"] = str(md_path)
    return paths
