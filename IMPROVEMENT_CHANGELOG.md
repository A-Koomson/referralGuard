# Improvement changelog

## Baseline

- **Method:** Single direct prompt (`run_baseline`) asking for JSON problems; **does not** call `run_deterministic_checks` or the multi-stage verification orchestrator.
- **Evidence:** `evaluation/results/baseline.*` (mock mode, 2026-08-30).
- **Label:** MOCK — not an AI benchmark.

## Iteration 1 — Deterministic verification + provisional checklist

- Added versioned provisional checklist manifest (explicitly **not** GHS-verified).
- Deterministic findings for missing reason, missing treatment times, BP conflicts, GA conflicts, allergy contradictions, unattached labs, omitted treatments, unsupported diagnosis, contact flag, verbose incomplete, prompt-injection narrative.
- **Decision:** Keep deterministic checks as primary for structured defects; LLM only for language-heavy extraction when live.

## Iteration 2 — Orchestrated agent pipeline

- Single `verification_orchestrator` with trace events for FactExtraction, Timeline, Policy, Contradiction, Clarification responsibilities (not seven mandatory LLM calls).
- Provider interface: mock / live / replay; live never silently falls back to mock.
- **Evidence:** `evaluation/results/agent.*` and `comparison.*` (mock).

## Iteration 3 — Safety gates

- Incomplete emergency export with audited reason; does not set `fully_verified`.
- Clinician approval required for verified label; blocking open CRITICAL/MAJOR findings prevent approval.
- Facility matching uses clinician-confirmed needs + availability freshness; no auto-accept.

## Iteration 4 — Live measured comparison (2026-08-31)

- **Provider:** Groq OpenAI-compatible API, model `openai/gpt-oss-120b` (`LLM_BASE_URL=https://api.groq.com/openai/v1`).
- **Baseline (live):** Single direct prompt — micro recall **0.0**, precision 0.0, 5 false positives / 13 false negatives on 12 cases. See `evaluation/results/baseline-live.md`.
- **Agent pipeline (live):** Deterministic checks + orchestrated LLM extraction — micro recall **1.0**, precision 1.0, 13 TP / 0 FP / 0 FN. See `evaluation/results/agent-live.md`.
- **Comparison:** `evaluation/results/comparison-live.md` — measured improvement on frozen synthetic suite only; **not** clinical efficacy.
- **Connectivity check:** `python backend/manage.py verify_llm` → LIVE OK before full runs.

## Iteration 5 — Production workflow UX (2026-08-31)

- **Strict step order enforced in UI and API:** analysis → resolve findings → match facilities → clinician approve → confirm acceptance → handoff/print.
- Locked actions stay visible but **greyed out** with hover reasons (`frontend/src/lib/workflowGates.ts`, `WorkflowControls.tsx`).
- **Handoff** and **Print summary** blocked until status is **ACCEPTED** (direct URL shows a gate screen).
- **Backend:** approve only from `AWAITING_ACCEPTANCE` after matches exist; accept requires prior clinician approval (`test_workflow_gates.py`).
- **New referral:** clickable capability chips add/remove need codes (`CapabilityNeedsInput.tsx`) — no manual code memorization.
- **Workflow feedback:** blocker alerts explain why actions are locked; editable referral reason on case detail; resolving a finding does not update clinical fields.

## Removed / not claimed experiments

- No fabricated discarded experiment.
- Mock-mode 1.0 scores are deterministic pipeline checks — label as MOCK when cited separately from live.

## Cursor / coding-agent contribution note

- Empty workspace scaffolded in this sprint by Cursor (Composer).
- No prior ReferralGuard application existed in the workspace to preserve.
