import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";
import { useActionSuccess } from "@/hooks/useActionSuccess";

type AgentRun = {
  id: string;
  pipeline_stage: string;
  provider: string;
  status: string;
  is_mock: boolean;
  latency_ms: number | null;
  created_at: string;
};

export function AdminAgentsPage() {
  const { trigger, isSuccess } = useActionSuccess();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-agent-runs"],
    queryFn: () => api<AgentRun[]>("/api/v1/agent-runs/"),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Agent runs</h2>
      {isLoading ? <p className="text-rg-muted">Loading…</p> : null}
      {isError ? (
        <ActionButton
          variant="secondary"
          success={isSuccess("retry")}
          onClick={() => {
            void refetch();
            trigger("retry");
          }}
        >
          Retry
        </ActionButton>
      ) : null}
      <div className="rg-panel overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-rg-muted border-b border-rg-border" style={{ background: "#f7fafb" }}>
            <tr>
              <th className="px-4 py-3 font-semibold">Stage</th>
              <th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Mode</th>
              <th className="px-4 py-3 font-semibold">Latency</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((run) => (
              <tr key={run.id} className="border-t border-rg-border">
                <td className="px-4 py-3">{run.pipeline_stage}</td>
                <td className="px-4 py-3">{run.provider}</td>
                <td className="px-4 py-3">{run.status}</td>
                <td className="px-4 py-3">{run.is_mock ? "MOCK" : "LIVE/REPLAY"}</td>
                <td className="px-4 py-3">{run.latency_ms != null ? `${run.latency_ms} ms` : "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(run.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {!isLoading && !(data || []).length ? (
              <tr>
                <td className="px-4 py-6 text-rg-muted" colSpan={6}>
                  No agent runs yet. Analyse a referral to create traces.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
