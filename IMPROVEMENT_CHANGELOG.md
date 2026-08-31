# Improvement changelog

## Baseline

- **Method:** Single direct prompt (`run_baseline`) asking for JSON problems; **does not** call `run_deterministic_checks` or the multi-stage verification orchestrator.
- **Evidence:** `evaluation/results/baseline.*` (mock mode, 2026-08-30).
- **Label:** MOCK — not an AI benchmark.

## Iteration 1 — Deterministic verification + provisional checklist

- Added versioned provisional checklist manifest (explicitly **not** GHS-verified).
- Deterministic findings for missing reason, missing treatment times, BP conflicts, GA conflicts, allergy contradictions, unattached labs, omitted treatments, unsupported diagnosis, contact flag, verbose incomplete, prompt-injection narrative.
- **Decision:** Keep deterministic checks as primary for structured defects; LLM only for language-heavy extraction when live.
- **Why this mattered most:** Structured omissions (empty reason, missing drug times) are checklist problems. A free-form LLM prompt is a weak detector for them.

## Iteration 2 — Orchestrated agent pipeline

- Single `verification_orchestrator` with trace events for FactExtraction, Timeline, Policy, Contradiction, Clarification responsibilities (not seven mandatory LLM calls).
- Provider interface: mock / live / replay; live never silently falls back to mock.
- **Evidence:** `evaluation/results/agent.*` and `comparison.*` (mock); representative traces in `trajectories/`.

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
- **Sanitized live trajectory:** `trajectories/verification_orchestrator_live_eval03.json` (EVAL-03).

## Iteration 5 — Production workflow UX (2026-08-31)

- **Strict step order enforced in UI and API:** analysis → resolve findings → match facilities → clinician approve → confirm acceptance → handoff/print.
- Locked actions stay visible but **greyed out** with hover reasons (`frontend/src/lib/workflowGates.ts`, `WorkflowControls.tsx`).
- **Handoff** and **Print summary** blocked until status is **ACCEPTED** (direct URL shows a gate screen).
- **Backend:** approve only from `AWAITING_ACCEPTANCE` after matches exist; accept requires prior clinician approval (`test_workflow_gates.py`).
- **New referral:** clickable capability chips add/remove need codes (`CapabilityNeedsInput.tsx`) — no manual code memorization.
- **Workflow feedback:** blocker alerts explain why actions are locked; editable referral reason on case detail; resolving a finding does not update clinical fields.

## Removed / not claimed experiments

### Experiment removed from the measured claim: treating mock 1.0 as live AI improvement

- **What we tried:** Early demos cited mock-mode agent recall **1.0** alongside the product walkthrough.
- **Why it looked attractive:** Offline, free, and deterministic — great for UI smoke tests.
- **Evidence of the problem:** Mock mode never calls a live LLM for the defect-finding checklist; scores largely reflect deterministic rules. Presenting them as “measured LLM improvement” would mislead judges.
- **Decision:** Keep mock for functionality only. Measured improvement claim uses **live** artifacts only (`baseline-live.*` / `comparison-live.*`). Mock scores must be labelled **MOCK — not an AI benchmark**.
- **Lesson:** Separate demo convenience from evaluation integrity. Do not invent discarded A/B experiments; document what you actually stopped claiming.

## Hot take / main failure mode

- **Hot take:** For emergency referral **documentation** defects, a versioned checklist plus human gates beats a single clever LLM prompt. The LLM is useful as a bounded extraction assist, not as the primary safety net.
- **Main failure mode:** A weak single-prompt baseline (and any mock run treated as “AI”) systematically **misses structured omissions** (empty reason, missing administration times) while sometimes inventing unsupported problems. Live baseline recall **0.0** on 12 frozen cases is the evidence (`baseline-live.md`).

## Cursor / coding-agent contribution note

- Empty workspace scaffolded in this sprint by Cursor (Composer).
- No prior ReferralGuard application existed in the workspace to preserve.
