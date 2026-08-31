import type { Finding } from "@/api/client";

export const WORKFLOW_STEPS = [
  "DRAFT",
  "ANALYSING",
  "NEEDS_CLARIFICATION",
  "READY_FOR_MATCHING",
  "AWAITING_ACCEPTANCE",
  "ACCEPTED",
] as const;

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

export type ReferralGateContext = {
  status: string;
  fully_verified: boolean;
  findings: Finding[];
  hasMatches: boolean;
};

export type GateResult = {
  enabled: boolean;
  reason: string;
};

function hasBlockingOpenFindings(findings: Finding[]): boolean {
  return findings.some(
    (f) =>
      f.resolution_state === "OPEN" &&
      (f.severity === "CRITICAL" || f.severity === "MAJOR"),
  );
}

export function referralWorkflowGates(ctx: ReferralGateContext) {
  const { status, fully_verified, findings, hasMatches } = ctx;
  const blocking = hasBlockingOpenFindings(findings);

  const analyse: GateResult =
    status === "DRAFT" || status === "NEEDS_CLARIFICATION"
      ? { enabled: true, reason: "" }
      : status === "ANALYSING"
        ? { enabled: false, reason: "Analysis is already in progress." }
        : {
            enabled: false,
            reason:
              "Re-analysis is only available from Draft or Needs clarification. Upload new evidence first if the case changed.",
          };

  const match: GateResult =
    status === "READY_FOR_MATCHING"
      ? blocking
        ? {
            enabled: false,
            reason: "Resolve critical/major findings before matching facilities.",
          }
        : { enabled: true, reason: "" }
      : status === "AWAITING_ACCEPTANCE"
        ? {
            enabled: false,
            reason: "Facility matching already completed. Confirm acceptance or decline below.",
          }
        : {
            enabled: false,
            reason: "Run analysis and clear blocking findings before matching facilities.",
          };

  const approve: GateResult =
    status === "AWAITING_ACCEPTANCE"
      ? fully_verified
        ? {
            enabled: false,
            reason: "Clinician approval already recorded.",
          }
        : blocking
          ? {
              enabled: false,
              reason: "Resolve critical/major findings before approving the verified label.",
            }
          : !hasMatches
            ? {
                enabled: false,
                reason: "Run facility matching before clinician approval.",
              }
            : { enabled: true, reason: "" }
      : {
          enabled: false,
          reason: "Clinician approval unlocks after facility matching (Awaiting acceptance).",
        };

  const accept: GateResult =
    status === "AWAITING_ACCEPTANCE"
      ? !fully_verified
        ? {
            enabled: false,
            reason: "Record clinician approval before confirming acceptance.",
          }
        : !hasMatches
          ? {
              enabled: false,
              reason: "Run facility matching and select a destination first.",
            }
          : { enabled: true, reason: "" }
      : status === "ACCEPTED"
        ? { enabled: false, reason: "Acceptance already recorded for this referral." }
        : {
            enabled: false,
            reason: "Confirm acceptance only after matching and clinician approval.",
          };

  const handoff: GateResult =
    status === "ACCEPTED"
      ? { enabled: true, reason: "" }
      : {
          enabled: false,
          reason: "Handoff unlocks after facility acceptance is confirmed.",
        };

  const print: GateResult = handoff;

  const upload: GateResult =
    status === "ACCEPTED"
      ? {
          enabled: false,
          reason: "Case is accepted — start a new referral if additional evidence arrives.",
        }
      : { enabled: true, reason: "" };

  const incompleteExport: GateResult =
    status === "ACCEPTED"
      ? {
          enabled: false,
          reason: "Case is accepted. Use handoff for the final packet.",
        }
      : { enabled: true, reason: "" };

  return {
    analyse,
    match,
    approve,
    accept,
    decline: accept,
    handoff,
    print,
    upload,
    incompleteExport,
    blocking,
  };
}

export function nextStepHint(ctx: ReferralGateContext): string {
  const gates = referralWorkflowGates(ctx);
  const { status, fully_verified } = ctx;

  switch (status) {
    case "DRAFT":
      return "Step 1: Run analysis to apply the provisional documentation checklist.";
    case "ANALYSING":
      return "Analysis in progress…";
    case "NEEDS_CLARIFICATION":
      return gates.blocking
        ? "Step 2: Review and resolve findings below, then re-run analysis."
        : "Step 2: Re-run analysis when documentation is ready.";
    case "READY_FOR_MATCHING":
      return "Step 3: Match facilities against clinician-confirmed needs.";
    case "AWAITING_ACCEPTANCE":
      if (!fully_verified) {
        return "Step 4: Record clinician approval, then select a facility and confirm acceptance.";
      }
      return "Step 5: Select a facility below and confirm acceptance (or decline).";
    case "ACCEPTED":
      return "Step 6: Open handoff or print summary for the receiving facility packet.";
    default:
      return "Follow the workflow steps in order. Later actions stay locked until prerequisites are met.";
  }
}

export function workflowStepIndex(status: string): number {
  const i = WORKFLOW_STEPS.indexOf(status as WorkflowStep);
  return i >= 0 ? i : 0;
}
