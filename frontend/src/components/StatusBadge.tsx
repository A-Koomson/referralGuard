const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#eef2f6", color: "#3d4f5f" },
  ANALYSING: { bg: "var(--rg-accent-soft)", color: "var(--rg-accent)" },
  NEEDS_CLARIFICATION: { bg: "var(--rg-warning-soft)", color: "var(--rg-warning)" },
  READY_FOR_MATCHING: { bg: "var(--rg-ok-soft)", color: "var(--rg-ok)" },
  AWAITING_ACCEPTANCE: { bg: "var(--rg-accent-soft)", color: "var(--rg-accent)" },
  ACCEPTED: { bg: "var(--rg-ok-soft)", color: "var(--rg-ok)" },
  IN_TRANSIT: { bg: "var(--rg-accent-soft)", color: "var(--rg-accent)" },
  ARRIVED: { bg: "var(--rg-ok-soft)", color: "var(--rg-ok)" },
  CLOSED: { bg: "#eef2f6", color: "#3d4f5f" },
  EMERGENCY: { bg: "var(--rg-critical-soft)", color: "var(--rg-critical)" },
  URGENT: { bg: "var(--rg-warning-soft)", color: "var(--rg-warning)" },
  ROUTINE: { bg: "#eef2f6", color: "#3d4f5f" },
  CRITICAL: { bg: "var(--rg-critical-soft)", color: "var(--rg-critical)" },
  MAJOR: { bg: "var(--rg-warning-soft)", color: "var(--rg-warning)" },
  MINOR: { bg: "#eef2f6", color: "#3d4f5f" },
  INFO: { bg: "var(--rg-accent-soft)", color: "var(--rg-accent)" },
  MISSING: { bg: "var(--rg-warning-soft)", color: "var(--rg-warning)" },
  CONTRADICTION: { bg: "var(--rg-critical-soft)", color: "var(--rg-critical)" },
  UNSUPPORTED: { bg: "var(--rg-warning-soft)", color: "var(--rg-warning)" },
  POLICY: { bg: "var(--rg-accent-soft)", color: "var(--rg-accent)" },
  SECURITY: { bg: "var(--rg-critical-soft)", color: "var(--rg-critical)" },
  AVAILABLE: { bg: "var(--rg-ok-soft)", color: "var(--rg-ok)" },
  LIMITED: { bg: "var(--rg-warning-soft)", color: "var(--rg-warning)" },
  UNAVAILABLE: { bg: "var(--rg-critical-soft)", color: "var(--rg-critical)" },
  UNKNOWN: { bg: "#eef2f6", color: "#3d4f5f" },
};

export function StatusBadge({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const style = STATUS_STYLES[value] || { bg: "#eef2f6", color: "#3d4f5f" };
  return (
    <span className={`rg-chip ${className}`} style={{ background: style.bg, color: style.color }}>
      {value.replace(/_/g, " ")}
    </span>
  );
}
