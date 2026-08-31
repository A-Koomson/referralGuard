import { ButtonHTMLAttributes, useEffect, useState } from "react";

type Variant = "primary" | "secondary" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "rg-btn",
  secondary: "rg-btn-secondary",
  danger: "rg-btn-danger",
};

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  success?: boolean;
  successLabel?: string;
};

/** Button with press feedback and a brief success pulse after async actions complete. */
export function ActionButton({
  variant = "primary",
  loading = false,
  success = false,
  successLabel = "Done",
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

  return (
    <button
      type={type}
      className={`${variantClass[variant]} rg-btn-action${showSuccess ? " rg-btn-success-pulse" : ""} ${className}`}
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
          Running…
        </span>
      ) : (
        children
      )}
    </button>
  );
}
