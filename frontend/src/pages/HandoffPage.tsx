import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { referralsApi } from "@/api/client";
import { StatusBadge } from "@/components/StatusBadge";

type HandoffPayload = {
  synthetic_case_id: string;
  patient_display_label: string;
  urgency: string;
  status: string;
  fully_verified: boolean;
  referral_reason: string;
  gestational_age_weeks: string | number | null;
  gravida: number | null;
  para: number | null;
  creating_facility: string;
  clinician_confirmed_needs: string[];
  incomplete_export_reason: string;
  incomplete_exported_at: string | null;
  clinician_approval: {
    approved_at: string;
    attestation: string;
    approved_by: string;
  } | null;
  acceptance: {
    decision: string;
    confirmer_role: string;
    confirmed_at: string;
    reference: string;
    instructions: string;
    facility: string;
  } | null;
  top_match: {
    facility_name: string;
    rank: number;
    distance_km: number | null;
    availability_freshness: string;
    explanation: string;
    capability_coverage: Record<
      string,
      { present?: boolean; state?: string; fresh?: boolean }
    >;
  } | null;
  findings: Array<{
    id: string;
    category: string;
    severity: string;
    message: string;
    resolution_state: string;
    absence_stated: boolean;
    evidence_citations: unknown[];
  }>;
  open_finding_count: number;
  observations: Array<{
    id: string;
    observation_type: string;
    value: string;
    unit: string;
    observed_at: string | null;
  }>;
  treatments: Array<{
    id: string;
    treatment_name: string;
    dose: string;
    route: string;
    administered_at: string | null;
  }>;
  generated_at: string;
  disclaimer: string;
};

