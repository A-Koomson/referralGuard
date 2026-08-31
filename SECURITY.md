# Security Policy — ReferralGuard

## Product threat model (hackathon prototype)

ReferralGuard is a **single-machine demonstration** using **synthetic data only**. It is not a certified multi-hospital production system and is **not for clinical use**.

### Assets

- Session cookies (HttpOnly) and CSRF tokens
- Synthetic referral documentation and evidence uploads
- Agent run traces and evaluation artifacts
- Super-admin credentials (environment-provided, never committed)

### Trust boundaries

- Browser → Vite dev proxy → Django API
- Uploaded files treated as **untrusted data**, never as instructions
- LLM provider (optional live mode) is external; failures must **not** silently fall back to mock

### Threats and mitigations

| Threat | Mitigation |
|--------|------------|
| Session theft / XSS token theft | HttpOnly session cookies; no auth tokens in localStorage |
| CSRF | Django CSRF middleware; trusted origins; double-submit header from cookie |
| Privilege escalation | Server-side role and object permissions on every protected endpoint |
| Prompt injection via uploads/narrative | Allowlisted tools; instruction-like text flagged; no shell/URL/hospital messaging tools |
| Malicious uploads | MIME allowlist, size limit, randomized stored names, executable extensions rejected |
| Secret leakage | `.env` gitignored; sanitized logs; no stack traces to clients in production |
| Duplicate approvals | Workflow-version conditional updates + unique acceptance tokens (SQLite-safe) |
| Treating stale capacity as real | Freshness/expiry on availability; matching explanations never auto-accept |

### Limitations

- SQLite modest concurrency only
- Synthetic facilities and availability
- `QUALIFIED_REVIEWER` is a **role label**, not proof of professional qualification
- Live LLM comparison requires a judge-supplied API key; otherwise mark **NOT RUN**
- Provisional checklist is **not** verified against official GHS guidance unless separately inspected

## Responsible disclosure

Report suspected security issues privately to the repository maintainers. Do not file public issues containing secrets or exploit details for production healthcare systems — this repository contains no live hospital integrations.

## Production checklist (if ever deployed beyond demo)

- `DEBUG=False`
- Strong `DJANGO_SECRET_KEY`
- Restrictive `ALLOWED_HOSTS`, CORS, CSRF origins
- Secure cookies (`Secure`, `HttpOnly`, `SameSite`)
- Dependency scanning in CI
- Do **not** use ephemeral/serverless storage for SQLite without a persistent volume
