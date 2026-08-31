# Data dictionary (summary)

All primary keys are UUIDs. Timestamps are timezone-aware (UTC).

## accounts.User

| Field | Type | Notes |
|-------|------|-------|
| email | Email unique | Username field |
| full_name | string | |
| role | enum | SUPER_ADMIN, CLINICIAN, FACILITY_COORDINATOR, QUALIFIED_REVIEWER (label only) |
| facility | FK nullable | |
| is_active | bool | |

## facilities

- **Facility** — fictional name, type, district, region, synthetic lat/lon, phone placeholder
- **Capability** — code/name (OB_CLINICIAN, THEATRE, BLOOD_BANK, NEONATAL, …)
- **FacilityCapability** — link + availability_state
- **AvailabilityUpdate** — state, confirmed_by/at, expires_at, notes (service-level only)

## referrals

- **ReferralCase** — status state machine, workflow_version, clinical fields, fully_verified, incomplete export audit
- **ClinicalObservation / TreatmentEvent** — typed clinical events with source_reference
- **ReferralDraft** — versioned structured_content + narrative
- **ReferralFinding** — category, severity, citations or absence_stated, resolution_state
- **Clarification**, **FacilityMatch**, **AcceptanceRecord**, **TimelineEvent**, **ClinicianApproval**, **AuditEvent**

## evidence

- **EvidenceDocument** — safe path, MIME, checksum, randomized stored filename
- **EvidenceFact** — normalized fact + mandatory source_citation

## agents

- **AgentRun** — stage, provider, latency, mock/replay flags
- **AgentTraceEvent** — observable actions only (no hidden chain-of-thought)

## evaluation

- **EvaluationRun** — method baseline/agent, mode mock/live/replay, summary JSON, NOT_RUN reason