export function HandoffPage() {
  const { id = "" } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["handoff", id],
    queryFn: () => referralsApi.handoff(id) as Promise<HandoffPayload>,
    enabled: Boolean(id),
  });

  if (isLoading) return <p className="text-rg-muted">Preparing handoff packet…</p>;
  if (isError || !data) {
    return (
      <div className="rg-panel p-5" role="alert">
        <p className="text-rg-critical">Could not load handoff.</p>
        <button type="button" className="rg-btn-secondary mt-3" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (data.status !== "ACCEPTED") {
    return (
      <div className="rg-panel p-6 max-w-xl mx-auto space-y-4 rg-fade-up">
        <h1 className="text-xl font-semibold">Handoff not available yet</h1>
        <p className="text-sm text-rg-muted leading-relaxed">
          Handoff unlocks after facility acceptance is confirmed. Complete matching, clinician
          approval, and acceptance on the referral page first.
        </p>
        <p className="text-sm">
          Current status: <StatusBadge value={data.status} />
        </p>
        <Link className="rg-btn" to={`/referrals/${id}`}>
          Back to referral workflow
        </Link>
      </div>
    );
  }

  const coverage = data.top_match?.capability_coverage || {};

  return (
    <div className="rg-fade-up space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-rg-muted font-semibold">
            Receiving facility packet
          </p>
          <h1 className="text-2xl font-semibold mt-1">Emergency referral handoff</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rg-btn" onClick={() => window.print()}>
            Print / save PDF
          </button>
          <Link className="rg-btn-secondary" to={`/referrals/${id}`}>
            Back to case
          </Link>
        </div>
      </div>

      <article className="rg-panel overflow-hidden print:shadow-none">
        <header
          className="px-6 py-5 text-white"
          style={{
            background: "linear-gradient(135deg, var(--rg-navy) 0%, var(--rg-navy-2) 100%)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-white/60">ReferralGuard</p>
              <h2 className="text-xl font-semibold mt-1">Maternity emergency handoff</h2>
              <p className="text-sm text-white/75 mt-1">{data.synthetic_case_id}</p>
            </div>
            <div className="text-right space-y-1">
              <StatusBadge value={data.status} />
              <div className="text-sm">
                {data.fully_verified ? (
                  <span className="text-emerald-200 font-medium">Fully verified label</span>
                ) : (
                  <span className="text-amber-200 font-medium">Not fully verified</span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div
          className="px-6 py-3 text-sm border-b border-rg-border"
          style={{ background: data.fully_verified ? "var(--rg-ok-soft)" : "var(--rg-warning-soft)" }}
        >
          {data.fully_verified
            ? "Documentation checks and clinician approval recorded for this prototype packet."
            : "This packet is incomplete or unverified. Do not treat missing items as confirmed."}
          {data.incomplete_export_reason
            ? ` Incomplete export reason: ${data.incomplete_export_reason}`
            : ""}
        </div>

        <div className="p-6 space-y-8">
          <section>
            <SectionTitle>1. Transfer summary</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-4 text-sm mt-3">
              <Field label="Patient label" value={data.patient_display_label} />
              <Field label="Urgency" value={data.urgency} />
              <Field label="Referring facility" value={data.creating_facility} />
              <Field
                label="Gestational age"
                value={
                  data.gestational_age_weeks != null
                    ? `${data.gestational_age_weeks} weeks`
                    : "Not documented"
                }
              />
              <Field
                label="Gravida / Para"
                value={`${data.gravida ?? "—"} / ${data.para ?? "—"}`}
              />
              <Field
                label="Packet generated"
                value={new Date(data.generated_at).toLocaleString()}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Referral reason"
                  value={data.referral_reason || "Not documented"}
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Clinician-confirmed capability needs"
                  value={
                    data.clinician_confirmed_needs?.length
                      ? data.clinician_confirmed_needs.join(", ")
                      : "None recorded"
                  }
                />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle>2. Receiving facility match</SectionTitle>
            {data.top_match ? (
              <div className="mt-3 space-y-3 text-sm">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Proposed destination" value={data.top_match.facility_name} />
                  <Field label="Rank" value={`#${data.top_match.rank}`} />
                  <Field
                    label="Distance (synthetic)"
                    value={
                      data.top_match.distance_km != null
                        ? `${data.top_match.distance_km} km`
                        : "—"
                    }
                  />
                  <Field
                    label="Availability freshness"
                    value={data.top_match.availability_freshness}
                  />
                </div>
                <p className="text-rg-muted leading-relaxed">{data.top_match.explanation}</p>
                <div className="overflow-x-auto border border-rg-border rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead style={{ background: "#f7fafb" }}>
                      <tr>
                        <th className="px-3 py-2 font-semibold">Need</th>
                        <th className="px-3 py-2 font-semibold">Present</th>
                        <th className="px-3 py-2 font-semibold">State</th>
                        <th className="px-3 py-2 font-semibold">Fresh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(coverage).map(([code, row]) => (
                        <tr key={code} className="border-t border-rg-border">
                          <td className="px-3 py-2 font-medium">{code}</td>
                          <td className="px-3 py-2">{row.present ? "Yes" : "No"}</td>
                          <td className="px-3 py-2">{row.state || "—"}</td>
                          <td className="px-3 py-2">
                            {row.fresh === true ? "Fresh" : row.fresh === false ? "Stale" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-rg-muted mt-2">No facility match recorded yet.</p>
            )}
          </section>

          <section>
            <SectionTitle>3. Human confirmation</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-4 text-sm mt-3">
              <Field
                label="Clinician approval"
                value={
                  data.clinician_approval
                    ? `Recorded ${new Date(data.clinician_approval.approved_at).toLocaleString()}`
                    : "Not recorded"
                }
              />
              <Field
                label="Facility acceptance"
                value={
                  data.acceptance
                    ? `${data.acceptance.decision} · ${new Date(data.acceptance.confirmed_at).toLocaleString()}`
                    : "Not recorded"
                }
              />
              {data.acceptance?.reference ? (
                <Field label="Acceptance reference" value={data.acceptance.reference} />
              ) : null}
              {data.acceptance?.instructions ? (
                <div className="sm:col-span-2">
                  <Field label="Receiving instructions" value={data.acceptance.instructions} />
                </div>
              ) : null}
              {data.clinician_approval?.attestation ? (
                <div className="sm:col-span-2">
                  <Field label="Attestation" value={data.clinician_approval.attestation} />
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <SectionTitle>4. Clinical observations & treatments</SectionTitle>
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              <div className="border border-rg-border rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-2">Observations</h3>
                {data.observations?.length ? (
                  <ul className="space-y-2 text-sm">
                    {data.observations.map((o) => (
                      <li key={o.id}>
                        <span className="font-medium">{o.observation_type}</span>: {o.value}
                        {o.unit ? ` ${o.unit}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-rg-muted">None recorded on this case.</p>
                )}
              </div>
              <div className="border border-rg-border rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-2">Treatments</h3>
                {data.treatments?.length ? (
                  <ul className="space-y-2 text-sm">
                    {data.treatments.map((t) => (
                      <li key={t.id}>
                        <span className="font-medium">{t.treatment_name}</span>
                        {t.dose ? ` · ${t.dose}` : ""}
                        {t.route ? ` · ${t.route}` : ""}
                        <div className="text-xs text-rg-muted">
                          {t.administered_at
                            ? new Date(t.administered_at).toLocaleString()
                            : "Administration time missing"}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-rg-muted">None recorded on this case.</p>
                )}
              </div>
            </div>
          </section>

          <section>
            <SectionTitle>
              5. Verification findings ({data.open_finding_count} open)
            </SectionTitle>
            {data.findings?.length ? (
              <ul className="mt-3 space-y-2">
                {data.findings.map((f) => (
                  <li
                    key={f.id}
                    className="border border-rg-border rounded-lg p-3 text-sm"
                    style={
                      f.severity === "CRITICAL"
                        ? { borderLeft: "3px solid var(--rg-critical)" }
                        : undefined
                    }
                  >
                    <div className="flex flex-wrap gap-2 mb-1">
                      <StatusBadge value={f.severity} />
                      <StatusBadge value={f.category} />
                      <span className="text-xs text-rg-muted self-center">
                        {f.resolution_state}
                      </span>
                    </div>
                    <p>{f.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-rg-muted mt-2">
                No verification findings recorded on this packet.
              </p>
            )}
          </section>

          <section className="border-t border-rg-border pt-4 text-xs text-rg-muted leading-relaxed">
            <p className="font-semibold text-rg-ink mb-1">Safety notice</p>
            <p>{data.disclaimer}</p>
            <p className="mt-2">
              This handoff supports documentation verification only. It does not diagnose, select
              treatment, or confirm real-world bed capacity. Stale availability must not be treated
              as confirmed.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-sm font-semibold uppercase tracking-[0.08em] pb-2 border-b border-rg-border"
      style={{ color: "var(--rg-accent)" }}
    >
      {children}
    </h3>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-rg-muted font-semibold">{label}</dt>
      <dd className="mt-1 text-rg-ink">{value}</dd>
    </div>
  );
}
