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
      text: `${method} (${mode}) finished — see “Last run output” below for scores and files.`,
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
          text: `Running ${method} (${mode})… live runs may take several minutes.`,
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
      setRunMsg({
        tone: "info",
        text:
          mode === "live"
            ? `Starting ${method} live evaluation… this may take several minutes.`
            : `Starting ${method} mock evaluation…`,
      });
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

  const viewBaseline =
    resultsView === "live" ? liveBaseline : mockBaseline;
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
          <div className="flex flex-wrap gap-2">
            <ViewTab
              active={resultsView === "live"}
              onClick={() => setResultsView("live")}
              label="Live results (for judges)"
            />
            <ViewTab
              active={resultsView === "mock"}
              onClick={() => setResultsView("mock")}
              label="Mock results (offline test)"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-3 min-w-0">
            <MetricCard
              title={`Baseline (${resultsView})`}
              subtitle="Single direct LLM prompt — intentionally weak"
              recall={viewBaseline?.micro_recall}
              precision={viewBaseline?.micro_precision}
              mode={viewBaseline?.mode}
              model={viewBaseline?.model_name}
            />
            <MetricCard
              title={`Agent pipeline (${resultsView})`}
              subtitle="Rules + bounded LLM extraction"
              recall={viewAgent?.micro_recall}
              precision={viewAgent?.micro_precision}
              mode={viewAgent?.mode}
              model={viewAgent?.model_name}
            />
            <MetricCard
              title="Improvement"
              subtitle={formatMetricLabel(data.primary_metric)}
              recall={viewComp?.comparison?.agent_micro_recall ?? viewAgent?.micro_recall}
              extra={`Baseline recall: ${viewComp?.comparison?.baseline_micro_recall ?? viewBaseline?.micro_recall ?? "—"}`}
              highlight
            />
          </div>

          {data.last_run ? (
            <LastRunPanel lastRun={data.last_run} />
          ) : null}

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
                value={liveReady ? "Set in .env ✓" : "Not detected — see note below"}
              />
            </dl>
            {!liveReady ? (
              <div
                className="mt-3 text-xs p-3 border border-rg-warning/40 rounded break-words"
                style={{ background: "var(--rg-warning-soft, #fff8e6)" }}
              >
                Live buttons stay grey until Django sees <code>LLM_API_KEY</code> in your root{" "}
                <code>.env</code>. Save the key there, then refresh this page (or restart{" "}
                <code>runserver</code>).
              </div>
            ) : null}
          </div>

          <div className="rg-panel p-5 overflow-hidden">
            <h3 className="font-semibold text-sm mb-3">Run evaluation from admin</h3>
            <p className="text-xs text-rg-muted mb-3 break-words">
              <strong>Mock</strong> = fast offline smoke test (not a hackathon AI claim).{" "}
              <strong>Live</strong> = calls Groq on all 12 EVAL cases and writes{" "}
              <code>evaluation/results/*-live.md</code> files.
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
                disabled={isRunning || !liveReady}
                title={liveReady ? undefined : "Set LLM_API_KEY in .env first"}
                onClick={() => startRun.mutate({ method: "baseline", mode: "live" })}
              >
                Run baseline (live)
              </ActionButton>
              <ActionButton
                loading={activeRun === "agent-live"}
                success={successRun === "agent-live"}
                successLabel="Agent done"
                disabled={isRunning || !liveReady}
                title={liveReady ? undefined : "Set LLM_API_KEY in .env first"}
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

          <WhatNextPanel resultsView={resultsView} liveReady={liveReady} />

          {viewCases.length > 0 ? (
            <div className="rg-panel overflow-hidden">
              <h3 className="font-semibold text-sm px-5 pt-5 pb-3">
                Per-case results ({resultsView} agent)
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
              No {resultsView} per-case table yet. Run agent ({resultsView}) to populate scores for
              all 12 EVAL cases.
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
    <div
      className="rg-panel p-5 overflow-hidden border-l-4"
      style={{ borderLeftColor: "var(--rg-ok)" }}
    >
      <h3 className="font-semibold text-sm">Last run output</h3>
      <p className="text-xs text-rg-muted mt-1 break-words">
        {lastRun.method} · {lastRun.mode} · {lastRun.case_count} cases scored
      </p>
      <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 text-sm">
        <Row label="Micro recall" value={formatScore(lastRun.micro_recall)} />
        <Row label="Micro precision" value={formatScore(lastRun.micro_precision)} />
        <Row label="Claim" value={lastRun.benchmark_claim || "—"} />
        <Row label="Finished" value={lastRun.finished_at ? lastRun.finished_at.slice(0, 19) : "—"} />
      </dl>
      <p className="text-xs text-rg-muted mt-3 break-all">
        Files updated: <code>{lastRun.artifact_md}</code>
        {lastRun.artifact_json ? (
          <>
            {" "}
            · <code>{lastRun.artifact_json}</code>
          </>
        ) : null}
      </p>
      {lastRun.next_steps?.length ? (
        <div className="mt-3 pt-3 border-t border-rg-border">
          <p className="text-xs font-semibold uppercase text-rg-muted mb-2">What to do next</p>
          <ul className="text-sm space-y-1 list-disc pl-5 break-words">
            {lastRun.next_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function WhatNextPanel({
  resultsView,
  liveReady,
}: {
  resultsView: ResultsView;
  liveReady: boolean;
}) {
  return (
    <div className="rg-panel p-5 text-sm overflow-hidden">
      <h3 className="font-semibold">Recommended flow for your hackathon video</h3>
      <ol className="mt-2 space-y-2 list-decimal pl-5 text-rg-muted break-words">
        <li>
          <strong className="text-rg-ink">Mock (optional):</strong> run agent (mock) to confirm the
          pipeline works — you just did this if you see green “done”.
        </li>
        <li>
          <strong className="text-rg-ink">Live benchmark:</strong> run baseline (live) then agent
          (live) — {liveReady ? "buttons enabled above" : "enable by fixing .env + refresh"}.
        </li>
        <li>
          <strong className="text-rg-ink">Show judges:</strong> switch to{" "}
          <strong>Live results</strong> tab — baseline recall ~0.0, agent recall ~1.0 on 12 cases.
        </li>
        <li>
          <strong className="text-rg-ink">Demo workflow:</strong> clinician login → open{" "}
          <strong>EVAL-03</strong> → analyse → fix reason → handoff (see{" "}
          <code>docs/VIDEO_OUTLINE.md</code>).
        </li>
      </ol>
      {resultsView === "mock" ? (
        <p className="text-xs mt-3 text-rg-warning border-t border-rg-border pt-3 break-words">
          You are viewing <strong>mock</strong> results. Mock scores are not your hackathon AI claim —
          use the <strong>Live results</strong> tab or <code>comparison-live.md</code> for judges.
        </p>
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
