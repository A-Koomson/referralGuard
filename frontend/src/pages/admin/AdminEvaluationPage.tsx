import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { adminApi, type BenchmarkCaseRow } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";

type RunKey = "baseline-mock" | "agent-mock" | "baseline-live" | "agent-live";

function formatMetricLabel(key?: string | null) {
  if (!key) return "Critical omission recall";
  return key.replace(/_/g, " ");
}

export function AdminEvaluationPage() {
  const qc = useQueryClient();
  const [runMsg, setRunMsg] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(
    null,
  );
  const [activeRun, setActiveRun] = useState<RunKey | null>(null);
  const [successRun, setSuccessRun] = useState<RunKey | null>(null);
  const pollRef = useRef<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-benchmark"],
    queryFn: () => adminApi.benchmark(),
    refetchInterval: (query) =>
      (query.state.data as { run_status?: { running?: boolean } } | undefined)?.run_status?.running
        ? 2500
        : false,
  });

  const stopPolling = () => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollUntilDone = (runKey: RunKey) => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const status = await adminApi.evaluationRunStatus();
        if (status.running) return;
        stopPolling();
        setActiveRun(null);
        if (status.error) {
          setRunMsg({ tone: "err", text: status.error });
          setSuccessRun(null);
        } else {
          setRunMsg({
            tone: "ok",
            text: `${status.method} (${status.mode}) completed successfully.`,
          });
          setSuccessRun(runKey);
          window.setTimeout(() => setSuccessRun(null), 1500);
        }
        void qc.invalidateQueries({ queryKey: ["admin-benchmark"] });
      } catch (e) {
        stopPolling();
        setActiveRun(null);
        setRunMsg({ tone: "err", text: e instanceof Error ? e.message : "Status check failed" });
      }
    }, 2000);
  };

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    if (data?.run_status?.running && !pollRef.current) {
      const method = data.run_status.method;
      const mode = data.run_status.mode;
      if (method && mode) {
        setActiveRun(`${method}-${mode}` as RunKey);
        setRunMsg({
          tone: "info",
          text: `Running ${method} (${mode})… live runs may take several minutes.`,
        });
        pollUntilDone(`${method}-${mode}` as RunKey);
      }
    }
  }, [data?.run_status?.running]);

  const startRun = useMutation({
    mutationFn: ({ method, mode }: { method: "baseline" | "agent"; mode: "mock" | "live" }) =>
      adminApi.runEvaluation(method, mode),
    onMutate: ({ method, mode }) => {
      const key = `${method}-${mode}` as RunKey;
      setActiveRun(key);
      setSuccessRun(null);
      setRunMsg({
        tone: "info",
        text:
          mode === "live"
            ? `Starting ${method} live evaluation… this may take several minutes.`
            : `Starting ${method} mock evaluation…`,
      });
    },
    onSuccess: (res, { method, mode }) => {
      const key = `${method}-${mode}` as RunKey;
      if (res.status === "started") {
        pollUntilDone(key);
        return;
      }
      setActiveRun(null);
      setSuccessRun(key);
      setRunMsg({ tone: "ok", text: `${method} (${mode}) completed.` });
      window.setTimeout(() => setSuccessRun(null), 1500);
      void qc.invalidateQueries({ queryKey: ["admin-benchmark"] });
    },
    onError: (e: Error) => {
      setActiveRun(null);
      setSuccessRun(null);
      setRunMsg({ tone: "err", text: e.message });
    },
  });

  const comp = data?.artifacts?.comparison_live?.summary;
  const baseline = data?.artifacts?.baseline_live?.summary;
  const agent = data?.artifacts?.agent_live?.summary;
  const isRunning = Boolean(data?.run_status?.running || activeRun);

  return (
    <div className="space-y-5 min-w-0">
      <div className="rg-panel p-5">
        <h2 className="text-lg font-semibold">Baseline vs agent benchmark</h2>
        <p className="text-sm text-rg-muted mt-1 leading-relaxed">
          Full transparency for judges: what the weak baseline is, what the LLM actually does, and
          measured scores on the frozen 12-case synthetic suite.
        </p>
      </div>

      {isLoading ? <p className="text-rg-muted">Loading benchmark…</p> : null}
      {isError ? (
        <ActionButton variant="secondary" onClick={() => void refetch()}>
          Retry
        </ActionButton>
      ) : null}

      {data ? (
        <>
          <div className="grid md:grid-cols-3 gap-3 min-w-0">
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
              subtitle={formatMetricLabel(data.primary_metric)}
              recall={comp?.comparison?.agent_micro_recall}
              extra={`Baseline recall: ${comp?.comparison?.baseline_micro_recall ?? "—"}`}
              highlight
            />
          </div>

          <div className="rg-panel p-5 space-y-3 text-sm overflow-hidden">
            <h3 className="font-semibold">Architecture (plain English)</h3>
            <p className="break-words">
              <strong>Baseline:</strong> {data.architecture.baseline}
            </p>
            <p className="break-words">
              <strong>Agent:</strong> {data.architecture.agent}
            </p>
            <p className="break-words">
              <strong>LLM role:</strong> {data.architecture.llm_role}
            </p>
            <p className="text-rg-muted text-xs border-t border-rg-border pt-3 break-words">
              {data.disclaimer}
            </p>
          </div>

          <div className="rg-panel p-5 overflow-hidden">
            <h3 className="font-semibold text-sm mb-2">Current LLM configuration</h3>
            <dl className="grid sm:grid-cols-2 gap-2 text-sm min-w-0">
              <Row label="Provider" value={data.current_llm.provider} />
              <Row label="Model" value={data.current_llm.model || "—"} />
              <Row label="Base URL" value={data.current_llm.base_url || "—"} />
              <Row
                label="API key"
                value={data.current_llm.api_key_configured ? "Set in .env" : "Not set — live runs blocked"}
              />
            </dl>
            <p className="text-xs text-rg-muted mt-3 break-words">
              Edit provider/model in Admin → Settings. API keys never stored in the database. Restart
              the backend after changing `.env`.
            </p>
          </div>

          <div className="rg-panel p-5 overflow-hidden">
            <h3 className="font-semibold text-sm mb-3">Run evaluation from admin</h3>
            <p className="text-xs text-rg-muted mb-3 break-words">
              Mock runs finish in seconds (offline). Live runs start in the background and call your
              configured LLM — they may take several minutes. Keep this tab open while running.
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                variant="secondary"
                loading={activeRun === "baseline-mock"}
                success={successRun === "baseline-mock"}
                successLabel="Baseline done"
                disabled={isRunning}
                onClick={() => startRun.mutate({ method: "baseline", mode: "mock" })}
              >
                Run baseline (mock)
              </ActionButton>
              <ActionButton
                variant="secondary"
                loading={activeRun === "agent-mock"}
                success={successRun === "agent-mock"}
                successLabel="Agent done"
                disabled={isRunning}
                onClick={() => startRun.mutate({ method: "agent", mode: "mock" })}
              >
                Run agent (mock)
              </ActionButton>
              <ActionButton
                loading={activeRun === "baseline-live"}
                success={successRun === "baseline-live"}
                successLabel="Baseline done"
                disabled={isRunning || !data.current_llm.api_key_configured}
                onClick={() => startRun.mutate({ method: "baseline", mode: "live" })}
              >
                Run baseline (live)
              </ActionButton>
              <ActionButton
                loading={activeRun === "agent-live"}
                success={successRun === "agent-live"}
                successLabel="Agent done"
                disabled={isRunning || !data.current_llm.api_key_configured}
                onClick={() => startRun.mutate({ method: "agent", mode: "live" })}
              >
                Run agent (live)
              </ActionButton>
            </div>
            {isRunning ? (
              <p className="text-sm mt-3 text-rg-accent font-medium animate-pulse">
                Evaluation in progress…
              </p>
            ) : null}
            {runMsg ? (
              <p
                className={`text-sm mt-3 break-words ${
                  runMsg.tone === "err"
                    ? "text-rg-critical"
                    : runMsg.tone === "ok"
                      ? "text-rg-ok"
                      : "text-rg-muted"
                }`}
                role="status"
              >
                {runMsg.text}
              </p>
            ) : null}
          </div>

          {data.artifacts?.comparison_live?.cases ? (
            <div className="rg-panel overflow-hidden">
              <h3 className="font-semibold text-sm px-5 pt-5 pb-3">Per-case results (live agent)</h3>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm text-left min-w-[320px]">
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
      className={`rg-panel p-4 min-w-0 overflow-hidden ${highlight ? "ring-2 ring-rg-accent/40" : ""}`}
      style={highlight ? { background: "var(--rg-accent-soft)" } : undefined}
    >
      <p className="text-xs uppercase tracking-wide text-rg-muted truncate">{title}</p>
      <p className="text-sm font-medium mt-1 break-words leading-snug">{subtitle}</p>
      <p className="text-3xl font-semibold mt-3 text-rg-accent">
        {recall != null ? recall.toFixed(2) : "—"}
      </p>
      <p className="text-xs text-rg-muted mt-1">Micro recall</p>
      {precision != null ? (
        <p className="text-xs text-rg-muted">Precision: {precision.toFixed(2)}</p>
      ) : null}
      {mode ? <p className="text-xs text-rg-muted break-words">Mode: {mode}</p> : null}
      {model ? (
        <p className="text-xs text-rg-muted break-all" title={model}>
          Model: {model}
        </p>
      ) : null}
      {extra ? <p className="text-xs mt-2 font-medium break-words">{extra}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-rg-muted text-xs uppercase">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}
