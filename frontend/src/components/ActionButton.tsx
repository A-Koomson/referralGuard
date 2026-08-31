import { ButtonHTMLAttributes, useEffect, useState } from "react";

type Variant = "primary" | "secondary" | "danger" | "onDark";
type Size = "default" | "sm";

const variantClass: Record<Variant, string> = {
  primary: "rg-btn",
  secondary: "rg-btn-secondary",
  danger: "rg-btn-danger",
  onDark: "rg-btn-on-dark",
};

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  success?: boolean;
  successLabel?: string;
  loadingLabel?: string;
};

/** Action button with loading state, press feedback, and a brief success pulse. */
export function ActionButton({
  variant = "primary",
  size = "default",
  loading = false,
  success = false,
  successLabel = "Done",
  loadingLabel = "Working…",
  children,
  className = "",
  disabled,
  type = "button",
  ...props
}: ActionButtonProps) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!success) return;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 1400);
    return () => window.clearTimeout(timer);
  }, [success]);

  const showSuccess = flash && success;
  const sizeClass = size === "sm" ? "text-xs py-1.5 px-3" : "";

  return (
    <button
      type={type}
      className={`${variantClass[variant]} rg-btn-action${showSuccess ? " rg-btn-success-pulse" : ""} ${sizeClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {showSuccess ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="rg-btn-check" aria-hidden>
            ✓
          </span>
          {successLabel}
        </span>
      ) : loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="rg-btn-spinner" aria-hidden />
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
