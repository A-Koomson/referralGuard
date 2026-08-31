import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";
import { useActionSuccess } from "@/hooks/useActionSuccess";

type Overview = {
  referral_cases: number;
  facilities: number;
  users: number;
  agent_runs: number;
  agent_succeeded: number;
  agent_failed: number;
  mock_runs: number;
  live_runs: number;
  evaluation_runs: number;
  disclaimer: string;
};

export function AdminOverviewPage() {
  const { trigger, isSuccess } = useActionSuccess();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api<Overview>("/api/v1/admin/overview/"),
  });

  if (isLoading) return <p className="text-rg-muted">Loading overview…</p>;
  if (isError || !data) {
    return (
      <div className="rg-panel p-5">
        <p className="text-rg-critical text-sm">Could not load admin overview.</p>
        <ActionButton
          variant="secondary"
          className="mt-3"
          success={isSuccess("retry")}
          onClick={() => {
            void refetch();
            trigger("retry");
          }}
        >
          Retry
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rg-panel p-5">
        <h2 className="text-lg font-semibold">System overview</h2>
        <p className="text-sm text-rg-muted mt-1">{data.disclaimer}</p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat label="Referral cases" value={data.referral_cases} />
        <Stat label="Facilities" value={data.facilities} />
        <Stat label="Active users" value={data.users} />
        <Stat label="Evaluation runs" value={data.evaluation_runs} />
        <Stat label="Agent runs" value={data.agent_runs} />
        <Stat label="Succeeded" value={data.agent_succeeded} />
        <Stat label="Failed" value={data.agent_failed} />
        <Stat label="Live LLM runs" value={data.live_runs} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/admin/evaluation" className="rg-btn">
          Evaluation benchmark
        </Link>
        <Link to="/admin/referrals" className="rg-btn-secondary">
          Manage referrals
        </Link>
        <Link to="/admin/settings" className="rg-btn-secondary">
          Settings
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rg-panel p-4">
      <div className="text-xs text-rg-muted uppercase tracking-wide font-semibold">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
