import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { referralsApi, type Finding } from "@/api/client";
import { FacilityMatchResults } from "@/components/FacilityMatchResults";
import { StatusBadge } from "@/components/StatusBadge";
import { SystemTransparencyPanel } from "@/components/SystemTransparencyPanel";
import {
  getWorkflowBlockers,
  WorkflowBlockersPanel,
} from "@/components/WorkflowBlockersPanel";
import {
  WorkflowActionButton,
  WorkflowNavLink,
  WorkflowStepper,
} from "@/components/WorkflowControls";
import { nextStepHint, referralWorkflowGates, type GateResult } from "@/lib/workflowGates";

export function ReferralDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["referral", id],
    queryFn: () => referralsApi.get(id),
    enabled: Boolean(id),
  });
  const [exportReason, setExportReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");

  const { data: matches, refetch: refetchMatches } = useQuery({
    queryKey: ["referral-matches", id],
    queryFn: () => referralsApi.matches(id),
    enabled:
      Boolean(id) &&
      Boolean(
        data?.status &&
          ["READY_FOR_MATCHING", "AWAITING_ACCEPTANCE", "ACCEPTED"].includes(data.status),
      ),
  });

  useEffect(() => {
    if (matches?.length && !selectedFacilityId) {
      setSelectedFacilityId(matches[0].facility);
    }
  }, [matches, selectedFacilityId]);

  const analyse = useMutation({
    mutationFn: () => referralsApi.analyse(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["referral", id] });
      setMsg("Analysis complete.");
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const match = useMutation({
    mutationFn: () => referralsApi.match(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["referral", id] });
      void qc.invalidateQueries({ queryKey: ["referral-matches", id] });
      void refetchMatches();
      setMsg("Facility matching complete. Review ranked results below — stale capacity is not confirmed.");
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const approve = useMutation({
    mutationFn: () => referralsApi.approve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["referral", id] });
      setMsg("Clinician approval recorded.");
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const accept = useMutation({
    mutationFn: async () => {
      const facilityId = selectedFacilityId || matches?.[0]?.facility;
      if (!facilityId) {
        throw new Error("Select a facility from the match results first.");
      }
      return referralsApi.accept(id, {
        facility: facilityId,
        decision: "ACCEPTED",
        reference: `SIM-${Date.now()}`,
        instructions: "Synthetic acceptance confirmation for prototype demo.",
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["referral", id] });
      const name =
        matches?.find((m) => m.facility === selectedFacilityId)?.facility_name || "selected facility";
      setMsg(`Acceptance confirmed with ${name} (simulation).`);
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const decline = useMutation({
    mutationFn: async () => {
      const facilityId = selectedFacilityId || matches?.[0]?.facility;
      if (!facilityId) {
        throw new Error("Select a facility from the match results first.");
      }
      return referralsApi.accept(id, {
        facility: facilityId,
        decision: "REJECTED",
        reference: `SIM-DECLINE-${Date.now()}`,
        instructions: "Synthetic decline for prototype demo.",
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["referral", id] });
      setMsg("Decline recorded (simulation). Acceptance for one referral is not facility-wide availability.");
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const exportIncomplete = useMutation({
    mutationFn: () => referralsApi.exportIncomplete(id, exportReason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["referral", id] });
      setMsg("Incomplete emergency handoff exported — remains unverified.");
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const upload = useMutation({
    mutationFn: (file: File) => referralsApi.uploadEvidence(id, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["referral", id] });
      setMsg("Evidence uploaded. Prior verification/approval cleared — re-run analysis.");
    },
    onError: (e: Error) => setMsg(e.message),
  });

  if (isLoading) return <p className="text-rg-muted">Loading referral…</p>;
  if (isError || !data) {
    return (
      <div className="rg-panel p-5" role="alert">
        <p className="text-rg-critical">Failed to load referral.</p>
        <button type="button" className="rg-btn-secondary mt-3" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const gateCtx = {
    status: data.status,
    fully_verified: data.fully_verified,
    findings: data.findings || [],
    hasMatches: Boolean(matches?.length),
  };
  const gates = referralWorkflowGates(gateCtx);
  const blockers = getWorkflowBlockers({
    ...gateCtx,
    referral_reason: data.referral_reason,
  });

  const acceptGate: GateResult =
    gates.accept.enabled && !selectedFacilityId
      ? { enabled: false, reason: "Select a facility from the match results first." }
      : gates.accept;

  return (
    <div className="space-y-6 rg-fade-up">
      <div>
        <p className="text-xs uppercase tracking-wide text-rg-muted mb-1">Referral</p>
        <h1 className="text-2xl font-semibold">{data.synthetic_case_id}</h1>
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <StatusBadge value={data.status} />
          <StatusBadge value={data.urgency} />
          <span className="text-sm text-rg-muted">
            {data.fully_verified ? "Fully verified (prototype)" : "Not fully verified"}
          </span>
        </div>
      </div>

      <WorkflowStepper status={data.status} />

      <SystemTransparencyPanel />

      <section className="rg-panel p-5">
        <h2 className="text-base font-semibold mb-4">Clinical summary</h2>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-rg-muted text-xs uppercase tracking-wide">Patient label</dt>
            <dd className="mt-1">{data.patient_display_label}</dd>
          </div>
          <div>
            <dt className="text-rg-muted text-xs uppercase tracking-wide">Gestational age</dt>
            <dd className="mt-1">{data.gestational_age_weeks ?? "—"} weeks</dd>
          </div>
          <div className="sm:col-span-2">
            <ReferralReasonField
              referralId={id}
              value={data.referral_reason}
              editable={data.status !== "ACCEPTED"}
              onSaved={(hint) => setMsg(hint)}
            />
          </div>
          <div className="sm:col-span-2">
            <dt className="text-rg-muted text-xs uppercase tracking-wide">
              Clinician-confirmed needs (for matching)
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {(data.clinician_confirmed_needs || []).length ? (
                data.clinician_confirmed_needs.map((code) => (
                  <code
                    key={code}
                    className="text-xs bg-rg-accent-soft text-rg-accent px-2 py-0.5 rounded"
                  >
                    {code}
                  </code>
                ))
              ) : (
                <span className="text-rg-warning">None set — matching will fail</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {["READY_FOR_MATCHING", "AWAITING_ACCEPTANCE", "ACCEPTED"].includes(data.status) ? (
        <section className="rg-panel p-5">
          <h2 className="text-base font-semibold mb-3">Facility match results</h2>
          <FacilityMatchResults
            matches={matches || []}
            needs={data.clinician_confirmed_needs || []}
            selectedFacilityId={selectedFacilityId}
            onSelect={setSelectedFacilityId}
            showSelect={data.status === "AWAITING_ACCEPTANCE"}
          />
        </section>
      ) : null}

      <section className="rg-panel p-5">
        <h2 className="text-base font-semibold mb-2">Actions</h2>
        <WorkflowBlockersPanel blockers={blockers} />
        <p className="text-sm text-rg-muted mb-1">{nextStepHint(gateCtx)}</p>
        <p className="text-xs text-rg-muted mb-4">
          Locked buttons are grey. Hover for details, or read the alerts above.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rg-muted mb-2">
              Verification
            </p>
            <div className="flex flex-wrap gap-2">
              <WorkflowActionButton
                gate={gates.analyse}
                pending={analyse.isPending}
                pendingLabel="Running…"
                onClick={() => analyse.mutate()}
              >
                Run analysis
              </WorkflowActionButton>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rg-muted mb-2">
              Facility routing
            </p>
            <div className="flex flex-wrap gap-2">
              <WorkflowActionButton
                gate={gates.match}
                variant="secondary"
                pending={match.isPending}
                pendingLabel="Matching…"
                onClick={() => match.mutate()}
              >
                Match facilities
              </WorkflowActionButton>
              <WorkflowActionButton
                gate={gates.approve}
                variant="secondary"
                pending={approve.isPending}
                pendingLabel="Saving…"
                onClick={() => approve.mutate()}
              >
                Clinician approve
              </WorkflowActionButton>
              <WorkflowActionButton
                gate={acceptGate}
                pending={accept.isPending}
                pendingLabel="Confirming…"
                onClick={() => accept.mutate()}
              >
                Confirm acceptance
              </WorkflowActionButton>
              <WorkflowActionButton
                gate={acceptGate}
                variant="danger"
                pending={decline.isPending}
                pendingLabel="Saving…"
                onClick={() => decline.mutate()}
              >
                Decline selected (simulation)
              </WorkflowActionButton>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rg-muted mb-2">
              Handoff packet
            </p>
            <div className="flex flex-wrap gap-2">
              <WorkflowNavLink to={`/referrals/${id}/handoff`} gate={gates.handoff}>
                Handoff
              </WorkflowNavLink>
              <WorkflowNavLink to={`/referrals/${id}/print`} gate={gates.print}>
                Print summary
              </WorkflowNavLink>
              <Link className="rg-btn-secondary" to="/referrals/new">
                Start new referral
              </Link>
            </div>
          </div>
        </div>

        {data.fully_verified && data.status !== "ACCEPTED" ? (
          <p className="text-xs text-rg-muted mt-4 p-3 bg-[#f4fafb] border border-rg-border rounded-md">
            Clinician approval recorded. Next: confirm facility acceptance before opening handoff.
          </p>
        ) : null}

        {msg ? (
          <p
            className={`text-sm mt-3 ${
              msg.toLowerCase().includes("cannot") || msg.toLowerCase().includes("failed")
                ? "text-rg-critical"
                : "text-rg-muted"
            }`}
          >
            {msg}
          </p>
        ) : null}
      </section>

      <section className="rg-panel p-5">
        <h2 className="text-base font-semibold mb-2">Source documents</h2>
        <p className="text-sm text-rg-muted mb-3">
          Supported: PDF, JPEG, PNG, plain text, CSV, JSON (max 5MB). Handwriting OCR is not
          implemented — images/PDFs are stored for reference only.
        </p>
        <input
          type="file"
          aria-label="Upload evidence file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json,application/pdf,image/png,image/jpeg,text/plain,text/csv,application/json"
          disabled={upload.isPending || !gates.upload.enabled}
          title={!gates.upload.enabled ? gates.upload.reason : undefined}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = "";
          }}
        />
        {!gates.upload.enabled ? (
          <p className="text-xs text-rg-muted mt-2">{gates.upload.reason}</p>
        ) : null}
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">Verification findings</h2>
        <FindingsList
          findings={data.findings || []}
          referralId={id}
          status={data.status}
          onResolved={(hint) => {
            void qc.invalidateQueries({ queryKey: ["referral", id] });
            if (hint) setMsg(hint);
          }}
        />
      </section>

      <section className="rg-panel p-5">
        <h2 className="text-base font-semibold mb-2">Export incomplete emergency handoff</h2>
        <p className="text-sm text-rg-muted mb-4">
          Does not mark missing facts as verified. Unresolved items remain visible and audited.
        </p>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            exportIncomplete.mutate();
          }}
          className="space-y-3"
        >
          <label className="rg-label" htmlFor="reason">
            Audited reason
          </label>
          <textarea
            id="reason"
            className="rg-input min-h-[88px]"
            value={exportReason}
            onChange={(e) => setExportReason(e.target.value)}
            required
            minLength={10}
          />
          <button
            type="submit"
            className="rg-btn-danger"
            disabled={exportIncomplete.isPending || !gates.incompleteExport.enabled}
            title={!gates.incompleteExport.enabled ? gates.incompleteExport.reason : undefined}
          >
            Export incomplete handoff
          </button>
        </form>
      </section>
    </div>
  );
}

function ReferralReasonField({
  referralId,
  value,
  editable,
  onSaved,
}: {
  referralId: string;
  value: string;
  editable: boolean;
  onSaved: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function save() {
    const trimmed = draft.trim();
    if (trimmed.length < 3) {
      setErr("Referral reason must be at least 3 characters.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await referralsApi.patch(referralId, { referral_reason: trimmed });
      void qc.invalidateQueries({ queryKey: ["referral", referralId] });
      onSaved("Referral reason saved. Click Run analysis to re-check documentation.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label className="text-rg-muted text-xs uppercase tracking-wide" htmlFor="referral-reason">
        Referral reason
      </label>
      {editable ? (
        <div className="mt-1 space-y-2">
          <textarea
            id="referral-reason"
            className={`rg-input min-h-[72px] ${!draft.trim() ? "border-rg-warning" : ""}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Enter the clinical reason for this emergency referral…"
          />
          {!draft.trim() ? (
            <p className="text-xs text-rg-warning">
              Required for verification. Resolving a finding does not fill this field.
            </p>
          ) : null}
          <button
            type="button"
            className="rg-btn-secondary text-xs py-1.5 px-3"
            disabled={saving || draft.trim() === value.trim()}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save referral reason"}
          </button>
          {err ? (
            <p className="text-xs text-rg-critical" role="alert">
              {err}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1">{value || "(missing)"}</p>
      )}
    </div>
  );
}

function FindingsList({
  findings,
  referralId,
  status,
  onResolved,
}: {
  findings: Finding[];
  referralId: string;
  status: string;
  onResolved: (hint?: string) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!findings.length) {
    const analysed = !["DRAFT"].includes(status);
    return (
      <div className="rg-panel p-5 text-sm text-rg-muted">
        {analysed ? (
          <>
            No blocking documentation issues were recorded on the last analysis. That is expected
            for a complete referral — it does not mean clinical clearance.
          </>
        ) : (
          <>
            No findings yet. Click <strong>Run analysis</strong> from Draft or Needs clarification
            to apply the provisional checklist. Try EVAL-03 for a missing-reason example.
          </>
        )}
      </div>
    );
  }

  async function resolve(
    findingId: string,
    resolution_state: "RESOLVED" | "ACCEPTED_RISK",
  ) {
    const note = (notes[findingId] || "").trim();
    if (note.length < 3) {
      setErr("Resolution note required (min 3 characters).");
      return;
    }
    setBusy(findingId);
    setErr(null);
    try {
      const result = (await referralsApi.resolveFinding(referralId, findingId, {
        resolution_state,
        resolution_note: note,
      })) as Finding & { workflow_hint?: string };
      onResolved(result.workflow_hint);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="space-y-3">
      {err ? (
        <li className="text-sm text-rg-critical" role="alert">
          {err}
        </li>
      ) : null}
      {findings.map((f) => (
        <li
          key={f.id}
          className="rg-panel p-4 text-sm"
          style={
            f.severity === "CRITICAL"
              ? { borderLeft: "3px solid var(--rg-critical)" }
              : f.severity === "MAJOR"
                ? { borderLeft: "3px solid var(--rg-warning)" }
                : undefined
          }
        >
          <div className="flex flex-wrap gap-2 mb-2">
            <StatusBadge value={f.severity} />
            <StatusBadge value={f.category} />
            <span className="text-xs text-rg-muted self-center">
              {f.resolution_state}
              {f.deterministic ? " · rule-based" : " · AI-assisted suggestion"}
            </span>
          </div>
          <p>{f.message}</p>
          <div className="mt-2 text-xs text-rg-muted leading-relaxed">
            Evidence:{" "}
            {f.absence_stated
              ? "Required information absent from evidence"
              : f.evidence_citations?.length
                ? JSON.stringify(f.evidence_citations)
                : "No citation"}
          </div>
          {f.resolution_state === "OPEN" && status !== "ACCEPTED" ? (
            <div className="mt-3 space-y-2 border-t border-rg-border pt-3">
              <label className="rg-label" htmlFor={`note-${f.id}`}>
                Reviewer note (required)
              </label>
              <textarea
                id={`note-${f.id}`}
                className="rg-input min-h-[64px]"
                value={notes[f.id] || ""}
                onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rg-btn"
                  disabled={busy === f.id}
                  onClick={() => void resolve(f.id, "RESOLVED")}
                >
                  Confirm / correct
                </button>
                <button
                  type="button"
                  className="rg-btn-secondary"
                  disabled={busy === f.id}
                  onClick={() => void resolve(f.id, "ACCEPTED_RISK")}
                >
                  Dismiss (accept risk)
                </button>
              </div>
              <p className="text-xs text-rg-muted">
                Severity labels are documentation checks — not autonomous clinical triage.
                AI suggestions remain distinct from human-confirmed resolution.
              </p>
            </div>
          ) : (
            <p className="text-xs mt-2 text-rg-muted">
              Human review: {f.resolution_state}
              {f.resolution_note ? ` — ${f.resolution_note}` : ""}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
