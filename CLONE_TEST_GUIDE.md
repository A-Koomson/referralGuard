# Clone & manual test guide

Use this after cloning ReferralGuard. For install commands and automated tests, see [RUN_AND_TEST_GUIDE.md](RUN_AND_TEST_GUIDE.md).

**Always use the React UI:** http://127.0.0.1:5173 (not `:8000` alone).

**Disclaimer:** Synthetic data only — not for clinical use. Documentation checks are not medical clearance.

---

## 1. First-time setup (after clone)

- Clone the repo and open a terminal at the repo root.
- Create a virtualenv and install backend deps (`backend/requirements.txt`).
- Copy `.env.example` → `.env`.
- Set **`BOOTSTRAP_SUPERADMIN_PASSWORD`** in `.env` (e.g. `ChangeMe-Demo-Only!` for local demos).
- Run migrations: `python backend/manage.py migrate`
- Seed demo data: `python backend/manage.py bootstrap_demo`
- **Terminal 1:** `python backend/manage.py runserver 127.0.0.1:8000`
- **Terminal 2:** `cd frontend` → `npm ci` → `npm run dev`
- Open http://127.0.0.1:5173

### Demo logins

| Email | Role | Password |
|-------|------|----------|
| `admin@referralguard.local` | Super admin | Value you set in `.env` at first bootstrap |
| `clinician1@referralguard.local` | Clinician | Same as `BOOTSTRAP_SUPERADMIN_PASSWORD`, or `ChangeMe-Demo-Only!` if you left it blank at seed |
| `coord1@referralguard.local` | Facility coordinator | Same as clinicians |

Re-running `bootstrap_demo` does **not** reset existing passwords.

---

## 2. Happy path — complete referral (no expected defects)

**Goal:** Show a clean case that can move through the workflow without blocking findings.

### Option A — seeded case **EVAL-01** (fastest)

- Log in as **`clinician1@referralguard.local`**
- Dashboard → open **EVAL-01** (*Complete correct unusual referral*)
- Click **Run analysis**
  - **Expect:** No critical blocking findings (difficult negative / false-alarm stress case)
  - Status should move toward **Ready for matching**
- Click **Match facilities** (only enabled at Ready for matching)
  - **Expect:** Ranked list; explanations mention capability coverage and freshness (stale ≠ confirmed)
- Click **Clinician approve** (only enabled after matching — greyed out before)
  - **Expect:** Cannot approve from Draft or before facility match
- Select a facility in match results → **Confirm acceptance** (only enabled after approval)
  - **Expect:** Handoff/Print stay greyed out until acceptance succeeds
- Open **Handoff** and **Print summary** (unlocked only at **Accepted**)
  - **Expect:** Structured packet; synthetic-demo label; fully verified only after approval path

### Option B — create your own clean case

- **New referral**
- Pick a **creating facility**
- **Referral reason:** e.g. `Postpartum haemorrhage unresponsive to first-line measures`
- **Gestational age:** e.g. `34`
- **Documentation status:** use *Not recorded* or *Present* — avoid inventing values
- **Clinician-confirmed needs:** click capability chips below the field (or type comma-separated codes)
- **Run analysis** → resolve any minor issues → **Match** → **Approve** → **Accept** → **Handoff** (each step unlocks the next)

### What “happy path” proves

- Dashboard counts come from the API (not hardcoded)
- Workflow steps: Draft → Analysis → Matching → **Clinician approval** → Acceptance → Handoff
- Later actions are greyed out until prerequisites complete (hover for reason)
- Human approval and acceptance are explicit (no auto-accept; cannot skip to handoff after approval alone)
- Handoff separates documented facts from unresolved items

---

## 3. Inconsistent / defective cases — what to test

All 12 **EVAL-** cases start in **DRAFT**. For each: open case → **Run analysis** → check **Verification findings**.

| Case | What is wrong | What you should see |
|------|----------------|---------------------|
| **EVAL-02** | Missing treatment time | CRITICAL missing finding — oxytocin without administration time |
| **EVAL-03** | Empty referral reason | CRITICAL missing reason (`REQ-REASON`) |
| **EVAL-04** | Conflicting gestational age | CRITICAL contradiction — case GA vs draft GA |
| **EVAL-05** | Conflicting blood pressure | CRITICAL contradiction — two BP values with different sources |
| **EVAL-06** | Allergy mismatch | CRITICAL allergy contradiction between draft and evidence |
| **EVAL-07** | Lab mentioned, not attached | MAJOR missing lab attachment |
| **EVAL-08** | Treatment in notes but omitted from list | CRITICAL omitted treatment (e.g. misoprostol) |
| **EVAL-09** | Unsupported diagnosis | CRITICAL unsupported diagnosis statement |
| **EVAL-10** | Receiving facility not contacted | MAJOR policy finding (simulation checklist) |
| **EVAL-11** | Long narrative, missing fields | CRITICAL incomplete documentation |
| **EVAL-12** | Multiple failures | Several findings: missing reason, missing tx time, BP conflict |

