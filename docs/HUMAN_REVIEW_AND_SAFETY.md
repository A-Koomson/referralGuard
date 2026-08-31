# Human review and safety

## Mandatory principles

1. **Hackathon prototype — synthetic data — not for clinical use** (banner on every major UI surface).
2. Documentation readiness is **not** medical clearance.
3. Blocking applies only to labelling a handoff as **fully verified** — never to real emergency care or transport.
4. Agents must not diagnose, invent missing facts, auto-select destination, or treat synthetic availability as real.
5. Every AI/deterministic conclusion shown in UI includes **evidence** (or explicit absence) and **human-review status**.
6. `QUALIFIED_REVIEWER` is an application role name only — not proof of professional qualification. Expert clinical review, if obtained, must be recorded separately. Default: prototype **not clinically validated**.

## Clinician-controlled incomplete export

- Action: `POST /api/v1/referrals/{id}/export-incomplete/`
- Requires audited reason
- Leaves `fully_verified=false`
- Surfaces unresolved findings; does not mark them verified
- Writes `AuditEvent` + `TimelineEvent`

## Approvals

- Clinician approval attestation stored on `ClinicianApproval`
- Rejected when CRITICAL/MAJOR findings remain OPEN
- **Allowed only after facility matching** (status `AWAITING_ACCEPTANCE` with match records)
- Acceptance confirmation is a separate human step with unique workflow-version token
- **Acceptance requires prior clinician approval** (enforced in API and UI)

## Workflow order (enforced)

1. Run analysis (Draft / Needs clarification)
2. Resolve blocking findings → re-analyse if needed
3. Match facilities (Ready for matching)
4. Clinician approve (Awaiting acceptance)
5. Confirm acceptance (Awaiting acceptance, after approval)
6. Handoff / print (Accepted only)

Locked UI actions show a hover reason. Direct URLs to handoff/print display a gate page until step 6.
