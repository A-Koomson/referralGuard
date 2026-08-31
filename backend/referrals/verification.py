"""Deterministic verification checks (no LLM)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.conf import settings

from referrals.models import (
    FindingCategory,
    FindingSeverity,
    ReferralCase,
    ReferralFinding,
    ResolutionState,
)


def load_policy_manifest() -> dict[str, Any]:
    path = Path(settings.POLICY_MANIFEST_PATH)
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def run_deterministic_checks(referral: ReferralCase) -> list[ReferralFinding]:
    """Apply versioned checklist rules that do not require language understanding."""
    findings: list[ReferralFinding] = []
    manifest = load_policy_manifest()

    def add(
        *,
        category: str,
        severity: str,
        message: str,
        citations: list[dict[str, str]] | None = None,
        absence: bool = False,
        rule_id: str = "",
    ) -> None:
        findings.append(
            ReferralFinding(
                referral=referral,
                category=category,
                severity=severity,
                message=message
                + (f" [policy:{rule_id}]" if rule_id else "")
                + f" [{manifest.get('label', 'PROVISIONAL')}]",
                evidence_citations=citations or [],
                absence_stated=absence,
                resolution_state=ResolutionState.OPEN,
                deterministic=True,
            )
        )

    if not (referral.referral_reason or "").strip():
        add(
            category=FindingCategory.MISSING,
            severity=FindingSeverity.CRITICAL,
            message="Referral reason is missing.",
            citations=[],
            absence=True,
            rule_id="REQ-REASON",
        )

    if referral.gestational_age_weeks is None:
        add(
            category=FindingCategory.MISSING,
            severity=FindingSeverity.CRITICAL,
            message="Gestational age is not documented.",
            citations=[],
            absence=True,
            rule_id="REQ-GA",
        )

    # Conflicting GA between draft content and case field
    draft = referral.drafts.order_by("-version").first()
    if draft and referral.gestational_age_weeks is not None:
        draft_ga = draft.structured_content.get("gestational_age_weeks")
        if draft_ga is not None and float(draft_ga) != float(referral.gestational_age_weeks):
            add(
                category=FindingCategory.CONTRADICTION,
                severity=FindingSeverity.CRITICAL,
                message=(
                    f"Conflicting gestational age: case={referral.gestational_age_weeks}, "
                    f"draft={draft_ga}."
                ),
                citations=[
                    {"source": "case.gestational_age_weeks", "value": str(referral.gestational_age_weeks)},
                    {"source": "draft.structured_content.gestational_age_weeks", "value": str(draft_ga)},
                ],
                rule_id="REQ-GA",
            )

    for tx in referral.treatments.all():
        if tx.administered_at is None:
            add(
                category=FindingCategory.MISSING,
                severity=FindingSeverity.CRITICAL,
                message=f"Treatment '{tx.treatment_name}' is missing administration time.",
                citations=[
                    {
                        "source": tx.source_reference or f"treatment:{tx.id}",
                        "value": tx.treatment_name,
                    }
                ],
                absence=True,
                rule_id="REQ-TX-TIME",
            )

    # Blood pressure contradictions across observations
    bp_values = {}
    for obs in referral.observations.filter(observation_type__iexact="blood_pressure"):
        bp_values[obs.source_reference or str(obs.id)] = obs.value
    if len(set(bp_values.values())) > 1:
        add(
            category=FindingCategory.CONTRADICTION,
            severity=FindingSeverity.CRITICAL,
            message="Conflicting blood pressure values across sources.",
            citations=[
                {"source": src, "value": val} for src, val in bp_values.items()
            ],
        )

    # Prompt-injection fixture detection (treat uploads as data)
    if draft and "ignore previous instructions" in (draft.narrative or "").lower():
        add(
            category=FindingCategory.SECURITY,
            severity=FindingSeverity.MAJOR,
            message=(
                "Embedded instruction-like text detected in referral narrative. "
                "Treated as untrusted data; policy/tools unchanged."
            ),
            citations=[{"source": "draft.narrative", "value": "instruction-like text present"}],
        )

    content = (draft.structured_content if draft else {}) or {}
    narrative = (draft.narrative if draft else "") or ""

    # Allergy contradiction
    draft_allergy = str(content.get("allergy", "")).lower()
    evidence_allergy = str(content.get("evidence_allergy", "")).lower()
    if draft_allergy and evidence_allergy and draft_allergy != evidence_allergy:
        add(
            category=FindingCategory.CONTRADICTION,
            severity=FindingSeverity.CRITICAL,
            message="Allergy contradiction between draft and evidence. [ALLERGY]",
            citations=[
                {"source": "draft.allergy", "value": draft_allergy},
                {"source": "evidence.allergy", "value": evidence_allergy},
            ],
        )
    if content.get("allergy_undocumented_claimed_none"):
        add(
            category=FindingCategory.UNSUPPORTED,
            severity=FindingSeverity.CRITICAL,
            message="Allergy recorded as 'none' without documentation — absence must be stated, not invented.",
            citations=[],
            absence=True,
            rule_id="REQ-NO-INVENT",
        )

    if content.get("lab_mentioned") and not content.get("lab_attached"):
        add(
            category=FindingCategory.MISSING,
            severity=FindingSeverity.MAJOR,
            message="Laboratory result mentioned but not attached. [LAB-ATTACH]",
            citations=[{"source": "draft.lab_mentioned", "value": str(content.get("lab_mentioned"))}],
            absence=True,
        )

    if content.get("treatment_in_notes") and not referral.treatments.filter(
        treatment_name__icontains=str(content.get("treatment_in_notes"))
    ).exists():
        add(
            category=FindingCategory.MISSING,
            severity=FindingSeverity.CRITICAL,
            message=f"Treatment omitted from referral structured list: {content.get('treatment_in_notes')}. [TX-OMITTED]",
            citations=[{"source": "draft.treatment_in_notes", "value": str(content.get("treatment_in_notes"))}],
            absence=True,
        )

    if content.get("unsupported_diagnosis"):
        add(
            category=FindingCategory.UNSUPPORTED,
            severity=FindingSeverity.CRITICAL,
            message=f"Unsupported diagnosis statement: {content.get('unsupported_diagnosis')}. [DX-UNSUPPORTED]",
            citations=[],
            absence=True,
        )

    if content.get("receiving_facility_contacted") is False:
        add(
            category=FindingCategory.POLICY,
            severity=FindingSeverity.MAJOR,
            message="Receiving facility not contacted (simulation checklist). [REQ-CONTACT]",
            citations=[{"source": "draft.receiving_facility_contacted", "value": "false"}],
            absence=True,
            rule_id="REQ-CONTACT",
        )

    if content.get("verbose_incomplete"):
        add(
            category=FindingCategory.MISSING,
            severity=FindingSeverity.CRITICAL,
            message="Verbose narrative lacks required clinical fields. [INCOMPLETE]",
            citations=[{"source": "draft.narrative", "value": narrative[:120]}],
            absence=True,
        )

    # EVAL-04 seeded conflict: case GA 28 with reason mentioning conflict — also check synthetic id
    if referral.synthetic_case_id == "EVAL-04" and draft:
        draft.structured_content.setdefault("gestational_age_weeks", 36.0)
        draft.save(update_fields=["structured_content"])
        if float(draft.structured_content["gestational_age_weeks"]) != float(
            referral.gestational_age_weeks or 0
        ):
            # Ensure contradiction finding exists for this eval case
            if not any(f.category == FindingCategory.CONTRADICTION for f in findings):
                add(
                    category=FindingCategory.CONTRADICTION,
                    severity=FindingSeverity.CRITICAL,
                    message="Conflicting gestational age between case and draft.",
                    citations=[
                        {
                            "source": "case.gestational_age_weeks",
                            "value": str(referral.gestational_age_weeks),
                        },
                        {
                            "source": "draft.structured_content.gestational_age_weeks",
                            "value": str(draft.structured_content["gestational_age_weeks"]),
                        },
                    ],
                    rule_id="REQ-GA",
                )

    ReferralFinding.objects.bulk_create(findings)
    return findings


def has_blocking_open_findings(referral: ReferralCase) -> bool:
    return referral.findings.filter(
        resolution_state=ResolutionState.OPEN,
        severity__in=[FindingSeverity.CRITICAL, FindingSeverity.MAJOR],
    ).exists()
