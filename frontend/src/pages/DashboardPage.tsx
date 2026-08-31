import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { referralsApi } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";
import { StatusBadge } from "@/components/StatusBadge";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { useActionSuccess } from "@/hooks/useActionSuccess";

export function DashboardPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState({ search: "", status: "" });
  const { trigger, isSuccess } = useActionSuccess();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["referrals", applied],
    queryFn: () =>
      referralsApi.list({
        search: applied.search || undefined,
        status: applied.status || undefined,
        ordering: "-updated_at",
      }),
  });

  const summary = useQuery({
    queryKey: ["referral-summary"],
    queryFn: () => referralsApi.dashboardSummary(),
  });

  const stats = useMemo(
    () => ({
      total: summary.data?.total ?? data?.count ?? 0,
      needsWork: summary.data?.needs_attention ?? 0,
      verified: summary.data?.fully_verified ?? 0,
      emergency: summary.data?.emergency ?? 0,
    }),
    [summary.data, data?.count],
  );

  return (
    <div className="space-y-7 rg-fade-up">
      <section className="rg-panel overflow-hidden grid lg:grid-cols-[1.4fr_1fr]">
        <div className="p-7 sm:p-8">
          <p
            className="text-xs font-semibold uppercase tracking-[0.16em] mb-2"
            style={{ color: "var(--rg-accent)" }}
          >
            Clinician workspace
          </p>
          <h1 className="text-3xl font-semibold leading-tight">Referral operations</h1>
          <p className="text-sm text-rg-muted mt-2 max-w-xl">
            Verify documentation, resolve findings with evidence, and keep handoff labels honest
            before transfer.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/referrals/new" className="rg-btn">
              New referral
            </Link>
            <Link to="/facilities" className="rg-btn-secondary">
              Facilities
            </Link>
          </div>
        </div>
        <HeroBackdrop className="relative min-h-[200px] border-t lg:border-t-0 lg:border-l border-rg-border">
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white z-10">
            <p className="text-xs uppercase tracking-[0.14em] text-white/70">Context</p>
            <p className="text-sm font-medium mt-1">
              Synthetic environment · service-level availability only
            </p>
          </div>
        </HeroBackdrop>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 rg-stagger">
        <Stat label="Open cases" value={stats.total} accent="var(--rg-accent)" />
        <Stat label="Needs attention" value={stats.needsWork} accent="var(--rg-warning)" />
        <Stat label="Emergency" value={stats.emergency} accent="var(--rg-critical)" />
        <Stat label="Fully verified*" value={stats.verified} accent="var(--rg-ok)" />
      </div>

      <form
        className="rg-panel p-4 flex flex-col sm:flex-row gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ search: search.trim(), status });
          trigger("filter");
        }}
      >
        <div className="flex-1">
          <label className="rg-label" htmlFor="dash-search">
            Search identifier / reason
          </label>
          <input
            id="dash-search"
            className="rg-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="EVAL-03 or postpartum…"
          />
        </div>
        <div className="sm:w-56">
          <label className="rg-label" htmlFor="dash-status">
            Status
          </label>
          <select
            id="dash-status"
            className="rg-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="NEEDS_CLARIFICATION">Needs clarification</option>
            <option value="READY_FOR_MATCHING">Ready for matching</option>
            <option value="AWAITING_ACCEPTANCE">Awaiting acceptance</option>
            <option value="ACCEPTED">Accepted</option>
          </select>
        </div>
        <div className="flex items-end">
          <ActionButton
            type="submit"
            className="w-full sm:w-auto"
            success={isSuccess("filter")}
            successLabel="Applied"
          >
            Apply filters
          </ActionButton>
        </div>
      </form>

      {isLoading ? <SkeletonRows /> : null}
      {isError ? <ErrorState onRetry={() => void refetch()} /> : null}
      {!isLoading && !isError && data?.results.length === 0 ? <EmptyState /> : null}

      {data?.results?.length ? (
        <div className="rg-panel overflow-hidden">
          <div
            className="px-4 py-3.5 border-b border-rg-border flex items-center justify-between"
            style={{ background: "linear-gradient(90deg, #f4fafb, #ffffff)" }}
          >
            <h2 className="text-base font-semibold">Referrals</h2>
            {isFetching ? <span className="text-xs text-rg-muted">Refreshing…</span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-rg-muted" style={{ background: "#f7fafb" }}>
                <tr>
                  <th className="px-4 py-3 font-semibold">Case</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Urgency</th>
                  <th className="px-4 py-3 font-semibold">Verification</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="rg-table-body">
                {data.results.map((r) => (
                  <tr key={r.id} className="rg-table-row border-t border-rg-border hover:bg-[#f4fafb]">
                    <td className="px-4 py-3">
                      <Link
                        className="font-semibold text-rg-accent hover:underline"
                        to={`/referrals/${r.id}`}
                      >
                        {r.synthetic_case_id}
                      </Link>
                      <div className="text-xs text-rg-muted mt-0.5">{r.patient_display_label}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={r.urgency} />
                    </td>
                    <td className="px-4 py-3">
                      {r.fully_verified ? (
                        <span className="text-rg-ok font-medium">Fully verified*</span>
                      ) : (
                        <span className="text-rg-muted">Not fully verified</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-rg-muted whitespace-nowrap">
                      {new Date(r.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-rg-muted">
        *Fully verified indicates completed documentation checks and clinician approval in this
        prototype. It is not medical clearance. Counts come from{" "}
        <code className="text-[11px]">/api/v1/referrals/dashboard-summary/</code>.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rg-panel rg-stat-card p-4 border-l-4" style={{ borderLeftColor: accent }}>
      <div className="text-xs text-rg-muted uppercase tracking-wide font-semibold">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading referrals">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 rg-skeleton" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rg-panel p-10 text-center">
      <p className="font-semibold">No referrals yet</p>
      <p className="text-sm text-rg-muted mt-1">Create a synthetic referral to begin.</p>
      <Link to="/referrals/new" className="rg-btn mt-5 inline-flex">
        New referral
      </Link>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { trigger, isSuccess } = useActionSuccess();
  return (
    <div className="rg-panel p-5" role="alert">
      <p className="text-rg-critical text-sm">Could not load referrals.</p>
      <ActionButton
        variant="secondary"
        className="mt-3"
        success={isSuccess("retry")}
        onClick={() => {
          void onRetry();
          trigger("retry");
        }}
      >
        Retry
      </ActionButton>
    </div>
  );
}
