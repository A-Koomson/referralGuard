# Reproduction guide

Exact clean-environment commands for ReferralGuard. Also see [RUN_AND_TEST_GUIDE.md](RUN_AND_TEST_GUIDE.md) for verified Windows notes.

## Versions (as implemented)

| Component | Version |
|-----------|---------|
| Python | 3.11.9 (3.12 path unavailable on this machine; Django 5.1.7 supports 3.11+) |
| Django | 5.1.7 |
| DRF | 3.15.2 |
| Node | 22.x |
| Frontend | Vite 5 + React 18 + TypeScript 5 + Tailwind 3.4 |

Database: **SQLite** via `django.db.backends.sqlite3` → `backend/db.sqlite3` (created by `migrate`).

## Clean setup

### Windows PowerShell

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item .env.example .env
# Set BOOTSTRAP_SUPERADMIN_PASSWORD in .env
python backend\manage.py migrate
python backend\manage.py bootstrap_demo
python backend\manage.py runserver 127.0.0.1:8000
```

Second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

### Linux / macOS

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cp .env.example .env
# Set BOOTSTRAP_SUPERADMIN_PASSWORD in .env
python backend/manage.py migrate
python backend/manage.py bootstrap_demo
python backend/manage.py runserver 127.0.0.1:8000
```

```bash
cd frontend && npm ci && npm run dev
```

## Baseline / agent / evaluation

From repo root with venv active:

```powershell
python backend\manage.py run_baseline --mode mock
python backend\manage.py evaluate_referrals --mode mock
```

Mock mode exercises functionality only — **not** a measured AI-improvement claim.

Live mode (requires `LLM_API_KEY` and `LLM_MODEL` in `.env`; **no silent mock fallback**):

```powershell
python backend\manage.py run_baseline --mode live
python backend\manage.py evaluate_referrals --mode live
```

If credentials are missing, status is **NOT RUN** with an explicit blocker.

## Expected outputs

- `evaluation/results/baseline.{json,csv,md}`
- `evaluation/results/agent.{json,csv,md}`
- `evaluation/results/comparison.{json,csv,md}`

Primary metric: critical omission and contradiction **recall** on 12 frozen cases in `data/synthetic/ground_truth.json`.

## Cost / runtime

- Mock evaluation: typically under 1 minute on a developer laptop; cost **not measured** (no LLM).
- Live evaluation: depends on provider pricing; report tokens/money only with documented rates, otherwise **not measured**.
- Approximate live suite (12 cases, 2026-08-31): on the order of a few minutes wall-clock; per-case agent latency in `agent-live.json` is roughly 1–5 seconds.

## Fresh-clone verification (judges)

From a **new empty directory** (not your existing workspace DB):

```powershell
git clone https://github.com/A-Koomson/referralGuard.git
cd referralGuard
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item .env.example .env
# Set BOOTSTRAP_SUPERADMIN_PASSWORD only (no LLM key needed for mock + tests)
python backend\manage.py migrate
python backend\manage.py bootstrap_demo
python -m pytest backend
cd frontend; npm ci; npm run build; npm test
```

**What judges can verify without paid API keys**

| Result | How |
|--------|-----|
| App boots + seeded EVAL cases | `bootstrap_demo` + UI |
| Mock baseline / agent pipeline | `--mode mock` (labelled MOCK — not the measured claim) |
| Automated tests | `pytest backend`, `npm test`, `npm run build` |
| Measured live improvement | Read committed `evaluation/results/*-live.*` |

**What requires a judge-supplied API key**

- Re-running `run_baseline --mode live` / `evaluate_referrals --mode live`
- Live model outputs are **nondeterministic**; archived live artifacts are the submission evidence of the measured run

Verified on maintainer machine (2026-08-31): **fresh clone** into a temp directory successfully ran `migrate`, `bootstrap_demo`, `pytest backend` (26 passed), `npm ci`, `npm run build`, and `npm test`. See also `RUN_AND_TEST_GUIDE.md` for the in-workspace command log.

## Disclaimer

Hackathon prototype — synthetic data — not for clinical use.
