# FacilityMatchingAgent (API stage)

Not an autonomous destination selector.

**Inputs:** clinician-confirmed capability need codes; synthetic facility capabilities; availability updates with `expires_at`.

**Behaviour:**

- Rank by fresh capability coverage then distance
- Label freshness `fresh` vs `stale_or_incomplete`
- Explanation states stale capacity is **not** confirmed
- **Never** auto-accepts

**Human checkpoint:** acceptance confirmation by clinician/coordinator with role + reference