### How to exercise “inconsistent” behaviour in the UI

- **Run analysis** on **EVAL-03**, **EVAL-04**, or **EVAL-05** first (quick, obvious findings).
- Confirm each finding shows:
  - **Category** (Missing / Contradiction / Unsupported / Policy)
  - **Severity** (documentation check — not autonomous triage)
  - **Evidence citations** or “required information absent”
  - **Rule-based** label on deterministic findings
- **Resolve a finding:**
  - Enter a **reviewer note** (required)
  - **Confirm / correct** or **Dismiss (accept risk)**
  - **Expect:** Resolution state updates; original message preserved
- **Export incomplete emergency handoff:**
  - Enter an audited reason (≥10 characters)
  - **Expect:** Export succeeds; case stays **not fully verified**; unresolved items remain visible
- **Upload evidence** (text or JSON on referral detail):
  - **Expect:** File stored; prior **fully verified** label and clinician approval cleared
  - Re-run analysis after upload
- **Bad JSON upload:** upload `{not-json` as `.json`
  - **Expect:** Parse error — not treated as successful analysis

### Security / injection (extra case, not in the 12-case score set)

- Search dashboard for **EVAL-SEC-INJECT** (if listed) or seed narrative contains instruction-like text
- **Run analysis**
  - **Expect:** SECURITY finding — embedded instruction treated as untrusted data; workflow not auto-approved

---

## 4. Coordinator & availability (simulation)

- Log out → log in as **`coord1@referralguard.local`**
- Open **Availability** console
- **Expect:** Can view facility capability status; writes limited to coordinator role
- **Synthetic Plains District Hospital** has a **stale blood bank** fixture in seed data
  - **Expect:** Stale/expired availability is **not** shown as freshly confirmed during facility matching

---

## 5. Things that should **not** happen (sanity checks)

- **Handoff / Print** clickable or reachable before **Accepted** (should be greyed out or show gate page)
- **Clinician approve** before facility matching completes
- **Confirm acceptance** before clinician approval
- **Match facilities** while critical/major findings remain open
- **AWAITING_ACCEPTANCE** case: **Run analysis** greyed out (analysis already done)
- Wrong-facility clinician cannot open another site’s referral (404 / permission denied)
- Incomplete export never marks the case **fully verified**
- Mock LLM mode still labels agent output as mock — do not treat as live AI benchmark
- No real hospital messaging, ambulance dispatch, or live availability claims

---

## 6. Automated checks (optional, after manual pass)

From repo root with venv active:

```powershell
python -m pytest backend
```

```powershell
cd frontend
npm test
npm run build
```

Mock evaluation (offline, not live AI):

```powershell
python backend\manage.py run_baseline --mode mock
python backend\manage.py evaluate_referrals --mode mock
```

Results: `evaluation/results/` and frozen expected answers: `data/synthetic/ground_truth.json`.

---

## 7. Quick 10-minute judge script

1. Setup + login as clinician1  
2. **EVAL-01** → analyse → match → approve → accept → handoff *(happy path — note greyed buttons until each step)*  
3. **EVAL-03** → analyse → see missing reason *(inconsistency)*  
4. Resolve finding or export incomplete with reason *(human gate)*  
5. **EVAL-05** → analyse → see BP contradiction *(cross-record conflict)*  
6. Login as coord1 → availability console *(simulated coordination)*  

---

## 8. Troubleshooting

- **Login fails:** Confirm `.env` password matches what you used at first `bootstrap_demo`; re-seed does not reset passwords.
- **CSRF / 403 on POST:** Use http://127.0.0.1:5173 (Vite proxy), not raw `:8000` for the UI.
- **Port in use:** Change Vite port or stop the other process.
- **No EVAL cases:** Run `python backend/manage.py bootstrap_demo` again (idempotent).
- **Live LLM:** Set `LLM_PROVIDER=live` and keys in `.env`; if not configured, evaluation stays **NOT RUN** — that is expected.

For full command reference: [RUN_AND_TEST_GUIDE.md](RUN_AND_TEST_GUIDE.md).
