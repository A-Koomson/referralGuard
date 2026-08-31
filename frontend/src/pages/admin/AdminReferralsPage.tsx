import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { referralsApi } from "@/api/client";
import { StatusBadge } from "@/components/StatusBadge";

export function AdminReferralsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: () => referralsApi.list(),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Referrals</h2>
      {isLoading ? <p className="text-rg-muted">Loading…</p> : null}
      {isError ? (
        <button type="button" className="rg-btn-secondary" onClick={() => void refetch()}>
          Retry
        </button>
      ) : null}
      <div className="rg-panel overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-rg-muted border-b border-rg-border" style={{ background: "#f7fafb" }}>
            <tr>
              <th className="px-4 py-3 font-semibold">Case</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Urgency</th>
              <th className="px-4 py-3 font-semibold">Verified</th>
            </tr>
          </thead>
          <tbody>
            {data?.results?.map((r) => (
              <tr key={r.id} className="border-t border-rg-border">
                <td className="px-4 py-3">
                  <Link className="text-rg-accent font-medium hover:underline" to={`/referrals/${r.id}`}>
                    {r.synthetic_case_id}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge value={r.status} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge value={r.urgency} />
                </td>
                <td className="px-4 py-3">
                  {r.fully_verified ? "Yes*" : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
