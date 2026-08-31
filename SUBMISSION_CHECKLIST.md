# SUBMISSION_CHECKLIST.md

Maps hackathon deliverables to repository artifacts. Do not invent video URLs, expert approvals, or live LLM scores.

| Requirement | Status | Evidence / location |
|-------------|--------|---------------------|
| Full solution code | Present | `backend/`, `frontend/` |
| Feature audit vs user stories | Present | `FEATURE_AUDIT.md` |
| Agent instructions / architecture | Present | `docs/AGENT_ARCHITECTURE.md`, `backend/agents/` |
| Evidence-based improvement changelog | Present | `IMPROVEMENT_CHANGELOG.md` |
| Clean-environment reproduction guide | Present | `REPRODUCTION.md`, `RUN_AND_TEST_GUIDE.md` |
| Baseline runnable separately | Present | `manage.py run_baseline` |
| ≥12 evaluation cases + frozen GT | Present | `data/synthetic/ground_truth.json` + `bootstrap_demo` |
| Evaluation JSON/MD (mock) | Present | Re-run with `--mode mock`; archives in `evaluation/results/` |
| Live measured AI comparison | **DONE** (2026-08-31) | `evaluation/results/comparison-live.md` — baseline recall **0.0** → agent **1.0** (Groq `openai/gpt-oss-120b`, 12 cases) |
| Representative trajectories | **DONE** | `trajectories/` including live EVAL-03 JSON |
| User / bottleneck / value / primary metric | Present | `README.md`, GT `primary_metric` |
| Challenging negative case | Present | EVAL-01 |
| Honest failure-mode insight | Present | README + `IMPROVEMENT_CHANGELOG.md` hot take |
| Security policy | Present | `SECURITY.md` |
| Automated tests (expanded) | Present | `pytest backend` → 26 passed; frontend vitest + build + lint |
| Figma visual verification | **BLOCKED** | No Figma access in Cursor; export screenshots required |
| Solution video (≤ official limit) | **Owner task** | Record locally; upload to organiser portal (shot list is gitignored) |
| Qualified clinical review | Disclose role label ≠ qualification | Human approval gates implemented; no external attestation |
| Portal submission / repo access | **Owner task** | Confirm portal with organisers; repo is public |

## Blockers before claiming “ready to submit”

1. **Record and upload** the official demo video (local shot list only — not in the public repo).
2. ~~Run live baseline + agent evaluation~~ **Done** — artifacts in `evaluation/results/*-live.*`.
3. ~~CI lint~~ **Done** — ruff.toml + eslint fixed (confirm green Actions after push).
4. Confirm portal/repo access and licence disclosures with organisers.
5. Rotate any API keys that were ever pasted into chat or screenshots.

## What this prototype is not

- Not clinically validated; not medical clearance.
- Not a claim of lives saved or hospital availability guarantees.
- Mock evaluation scores are **not** measured LLM improvement.
