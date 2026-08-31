# Trajectories

Sanitized, representative traces for runtime agent stages actually used by ReferralGuard.

- No hidden chain-of-thought
- No secrets / API keys / real patient data
- Mock runs labelled **MOCK - not an AI benchmark**
- Live / replay labelled distinctly

## Files

| File | Stage | Mode |
|------|-------|------|
| `verification_orchestrator_mock.json` | Full orchestrator pass (EVAL-03) | MOCK |
| `verification_orchestrator_live_eval03.json` | Full orchestrator pass (EVAL-03) | **LIVE** (Groq `openai/gpt-oss-120b`, 2026-08-31) |
| `fact_extraction.md` | FactExtraction responsibility | MOCK summary |
| `clarification.md` | ClarificationAgent question generation | MOCK / deterministic |
| `facility_matching.md` | Facility matching (API/deterministic; not auto-accept) | Deterministic |

## How to read a live trajectory

1. Open `verification_orchestrator_live_eval03.json`.
2. Trace `FactExtractionAgent` → live LLM summary (sanitized).
3. Policy / Contradiction stages remain **deterministic-primary**.
4. `ClarificationAgent` is a **human checkpoint** when referral reason is empty.
5. Linked scored result: `evaluation/results/agent-live.md` (EVAL-03 recall 1.0).

Generate fresh traces by analysing a referral via the API or `run_verification_pipeline`, then export `AgentRun` / `AgentTraceEvent` rows (never commit raw API keys or unsanitized payloads).
