import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { adminApi, type BenchmarkCaseRow } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";

type RunKey = "baseline-mock" | "agent-mock" | "baseline-live" | "agent-live";
type ResultsView = "live" | "mock";

function formatMetricLabel(key?: string | null) {
  if (!key) return "Critical omission recall";
  return key.replace(/_/g, " ");
}

function formatScore(value?: number | null) {
  return value != null ? value.toFixed(2) : "—";
}

function runLabel(method: string | null, mode: string | null) {
  if (!method || !mode) return "Run";
  return `${method.charAt(0).toUpperCase()}${method.slice(1)} (${mode})`;
}

export function AdminEvaluationPage() {
  const qc = useQueryClient();
  const [runMsg, setRunMsg] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(
    null,
  );
  const [activeRun, setActiveRun] = useState<RunKey | null>(null);
  const [successRun, setSuccessRun] = useState<RunKey | null>(null);
  const [watchRun, setWatchRun] = useState(false);
  const [resultsView, setResultsView] = useState<ResultsView>("live");
  const sawRunningRef = useRef(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-benchmark"],
    queryFn: () => adminApi.benchmark(),
    refetchInterval: watchRun ? 2000 : false,
  });

  const finishRun = (method: string | null, mode: string | null, error: string | null) => {
    setWatchRun(false);
    setActiveRun(null);
    if (error) {
      setRunMsg({ tone: "err", text: error });
      setSuccessRun(null);
      return;
    }
    if (method && mode) {
      setResultsView(mode === "live" ? "live" : "mock");
      const key = `${method}-${mode}` as RunKey;
      setSuccessRun(key);
      window.setTimeout(() => setSuccessRun(null), 1500);
    }
    setRunMsg({
      tone: "ok",
      text: `${runLabel(method, mode)} completed. Results updated below.`,
    });
    void qc.invalidateQueries({ queryKey: ["admin-benchmark"] });
  };

  useEffect(() => {
    if (!watchRun || !data?.run_status) return;
    if (data.run_status.running) {
      sawRunningRef.current = true;
      return;
    }
    if (!sawRunningRef.current) return;
    sawRunningRef.current = false;
    finishRun(data.run_status.method, data.run_status.mode, data.run_status.error);
  }, [data?.run_status, watchRun, qc]);

  useEffect(() => {
    if (data?.run_status?.running && !watchRun) {
      const method = data.run_status.method;
      const mode = data.run_status.mode;
      if (method && mode) {
        setActiveRun(`${method}-${mode}` as RunKey);
        setWatchRun(true);
        sawRunningRef.current = true;
        setRunMsg({
          tone: "info",
          text: `Running ${runLabel(method, mode)}…`,
        });
      }
    }
  }, [data?.run_status?.running, data?.run_status?.method, data?.run_status?.mode, watchRun]);

  const startRun = useMutation({
    mutationFn: ({ method, mode }: { method: "baseline" | "agent"; mode: "mock" | "live" }) =>
      adminApi.runEvaluation(method, mode),
    onMutate: ({ method, mode }) => {
      setActiveRun(`${method}-${mode}` as RunKey);
      setSuccessRun(null);
      sawRunningRef.current = false;
      setRunMsg({ tone: "info", text: `Starting ${runLabel(method, mode)}…` });
    },
    onSuccess: (res, { method, mode }) => {
      if (res.status === "started") {
        sawRunningRef.current = true;
        setWatchRun(true);
        void qc.invalidateQueries({ queryKey: ["admin-benchmark"] });
        return;
      }
      finishRun(method, mode, null);
    },
    onError: (e: Error) => {
      setActiveRun(null);
      setWatchRun(false);
      setSuccessRun(null);
      setRunMsg({ tone: "err", text: e.message });
    },
  });

  const liveBaseline = data?.artifacts?.baseline_live?.summary;
  const liveAgent = data?.artifacts?.agent_live?.summary;
  const liveComp = data?.artifacts?.comparison_live?.summary;
  const mockBaseline = data?.artifacts?.baseline_mock?.summary;
  const mockAgent = data?.artifacts?.agent_mock?.summary;
  const mockComp = data?.artifacts?.comparison_mock?.summary;

  const viewBaseline = resultsView === "live" ? liveBaseline : mockBaseline;
  const viewAgent = resultsView === "live" ? liveAgent : mockAgent;
  const viewComp = resultsView === "live" ? liveComp : mockComp;
  const viewCases: BenchmarkCaseRow[] =
    (resultsView === "live"
      ? data?.artifacts?.comparison_live?.cases
      : data?.artifacts?.comparison_mock?.cases) ?? [];

  const isRunning = Boolean(watchRun || data?.run_status?.running || activeRun);
  const liveReady = Boolean(data?.current_llm.api_key_configured);

  return (
    <div className="space-y-5 min-w-0">
      <div className="rg-panel p-5">
        <h2 className="text-lg font-semibold">Evaluation benchmark</h2>
        <p className="text-sm text-rg-muted mt-1 leading-relaxed">
          Compare baseline and agent pipeline performance across the {data?.case_count ?? 12}-case
          synthetic verification suite.
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
          <div className="flex flex-wrap gap-2">
            <ViewTab
              active={resultsView === "live"}
              onClick={() => setResultsView("live")}
              label="Live"
            />
            <ViewTab
              active={resultsView === "mock"}
              onClick={() => setResultsView("mock")}
              label="Mock"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-3 min-w-0">
            <MetricCard
              title={`Baseline · ${resultsView}`}
              subtitle="Direct LLM prompt"
              recall={viewBaseline?.micro_recall}
              precision={viewBaseline?.micro_precision}
              mode={viewBaseline?.mode}
              model={viewBaseline?.model_name}
            />
            <MetricCard
              title={`Agent pipeline · ${resultsView}`}
              subtitle="Rules + LLM extraction"
              recall={viewAgent?.micro_recall}
              precision={viewAgent?.micro_precision}
              mode={viewAgent?.mode}
              model={viewAgent?.model_name}
            />
            <MetricCard
              title="Delta"
              subtitle={formatMetricLabel(data.primary_metric)}
              recall={viewComp?.comparison?.agent_micro_recall ?? viewAgent?.micro_recall}
              extra={`Baseline recall: ${viewComp?.comparison?.baseline_micro_recall ?? viewBaseline?.micro_recall ?? "—"}`}
              highlight
            />
          </div>

          {data.last_run && !data.last_run.error ? (
            <LastRunPanel lastRun={data.last_run} />
          ) : null}

          <div className="rg-panel p-5 space-y-3 text-sm overflow-hidden">
            <h3 className="font-semibold">System architecture</h3>
            <p className="break-words">
              <strong>Baseline:</strong> {data.architecture.baseline}
            </p>
            <p className="break-words">
              <strong>Agent:</strong> {data.architecture.agent}
            </p>
            <p className="break-words">
              <strong>LLM role:</strong> {data.architecture.llm_role}
            </p>
            {data.disclaimer ? (
              <p className="text-rg-muted text-xs border-t border-rg-border pt-3 break-words">
                {data.disclaimer}
              </p>
            ) : null}
          </div>

          <div className="rg-panel p-5 overflow-hidden">
            <h3 className="font-semibold text-sm mb-2">LLM configuration</h3>
            <dl className="grid sm:grid-cols-2 gap-2 text-sm min-w-0">
              <Row label="Provider" value={data.current_llm.provider} />
              <Row label="Model" value={data.current_llm.model || "—"} />
              <Row label="Base URL" value={data.current_llm.base_url || "—"} />
              <Row label="API key" value={liveReady ? "Configured" : "Not configured"} />
            </dl>
            {!liveReady ? (
              <p className="text-xs text-rg-muted mt-3 break-words">
                Live evaluation requires an API key in the server environment. Update configuration
                in Settings, then reload this page.
              </p>
            ) : null}
          </div>

          <div className="rg-panel p-5 overflow-hidden">
            <h3 className="font-semibold text-sm mb-3">Run evaluation</h3>
            <p className="text-xs text-rg-muted mb-3 break-words">
              Mock runs use offline deterministic behaviour. Live runs invoke the configured LLM
              provider across all suite cases.
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                variant="secondary"
                loading={activeRun === "baseline-mock"}
                success={successRun === "baseline-mock"}
                successLabel="Complete"
                disabled={isRunning}
                onClick={() => startRun.mutate({ method: "baseline", mode: "mock" })}
              >
                Baseline (mock)
              </ActionButton>
              <ActionButton
                variant="secondary"
                loading={activeRun === "agent-mock"}
                success={successRun === "agent-mock"}
                successLabel="Complete"
                disabled={isRunning}
                onClick={() => startRun.mutate({ method: "agent", mode: "mock" })}
              >
                Agent (mock)
              </ActionButton>
              <ActionButton
                loading={activeRun === "baseline-live"}
                success={successRun === "baseline-live"}
                successLabel="Complete"
                disabled={isRunning || !liveReady}
                onClick={() => startRun.mutate({ method: "baseline", mode: "live" })}
              >
                Baseline (live)
              </ActionButton>
              <ActionButton
                loading={activeRun === "agent-live"}
                success={successRun === "agent-live"}
                successLabel="Complete"
                disabled={isRunning || !liveReady}
                onClick={() => startRun.mutate({ method: "agent", mode: "live" })}
              >
                Agent (live)
              </ActionButton>
            </div>
            {isRunning ? (
              <p className="text-sm mt-3 text-rg-accent font-medium">Evaluation in progress…</p>
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

          {viewCases.length > 0 ? (
            <div className="rg-panel overflow-hidden">
              <h3 className="font-semibold text-sm px-5 pt-5 pb-3">
                Per-case results · {resultsView}
              </h3>
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
                    {viewCases.map((c) => (
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
          ) : (
            <div className="rg-panel p-5 text-sm text-rg-muted">
              No per-case results for {resultsView} mode. Run the agent evaluation to generate scores.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm font-semibold border rounded transition-colors ${
        active
          ? "bg-[var(--rg-accent-soft)] border-rg-accent text-rg-accent"
          : "bg-white border-rg-border text-rg-muted hover:border-rg-accent"
      }`}
    >
      {label}
    </button>
  );
}

function LastRunPanel({
  lastRun,
}: {
  lastRun: NonNullable<Awaited<ReturnType<typeof adminApi.benchmark>>["last_run"]>;
}) {
  return (
    <div className="rg-panel p-5 overflow-hidden">
      <h3 className="font-semibold text-sm">Latest run</h3>
      <p className="text-xs text-rg-muted mt-1 break-words">
        {runLabel(lastRun.method, lastRun.mode)} · {lastRun.case_count ?? 0} cases
      </p>
      <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 text-sm">
        <Row label="Micro recall" value={formatScore(lastRun.micro_recall)} />
        <Row label="Micro precision" value={formatScore(lastRun.micro_precision)} />
        <Row label="Mode" value={lastRun.mode ?? "—"} />
        <Row
          label="Completed"
          value={lastRun.finished_at ? lastRun.finished_at.slice(0, 19).replace("T", " ") : "—"}
        />
      </dl>
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
  recall?: number | null;
  precision?: number | null;
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
      <p className="text-3xl font-semibold mt-3 text-rg-accent">{formatScore(recall)}</p>
      <p className="text-xs text-rg-muted mt-1">Micro recall</p>
      {precision != null ? (
        <p className="text-xs text-rg-muted">Precision: {formatScore(precision)}</p>
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
