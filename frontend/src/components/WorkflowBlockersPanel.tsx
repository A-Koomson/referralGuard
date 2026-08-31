import type { ReferralGateContext } from "@/lib/workflowGates";
import { referralWorkflowGates } from "@/lib/workflowGates";

export type WorkflowBlocker = {
  severity: "info" | "warning" | "action";
  title: string;
  detail: string;
};

export function getWorkflowBlockers(
  ctx: ReferralGateContext & { referral_reason?: string },
): WorkflowBlocker[] {
  const gates = referralWorkflowGates(ctx);
  const blockers: WorkflowBlocker[] = [];
  const reasonMissing = !ctx.referral_reason?.trim();

  if (reasonMissing) {
    blockers.push({
      severity: "warning",
      title: "Referral reason not recorded on the case",
      detail:
        "Resolving a verification finding only saves your reviewer note — it does not update the referral reason field. Add the reason in Clinical summary below, then click Run analysis.",
    });
  }

  if (ctx.status === "NEEDS_CLARIFICATION") {
    if (gates.blocking) {
      const openCount = ctx.findings.filter(
        (f) =>
          f.resolution_state === "OPEN" &&
          (f.severity === "CRITICAL" || f.severity === "MAJOR"),
      ).length;
      blockers.push({
        severity: "warning",
        title: `${openCount} blocking finding(s) still open`,
        detail:
          "Review each finding below — Confirm/correct or Dismiss with a note. Facility matching and handoff stay locked until critical/major items are addressed.",
      });
    } else {
      blockers.push({
        severity: "action",
        title: "Findings reviewed — one more step",
        detail:
          'Click Run analysis above to re-check documentation. If the referral reason and other fields are complete, status will advance to "Ready for matching".',
      });
    }
  }

  if (ctx.status === "DRAFT") {
    blockers.push({
      severity: "action",
      title: "Analysis not started",
      detail: "Click Run analysis to apply the provisional documentation checklist.",
    });
  }

  if (ctx.status === "READY_FOR_MATCHING") {
    blockers.push({
      severity: "action",
      title: "Next: match facilities",
      detail: "Click Match facilities to rank synthetic destinations against clinician-confirmed needs.",
    });
  }

  if (ctx.status === "AWAITING_ACCEPTANCE") {
    if (!ctx.fully_verified) {
      blockers.push({
        severity: "action",
        title: "Clinician approval required",
        detail: gates.approve.reason || "Record clinician approval before confirming acceptance.",
      });
    } else if (!gates.accept.enabled) {
      blockers.push({
        severity: "action",
        title: "Select a receiving facility",
        detail: gates.accept.reason,
      });
    }
  }

  if (ctx.status !== "ACCEPTED") {
    if (!gates.handoff.enabled) {
      blockers.push({
        severity: "info",
        title: "Handoff locked",
        detail: gates.handoff.reason,
      });
    }
  }

  return blockers;
}

export function WorkflowBlockersPanel({
  blockers,
}: {
  blockers: WorkflowBlocker[];
}) {
  if (!blockers.length) return null;

  return (
    <div className="space-y-2 mb-4" role="status" aria-live="polite">
      {blockers.map((b, i) => (
        <div
          key={`${b.title}-${i}`}
          className={`rounded-md border px-4 py-3 text-sm ${
            b.severity === "action"
              ? "border-rg-accent bg-rg-accent-soft text-rg-ink"
              : b.severity === "warning"
                ? "border-rg-warning bg-[#fff8ed] text-rg-ink"
                : "border-rg-border bg-[#f7fafb] text-rg-muted"
          }`}
        >
          <p className="font-semibold">{b.title}</p>
          <p className="mt-1 leading-relaxed opacity-90">{b.detail}</p>
        </div>
      ))}
    </div>
  );
}
