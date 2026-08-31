import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/referrals", label: "Referrals" },
  { to: "/admin/facilities", label: "Facilities" },
  { to: "/admin/agents", label: "Agent runs" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/settings", label: "Settings" },
];

export function AdminLayout() {
  return (
    <div className="rg-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="text-sm text-rg-muted mt-1">
          Custom ReferralGuard admin console. Django Admin remains available for deep model
          editing if needed.
        </p>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-5 items-start">
        <aside className="rg-panel p-3 lg:sticky lg:top-24">
          <p className="px-3 pt-2 pb-3 text-xs font-semibold uppercase tracking-[0.14em] text-rg-muted">
            Settings
          </p>
          <nav className="flex flex-col gap-1" aria-label="Admin settings">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "px-3 py-2.5 text-sm rounded-md transition-colors",
                    isActive
                      ? "bg-rg-accent-soft text-rg-accent font-semibold"
                      : "text-rg-muted hover:bg-rg-bg hover:text-rg-ink",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
