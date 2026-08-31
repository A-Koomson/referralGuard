import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";
import { StatusBadge } from "@/components/StatusBadge";
import { useActionSuccess } from "@/hooks/useActionSuccess";

type ConsolePayload = {
  disclaimer: string;
  can_update?: boolean;
  rows: Array<Record<string, unknown>>;
};

export function AvailabilityPage() {
  const { trigger, isSuccess } = useActionSuccess();
  const { data, isLoading, isError, refetch, error } = useQuery({
    queryKey: ["availability-console"],
    queryFn: () => api<ConsolePayload>("/api/v1/availability/console/"),
  });

  return (
    <div className="rg-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Availability console</h1>
        <p className="text-sm text-rg-muted mt-1 max-w-2xl">
          {data?.disclaimer || "Synthetic service-level availability only."}
        </p>
        {data?.can_update === false ? (
          <p className="text-xs text-rg-muted mt-2">
            View-only for your role. Facility coordinators can post availability updates.
          </p>
        ) : null}
      </div>

      {isLoading ? <p className="text-rg-muted">Loading…</p> : null}
      {isError ? (
        <div className="rg-panel p-5">
          <p className="text-sm text-rg-critical">
            Unable to load console
            {error instanceof Error ? `: ${error.message}` : "."}
          </p>
          <ActionButton
            variant="secondary"
            className="mt-2"
            success={isSuccess("retry")}
            onClick={() => {
              void refetch();
              trigger("retry");
            }}
          >
            Retry
          </ActionButton>
        </div>
      ) : null}

      <div className="rg-panel overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-rg-border text-rg-muted" style={{ background: "#f7fafb" }}>
            <tr>
              <th className="px-4 py-3 font-semibold">Facility</th>
              <th className="px-4 py-3 font-semibold">Capability</th>
              <th className="px-4 py-3 font-semibold">State</th>
              <th className="px-4 py-3 font-semibold">Freshness</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows?.map((row, i) => {
              const latest = row.latest_update as { freshness?: string; state?: string } | null;
              const state = String(row.state || "");
              return (
                <tr key={i} className="border-b border-rg-border">
                  <td className="px-4 py-3 font-medium">{String(row.facility_name)}</td>
                  <td className="px-4 py-3">
                    <div>{String(row.capability_code)}</div>
                    <div className="text-xs text-rg-muted">{String(row.capability_name || "")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={state} />
                  </td>
                  <td className="px-4 py-3">
                    {latest?.freshness === "stale" ? (
                      <span className="text-rg-warning font-medium">stale</span>
                    ) : (
                      latest?.freshness || "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {!isLoading && !isError && !(data?.rows?.length) ? (
              <tr>
                <td className="px-4 py-6 text-rg-muted" colSpan={4}>
                  No availability rows found. Run bootstrap_demo to seed facilities.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
