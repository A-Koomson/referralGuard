# FEATURE_AUDIT.md

**Audit date:** 2026-08-31  
**Scope:** ReferralGuard synthetic-data hackathon prototype (Django + React + SQLite)  
**Master prompt:** `CURSOR_MASTER_PROMPT.md` was **not found** in the repository (searched recursively). Audit used the 35 user stories supplied in-session plus existing docs (`RUN_AND_TEST_GUIDE.md`, `docs/SUBMISSION_CHECKLIST.md`, `SECURITY.md`).

**Verification legend**

| Status | Meaning |
|--------|---------|
| PASS | Backend behaviour + persistence (+ tests where claimed) satisfy acceptance |
| PARTIAL | Core path works; gaps in UX, coverage, or edge criteria remain |
| MISSING | Required capability absent or not wired end-to-end |
| BLOCKED | Cannot verify (external dependency / not run) |

---

## Status table

| # | Story | Status | Implementation paths | Verification | Remaining limitations |
|---|--------|--------|----------------------|--------------|----------------------|
| 1 | Local setup & SQLite | **PASS** | `backend/config/settings.py`, `backend/manage.py`, `backend/*/migrations/`, `pytest.ini`, `conftest.py`, `.env.example`, `docker-compose.yml` (optional only) | `migrate` creates `backend/db.sqlite3`; pytest exit 0 with isolated DB (2026-08-31); no Postgres required | Docker file exists but is optional; fresh-clone isolation not re-run this session |
| 2 | Reproducible demo data | **PASS** | `backend/accounts/management/commands/bootstrap_demo.py`, `data/synthetic/` | Idempotent seed: 6 facilities, 12 EVAL cases; passwords not reset on re-run (code path); `--demo-clock` + freezegun expiry test | `EVAL-SEC-INJECT` is security fixture, not in frozen GT suite |
| 3 | Super-admin setup | **PASS** | `bootstrap_demo.py`, `.env.example`, `accounts/models.py` | Env / interactive / generated password; Django hashing; noninteractive error when password missing and generation disabled | Generated password printed once to stdout (dev); rotate if exposed |
| 4 | Auth & logout | **PASS** | `accounts/views.py`, `config/settings.py`, `frontend/src/api/client.ts`, `frontend/src/auth/AuthContext.tsx` | Login/logout/me tested; CSRF session cookies; HttpOnly session; no localStorage tokens; login throttle 429 tested | CSRF cookie readable by JS (intentional double-submit); Secure cookies only when `DEBUG=False` |
| 5 | Role & facility permissions | **PASS** | `accounts/permissions.py`, `referrals/views.py` queryset, `accounts/serializers.py` | Cross-facility 404 tests; coordinator no global bypass; Me PATCH absent; roles documented | Full matrix of every forbidden action not exhaustively tested |
| 6 | User & facility administration | **PASS** | Django Admin `accounts/admin.py`, `facilities/admin.py`; read-only `GET /api/v1/admin/users/` (super-admin) | Admin save hooks write `AuditEvent`; story allows Django Admin over custom CRUD UI | Custom React admin is read-only; mutations require Django Admin |
| 7 | Referral dashboard | **PASS** | `DashboardPage.tsx`, `GET .../dashboard-summary/`, filter/search on `ReferralViewSet` | Counts from API; search/status filters wired; empty/loading/error states | Pagination still page-size 25; facility filter UI not exposed |
| 8 | Create & edit referral | **PASS** | `NewReferralPage.tsx`, `CapabilityNeedsInput.tsx`, `ReferralCaseCreateSerializer` | Create + documentation ternary; clickable capability chips for confirmed needs | Full edit form for observations/treatments limited |
| 9 | Source document intake | **PASS** | `evidence/views.py`, detail upload UI | Type/size validation; malformed JSON rejected (test); permissions + list scoping; OCR explicitly unsupported; upload invalidates verification | No OCR/handwriting; PDF/images stored unparsed |
| 10 | Structured extraction | **PARTIAL** | `agents/providers.py` `FactExtractionResult`, `agents/pipeline.py` | Schema + repair retry; live uses configured provider; mock labelled | LLM extraction lightly used vs deterministic rules; units/timestamps only when present in payload |
| 11 | Missing-information checks | **PASS** | `referrals/verification.py`, `agents/policy/provisional_checklist_manifest.json` | Versioned provisional checklist; rule IDs; absence stated; provisional label on findings | Provisional — not GHS-validated |
| 12 | Cross-record inconsistency | **PARTIAL** | `verification.py` (GA, BP, allergy) | Conflicting values + citations; no silent winner | Legitimate timestamped updates not fully modelled for BP; patient-ID conflicts limited |
| 13 | Purposeful agent workflow | **PASS** | `agents/pipeline.py`, `AgentRun`/`AgentTraceEvent`, `trajectories/` | Deterministic checks + one structured LLM pass; traces recorded; tools limited | Not seven separate agents; facility match/handoff are separate gated APIs |
| 14 | Prompt-injection resistance | **PASS** | `verification.py` SECURITY finding; seeded `EVAL-SEC`; system prompt treats content as data; pytest | Injection narrative → SECURITY finding; no tool URL/command execution in provider | Not a formal red-team suite |
| 15 | Findings & evidence review | **PASS** | `ReferralDetailPage.tsx`, finding serializer | Category, severity, citations, resolution, rule vs AI-assisted label | Source text inspection limited to citation JSON, not full document viewer |
| 16 | Human resolution of findings | **PASS** | `resolve_finding`, UI Confirm/Dismiss, audit | Note required; actor/timestamp; unauth cannot resolve (auth required); evidence upload clears approval | “Correction” edits underlying fields via separate draft/edit paths, not inline on finding |
| 17 | Facility capabilities | **PASS** | `match-facilities` | Compares clinician-confirmed needs; matched/missing/unknown + explanations; no auto diagnosis | Ranking is synthetic distance/coverage heuristic |
| 18 | Facility availability | **PASS** | `facilities` models/views, Availability console, freezegun test | Status, reporter, timestamps, expiry; coordinator write; stale ≠ confirmed; simulated | Staff online ≠ availability (documented) |
| 19 | Receiving-facility response | **PASS** | `accept` action; UI accept/decline | Separate match vs accept; explicit decision; actor/timestamp; simulation only | Decline UI uses top match facility; no real messaging |
| 20 | Verified handover summary | **PASS** | `handoff` / `HandoffPage` / `PrintSummaryPage` | Documented facts vs unresolved; fully_verified gate; synthetic label | Print CSS not pixel-audited |
| 21 | Incomplete emergency handover | **PASS** | `export-incomplete` + UI | Explicit action; reason audited; never fully verified; tested | — |
| 22 | Workflow states & concurrency | **PASS** | `ReferralCase.transition_to`, `workflowGates.ts`, `WorkflowControls.tsx`, `views.py` approve/accept gates | UI grey-out + backend ordering; 4 workflow gate API tests | Not every transition edge has HTTP-level duplicate-click tests |
| 23 | Audit history | **PASS** | `AuditEvent`, timeline; admin append-only | Key actions audited; ordinary users no mutate API; admin cannot edit/delete audit | Not cryptographically tamper-proof (disclosed) |
| 24 | Live LLM integration | **PASS** | `agents/providers.py`, settings LLM_*, `verify_llm` | Live refuses silent mock fallback; Groq `openai/gpt-oss-120b` connectivity OK; full live eval run 2026-08-31 | Rate-limit/timeout paths not exhaustively integration-tested |
| 25 | Mock & replay modes | **PASS** | `get_provider`, evaluation commands, trajectories | Mock labelled; replay uses stored artifacts; docs distinguish modes | Replay corpus still starter-sized |
| 26 | Baseline | **PASS** | `run_baseline` | Same cases/policy; live baseline run 2026-08-31 → `baseline-live.*` (recall 0.0) | Baseline is intentionally weak single-prompt method |
| 27 | Evaluation dataset | **PASS** | `ground_truth.json` (`frozen: true`), bootstrap EVAL-01…12 | 12 cases; EVAL-01 negative; GT not passed to workflows | Expert clinical authorship of GT: **not claimed** |
| 28 | Measured improvement | **PASS** | `evaluation/results/comparison-live.*`, scoring | Live: baseline recall 0.0 → agent 1.0 (12 synthetic cases, Groq gpt-oss-120b) | Synthetic suite only — not clinical efficacy |
| 29 | Iteration changelog | **PASS** | `IMPROVEMENT_CHANGELOG.md`, this audit | Documents decisions and failure insight | Further live iteration effects not measured |
| 30 | Figma-aligned frontend | **BLOCKED** | `frontend/src/**`, `RUN_AND_TEST_GUIDE.md` | No Figma MCP/access; visual parity **unverified** | Provide exports for Foundations + Product Screens |
| 31 | Responsiveness & a11y | **PARTIAL** | labels, focus styles, loading disabled buttons, status not colour-only (badges+text) | Manual spot-check only; build succeeds | No axe/a11y automated suite; unsaved-edit guard incomplete |
| 32 | Security & git hygiene | **PASS** | `.gitignore`, `.env.example`, `SECURITY.md`, CSRF/CORS/hosts | `.env`/sqlite/media ignored; secrets not in frontend | Not production-certified; scan history for leaked keys if any were pasted in chat |
| 33 | Automated & E2E tests | **PARTIAL** | `backend/referrals/tests/`, `backend/accounts/tests/`, `frontend/src/smoke.test.ts`, CI | pytest **23 passed** (2026-08-31); vitest 1 passed; build 0 | No full browser E2E; live provider tests optional/not run |
| 34 | Run and test guide | **PASS** | `RUN_AND_TEST_GUIDE.md`, `REPRODUCTION.md` | Updated with audit commands | Fresh isolated clone still **not verified** |
| 35 | Submission readiness | **PARTIAL** | `SUBMISSION_CHECKLIST.md`, `CLONE_TEST_GUIDE.md`, live eval artifacts | Code, tests, workflow gates, live comparison, docs complete | Video recording, portal upload, key rotation |

