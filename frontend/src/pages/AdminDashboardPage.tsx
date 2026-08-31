import { useQuery } from "@tanstack/react-query";
import { api, referralsApi } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

export function AdminDashboardPage() {
  const { user } = useAuth();
  const referrals = useQuery({ queryKey: ["referrals"], queryFn: () => referralsApi.list() });
  const stats = useQuery({
    queryKey: ["agent-stats"],
    queryFn: () => api<Record<string, number>>("/api/v1/admin/agent-stats/"),
    enabled: user?.role === "SUPER_ADMIN",
  });

  return (
    <div className="rg-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Operations overview</h1>
        <p className="text-sm text-rg-muted max-w-2xl">
          Hackathon visibility dashboard. Authoritative administration remains in Django Admin.
        </p>
      </div>
      <a
        className="rg-btn-secondary inline-flex"
        href="http://127.0.0.1:8000/admin/"
        target="_blank"
        rel="noreferrer"
      >
        Open Django Admin
      </a>
      <dl className="grid sm:grid-cols-3 gap-3 text-sm">
        <Stat label="Referral cases" value={referrals.data?.count ?? "—"} />
        <Stat label="Agent runs" value={stats.data?.total_runs ?? "—"} />
        <Stat label="Succeeded runs" value={stats.data?.succeeded ?? "—"} />
      </dl>
      {user?.role !== "SUPER_ADMIN" ? (
        <p className="text-sm text-rg-muted">
          Agent run statistics require SUPER_ADMIN.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rg-panel p-4">
      <dt className="text-rg-muted text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-2xl font-semibold mt-1 tabular-nums">{value}</dd>
    </div>
  );
}
