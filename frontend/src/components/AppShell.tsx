import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { SiteFooter } from "@/components/SiteFooter";

export function AppShell() {
  const { user, logout, disclaimer } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col text-rg-ink">
      <div className="rg-banner" role="status">
        Hackathon prototype — synthetic data — not for clinical use. Documentation readiness
        is not medical clearance.
      </div>

      <header
        className="rg-app-header sticky top-0 z-20 border-b w-full"
        style={{
          background: "linear-gradient(180deg, var(--rg-navy) 0%, var(--rg-navy-2) 100%)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="w-full px-4 sm:px-6 py-3.5 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 text-white shrink-0">
            <span
              className="inline-flex h-10 w-10 items-center justify-center text-sm font-bold"
              style={{
                background: "var(--rg-accent)",
                borderRadius: "var(--rg-radius)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)",
              }}
              aria-hidden
            >
              RG
            </span>
            <span className="hidden sm:block">
              <span className="block text-lg font-semibold leading-none">ReferralGuard</span>
              <span className="text-[11px] tracking-[0.12em] uppercase text-white/55">
                Emergency maternity referral
              </span>
            </span>
          </Link>

          <nav
            className="flex flex-wrap gap-1 text-sm flex-1 justify-center min-w-0"
            aria-label="Main"
          >
            {(
              [
                ["/", "Dashboard", false],
                ["/referrals/new", "New referral", false],
                ["/facilities", "Facilities", false],
                ["/availability", "Availability", false],
                ["/admin", "Admin", true],
              ] as const
            ).map(([to, label, adminPrefix]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={() => {
                  const active = adminPrefix
                    ? location.pathname.startsWith("/admin")
                    : location.pathname === to ||
                      (to !== "/" && location.pathname.startsWith(to));
                  return [
                    "px-3 py-2 rounded-md transition-colors whitespace-nowrap",
                    active
                      ? "bg-white/12 text-white font-semibold"
                      : "text-white/70 hover:text-white hover:bg-white/8",
                  ].join(" ");
                }}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm text-white shrink-0 ml-auto">
            <div className="text-right hidden md:block">
              <div className="font-medium leading-tight">{user?.full_name}</div>
              <div className="text-xs text-white/55">{user?.role?.replace(/_/g, " ")}</div>
            </div>
            <button type="button" className="rg-btn-on-dark" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>
        <div
          className="h-0.5 w-full"
          style={{
            background: "linear-gradient(90deg, var(--rg-accent), var(--rg-gold), var(--rg-accent))",
          }}
          aria-hidden
        />
      </header>

      <main className="flex-1 w-full">
        <div className="mx-auto w-full max-w-6xl px-4 py-8">
          <Outlet />
        </div>
      </main>

      <SiteFooter disclaimer={disclaimer} />
    </div>
  );
}
