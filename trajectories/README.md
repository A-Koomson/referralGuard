# Trajectories

Sanitized, representative traces for runtime agent stages actually used by ReferralGuard.

- No hidden chain-of-thought
- No secrets / API keys / real patient data
- Mock runs labelled **MOCK - not an AI benchmark**
- Replay/live must be labelled distinctly when present

Files:

| File | Stage |
|------|-------|
| `verification_orchestrator_mock.json` | Full orchestrator mock pass |
| `fact_extraction.md` | FactExtraction responsibility |
| `clarification.md` | ClarificationAgent question generation |
| `facility_matching.md` | Facility matching (API/deterministic; not auto-accept) |

Generate fresh traces by analysing a referral via the API or `run_verification_pipeline`, then export `AgentRun` / `AgentTraceEvent` rows.
