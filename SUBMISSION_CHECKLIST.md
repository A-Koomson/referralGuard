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
| Representative trajectories | Present (starter) | `trajectories/` |
| User / bottleneck / value / primary metric | Present | `README.md`, GT `primary_metric` |
| Challenging negative case | Present | EVAL-01 |
| Honest failure-mode insight | Present | `docs/SUBMISSION_CHECKLIST.md`, `FEATURE_AUDIT.md` |
| Security policy | Present | `SECURITY.md` |
| Automated tests (expanded) | Present | `pytest backend` → 23 passed (2026-08-31); frontend vitest + build |
| Figma visual verification | **BLOCKED** | No Figma access in Cursor; export screenshots required |
| Solution video (≤ official limit) | **Owner task** | `docs/VIDEO_OUTLINE.md`, walkthrough in `CLONE_TEST_GUIDE.md` |
| Qualified clinical review | **Owner task / disclose absent** | Role label ≠ qualification |
| Portal submission / repo access | **Owner task** | Human |
| Master prompt file in repo | **Missing** | `CURSOR_MASTER_PROMPT.md` not found |

## Blockers before claiming “ready to submit”

1. **Record and upload** the official demo video — see `docs/VIDEO_OUTLINE.md` and `CLONE_TEST_GUIDE.md`.
2. ~~Run live baseline + agent evaluation~~ **Done** — artifacts in `evaluation/results/*-live.*`.
3. Export Figma foundations/screens for visual alignment (optional; disclose unverified if skipped).
4. Confirm portal/repo access and licence disclosures.
5. Rotate any API keys that were ever pasted into chat or screenshots.

## What this prototype is not

- Not clinically validated; not medical clearance.
- Not a claim of lives saved or hospital availability guarantees.
- Mock evaluation scores are **not** measured LLM improvement.
