import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi, type BenchmarkCaseRow } from "@/api/client";

export function AdminEvaluationPage() {
  const qc = useQueryClient();
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-benchmark"],
    queryFn: () => adminApi.benchmark(),
  });

  const runEval = useMutation({
    mutationFn: ({ method, mode }: { method: "baseline" | "agent"; mode: "mock" | "live" }) =>
      adminApi.runEvaluation(method, mode),
    onSuccess: (res) => {
      setRunMsg(`${res.method} (${res.mode}) completed.`);
      void qc.invalidateQueries({ queryKey: ["admin-benchmark"] });
    },
    onError: (e: Error) => setRunMsg(e.message),
  });

  const comp = data?.artifacts?.comparison_live?.summary;
  const baseline = data?.artifacts?.baseline_live?.summary;
  const agent = data?.artifacts?.agent_live?.summary;

  return (
    <div className="space-y-5">
      <div className="rg-panel p-5">
        <h2 className="text-lg font-semibold">Baseline vs agent benchmark</h2>
        <p className="text-sm text-rg-muted mt-1 leading-relaxed">
          Full transparency for judges: what the weak baseline is, what the LLM actually does, and
          measured scores on the frozen 12-case synthetic suite.
        </p>
      </div>

      {isLoading ? <p className="text-rg-muted">Loading benchmark…</p> : null}
      {isError ? (
        <button type="button" className="rg-btn-secondary" onClick={() => void refetch()}>
          Retry
        </button>
      ) : null}

      {data ? (
        <>
          <div className="grid md:grid-cols-3 gap-3">
            <MetricCard
              title="Baseline (live)"
              subtitle="Single direct LLM prompt — intentionally weak"
              recall={baseline?.micro_recall}
              precision={baseline?.micro_precision}
              mode={baseline?.mode}
              model={baseline?.model_name}
            />
            <MetricCard
              title="Agent pipeline (live)"
              subtitle="Rules + bounded LLM extraction"
              recall={agent?.micro_recall}
              precision={agent?.micro_precision}
              mode={agent?.mode}
              model={agent?.model_name}
            />
            <MetricCard
              title="Improvement"
              subtitle={data.primary_metric || "critical omission recall"}
              recall={comp?.comparison?.agent_micro_recall}
              extra={`Baseline recall: ${comp?.comparison?.baseline_micro_recall ?? "—"}`}
              highlight
            />
          </div>

          <div className="rg-panel p-5 space-y-3 text-sm">
            <h3 className="font-semibold">Architecture (plain English)</h3>
            <p>
              <strong>Baseline:</strong> {data.architecture.baseline}
            </p>
            <p>
              <strong>Agent:</strong> {data.architecture.agent}
            </p>
            <p>
              <strong>LLM role:</strong> {data.architecture.llm_role}
            </p>
            <p className="text-rg-muted text-xs border-t border-rg-border pt-3">{data.disclaimer}</p>
          </div>

          <div className="rg-panel p-5">
            <h3 className="font-semibold text-sm mb-2">Current LLM configuration</h3>
            <dl className="grid sm:grid-cols-2 gap-2 text-sm">
              <Row label="Provider" value={data.current_llm.provider} />
              <Row label="Model" value={data.current_llm.model || "—"} />
              <Row label="Base URL" value={data.current_llm.base_url || "—"} />
              <Row
                label="API key"
                value={data.current_llm.api_key_configured ? "Set in .env" : "Not set"}
              />
            </dl>
            <p className="text-xs text-rg-muted mt-3">
              Edit provider/model in Admin → Settings. API keys never stored in the database.
            </p>
          </div>

          <div className="rg-panel p-5">
            <h3 className="font-semibold text-sm mb-3">Run evaluation from admin</h3>
            <p className="text-xs text-rg-muted mb-3">
              Mock runs are fast (offline). Live runs call your configured LLM and may take several
              minutes.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rg-btn-secondary"
                disabled={runEval.isPending}
                onClick={() => runEval.mutate({ method: "baseline", mode: "mock" })}
              >
                Run baseline (mock)
              </button>
              <button
                type="button"
                className="rg-btn-secondary"
                disabled={runEval.isPending}
                onClick={() => runEval.mutate({ method: "agent", mode: "mock" })}
              >
                Run agent (mock)
              </button>
              <button
                type="button"
                className="rg-btn"
                disabled={runEval.isPending}
                onClick={() => runEval.mutate({ method: "baseline", mode: "live" })}
              >
                Run baseline (live)
              </button>
              <button
                type="button"
                className="rg-btn"
                disabled={runEval.isPending}
                onClick={() => runEval.mutate({ method: "agent", mode: "live" })}
              >
                Run agent (live)
              </button>
            </div>
            {runMsg ? <p className="text-sm mt-3 text-rg-muted">{runMsg}</p> : null}
          </div>

          {data.artifacts?.comparison_live?.cases ? (
            <div className="rg-panel overflow-x-auto">
              <h3 className="font-semibold text-sm px-5 pt-5 pb-2">Per-case results (live agent)</h3>
              <table className="w-full text-sm text-left">
                <thead className="text-rg-muted border-b border-rg-border bg-[#f7fafb]">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Case</th>
                    <th className="px-4 py-2 font-semibold">Recall</th>
                    <th className="px-4 py-2 font-semibold">Precision</th>
                    <th className="px-4 py-2 font-semibold">Ready OK</th>
                  </tr>
                </thead>
                <tbody>
                  {data.artifacts.comparison_live.cases.map((c: BenchmarkCaseRow) => (
                    <tr key={c.case_id} className="border-t border-rg-border">
                      <td className="px-4 py-2 font-mono">{c.case_id}</td>
                      <td className="px-4 py-2">{c.recall}</td>
                      <td className="px-4 py-2">{c.precision}</td>
                      <td className="px-4 py-2">{c.readiness_correct ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  subtitle,
  recall,
  precision,
  mode,
  model,
  extra,
  highlight,
}: {
  title: string;
  subtitle: string;
  recall?: number;
  precision?: number;
  mode?: string;
  model?: string;
  extra?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rg-panel p-4 ${highlight ? "ring-2 ring-rg-accent/40" : ""}`}
      style={highlight ? { background: "var(--rg-accent-soft)" } : undefined}
    >
      <p className="text-xs uppercase tracking-wide text-rg-muted">{title}</p>
      <p className="text-sm font-medium mt-1">{subtitle}</p>
      <p className="text-3xl font-semibold mt-3 text-rg-accent">
        {recall != null ? recall.toFixed(2) : "—"}
      </p>
      <p className="text-xs text-rg-muted mt-1">Micro recall</p>
      {precision != null ? (
        <p className="text-xs text-rg-muted">Precision: {precision.toFixed(2)}</p>
      ) : null}
      {mode ? <p className="text-xs text-rg-muted">Mode: {mode}</p> : null}
      {model ? <p className="text-xs text-rg-muted truncate">Model: {model}</p> : null}
      {extra ? <p className="text-xs mt-2 font-medium">{extra}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-rg-muted text-xs uppercase">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
