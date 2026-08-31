import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroBackdrop } from "@/components/HeroBackdrop";

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState("clinician1@referralguard.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="rg-banner" role="status">
        Hackathon prototype — synthetic data — not for clinical use
      </div>

      <div className="flex-1 grid lg:grid-cols-2">
        <HeroBackdrop className="hidden lg:block min-h-full">
          <div className="flex h-full flex-col justify-between p-12 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60 mb-4">
                Clinical decision support
              </p>
              <h1 className="text-4xl xl:text-5xl font-semibold leading-tight max-w-md">
                ReferralGuard
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
                Verify emergency maternity referral documentation before handoff. Evidence-linked
                findings with mandatory human review.
              </p>
            </div>
            <div className="grid gap-3 max-w-md text-sm">
              {[
                "Documentation verification, not diagnosis",
                "Clinician-gated fully verified label",
                "Synthetic facilities and availability only",
              ].map((item) => (
                <div
                  key={item}
                  className="border border-white/15 bg-white/5 px-4 py-3"
                  style={{ borderRadius: "var(--rg-radius)" }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </HeroBackdrop>

        <section className="flex flex-col justify-center px-6 py-12 sm:px-12 bg-rg-bg">
          <div className="w-full max-w-md mx-auto rg-fade-up">
            <div className="lg:hidden mb-8">
              <h1 className="text-3xl font-semibold">ReferralGuard</h1>
              <p className="mt-2 text-sm text-rg-muted">
                Sign in to the clinician workspace.
              </p>
            </div>

            <div className="rg-panel p-8">
              <h2 className="text-xl font-semibold mb-1">Sign in</h2>
              <p className="text-sm text-rg-muted mb-6">
                Secure session cookies with CSRF protection.
              </p>
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div>
                  <label className="rg-label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    className="rg-input"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="rg-label" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    className="rg-input"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error ? (
                  <p className="text-sm text-rg-critical" role="alert">
                    {error}
                  </p>
                ) : null}
                <button type="submit" className="rg-btn w-full" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>

      <SiteFooter compact />
    </div>
  );
}