---

## Fixes applied in this audit

1. Facility-scoped coordinator object access + queryset (matched/accepted receiving sites).
2. `IsReferralParticipant` so coordinators can use referral accept APIs.
3. Dashboard summary endpoint + search/status filters in UI.
4. Findings resolve UI (confirm / accept-risk) with required notes + audit.
5. Evidence list scoping, JSON parse rejection, upload invalidates `fully_verified` + approvals; upload UI.
6. Analyse uses configured `LLM_PROVIDER` (no hardcoded silent mock).
7. Admin user list super-admin only; Django Admin audits user/facility saves; AuditEvent append-only.
8. Documentation status ternary on new referral (unknown / not recorded / explicit negative).
9. Decline (simulation) action on awaiting acceptance.
10. Expanded pytest suite + `freezegun` + root `conftest.py` dotenv load.
11. Clickable capability-needs picker on new referral form.
12. Strict workflow gating (UI grey-out + API approve/accept ordering; handoff blocked until accepted).

---

## Honest bottom line

The product spine is a **rules-first documentation verification workflow** with a **bounded LLM extraction assist**, session auth, synthetic facilities, and **live-measured** evaluation (baseline 0.0 → agent 1.0 recall on 12 synthetic cases). Remaining submission gaps are **owner tasks**: demo video, portal upload, API key hygiene — see `CLONE_TEST_GUIDE.md` and `SUBMISSION_CHECKLIST.md`.
