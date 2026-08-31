import { Link } from "react-router-dom";
import { ActionButton } from "@/components/ActionButton";
import type { GateResult } from "@/lib/workflowGates";
import { WORKFLOW_STEPS, workflowStepIndex } from "@/lib/workflowGates";

type WorkflowActionButtonProps = {
  gate: GateResult;
  onClick?: () => void;
  pending?: boolean;
  pendingLabel?: string;
  success?: boolean;
  successLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  children: React.ReactNode;
  type?: "button" | "submit";
};

export function WorkflowActionButton({
  gate,
  onClick,
  pending = false,
  pendingLabel = "Working…",
  success = false,
  successLabel = "Done",
  variant = "primary",
  children,
  type = "button",
}: WorkflowActionButtonProps) {
  const disabled = !gate.enabled || pending;
  const title = disabled && gate.reason ? gate.reason : undefined;

  return (
    <ActionButton
      type={type}
      variant={variant}
      loading={pending}
      loadingLabel={pendingLabel}
      success={success}
      successLabel={successLabel}
      disabled={disabled}
      className={!gate.enabled ? "rg-btn-disabled" : ""}
      title={title}
      aria-disabled={disabled}
      onClick={onClick}
    >
      {children}
    </ActionButton>
  );
}

type WorkflowNavLinkProps = {
  to: string;
  gate: GateResult;
  children: React.ReactNode;
};

export function WorkflowNavLink({ to, gate, children }: WorkflowNavLinkProps) {
  if (!gate.enabled) {
    return (
      <span
        className="rg-btn-secondary opacity-50 cursor-not-allowed select-none"
        title={gate.reason}
        aria-disabled="true"
        role="link"
      >
        {children}
      </span>
    );
  }

  return (
    <Link className="rg-btn-secondary rg-btn-action" to={to}>
      {children}
    </Link>
  );
}

type WorkflowStepperProps = {
  status: string;
};

export function WorkflowStepper({ status }: WorkflowStepperProps) {
  const current = workflowStepIndex(status);

  return (
    <ol className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs" aria-label="Referral workflow">
      {WORKFLOW_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const locked = i > current;

        return (
          <li
            key={step}
            className={`border px-3 py-2 transition-colors ${
              active
                ? "border-rg-accent bg-rg-accent-soft text-rg-accent font-semibold ring-1 ring-rg-accent/30"
                : done
                  ? "border-rg-accent/40 bg-white text-rg-accent font-medium"
                  : "border-rg-border text-rg-muted bg-[#f7fafb] opacity-70"
            }`}
            style={{ borderRadius: "var(--rg-radius)" }}
            aria-current={active ? "step" : undefined}
          >
            <span className="block text-[10px] opacity-70 mb-0.5">
              {done ? "Done · " : locked ? "Locked · " : ""}Step {i + 1}
            </span>
            {step.replace(/_/g, " ")}
          </li>
        );
      })}
    </ol>
  );
}
