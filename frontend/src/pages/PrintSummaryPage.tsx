import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { referralsApi } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";
import { StatusBadge } from "@/components/StatusBadge";
import { useActionSuccess } from "@/hooks/useActionSuccess";

/** Printable referral summary — omits application navigation via print CSS. */
export function PrintSummaryPage() {
  const { id = "" } = useParams();
  const { trigger, isSuccess } = useActionSuccess();
  const { data, isLoading } = useQuery({
    queryKey: ["referral", id],
    queryFn: () => referralsApi.get(id),
    enabled: Boolean(id),
  });

  if (isLoading) return <p className="p-6 text-rg-muted">Loading summary…</p>;
  if (!data) return <p className="p-6 text-rg-critical">Referral not found.</p>;

  if (data.status !== "ACCEPTED") {
    return (
      <div className="rg-panel p-6 max-w-xl mx-auto space-y-4 m-6">
        <h1 className="text-xl font-semibold">Print summary not available yet</h1>
        <p className="text-sm text-rg-muted leading-relaxed">
          Print summary unlocks after facility acceptance is confirmed.
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

  return (
    <div className="print-root bg-white text-black p-6 max-w-3xl mx-auto">
      <style>{`
        @media print {
          header, footer, nav, .rg-banner, .rg-site-footer, .rg-app-header, .no-print {
            display: none !important;
          }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="border-b border-black/20 pb-4 mb-4">
        <p className="text-xs uppercase tracking-[0.14em]">ReferralGuard</p>
        <h1 className="text-2xl font-semibold mt-1">Emergency maternity referral summary</h1>
        <p className="text-sm mt-2">
          Hackathon prototype — synthetic data — not for clinical use
        </p>
      </div>

      <dl className="grid sm:grid-cols-2 gap-3 text-sm mb-6">
        <div>
          <dt className="text-xs uppercase tracking-wide text-black/60">Case</dt>
          <dd className="font-medium">{data.synthetic_case_id}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-black/60">Status</dt>
          <dd className="font-medium">{data.status}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-black/60">Urgency</dt>
          <dd className="font-medium">{data.urgency}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-black/60">Fully verified label</dt>
          <dd className="font-medium">{data.fully_verified ? "Yes (prototype)" : "No"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-black/60">Patient label</dt>
          <dd className="font-medium">{data.patient_display_label}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-black/60">Referral reason</dt>
          <dd className="font-medium">{data.referral_reason || "(missing)"}</dd>
        </div>
      </dl>

      <h2 className="text-base font-semibold mb-2">Findings</h2>
      {(data.findings || []).length ? (
        <ul className="list-disc pl-5 text-sm space-y-1 mb-6">
          {(data.findings || []).map((f) => (
            <li key={f.id}>
              [{f.severity}] {f.message} — {f.resolution_state}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-black/60 mb-6">No findings recorded.</p>
      )}

      <p className="text-xs text-black/60 border-t border-black/15 pt-3">
        Documentation readiness is not medical clearance. Qualified human review required.
      </p>

      <div className="no-print mt-6 flex gap-2">
        <ActionButton
          type="button"
          success={isSuccess("print")}
          successLabel="Ready"
          onClick={() => {
            window.print();
            trigger("print");
          }}
        >
          Print
        </ActionButton>
        <Link className="rg-btn-secondary" to={`/referrals/${id}/handoff`}>
          Open full handoff
        </Link>
      </div>
    </div>
  );
}
