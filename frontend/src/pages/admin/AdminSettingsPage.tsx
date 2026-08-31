import { useAuth } from "@/auth/AuthContext";

export function AdminSettingsPage() {
  const { user, disclaimer } = useAuth();

  return (
    <div className="space-y-5">
      <div className="rg-panel p-5">
        <h2 className="text-lg font-semibold">Workspace settings</h2>
        <p className="text-sm text-rg-muted mt-1">
          Prototype configuration summary. Secrets stay in environment variables — never in the
          browser.
        </p>
      </div>

      <dl className="rg-panel divide-y divide-rg-border text-sm">
        <Row label="Signed-in user" value={user?.email || "—"} />
        <Row label="Role" value={user?.role?.replace(/_/g, " ") || "—"} />
        <Row label="Facility" value={user?.facility_name || "—"} />
        <Row label="API base" value="/api/v1/ (Vite proxy → :8000)" />
        <Row label="Auth mode" value="Django session + CSRF (HttpOnly cookie)" />
        <Row label="Database" value="SQLite (backend/db.sqlite3)" />
        <Row label="Disclaimer" value={disclaimer || "Synthetic prototype — not for clinical use."} />
      </dl>

      <div className="rg-panel p-5 text-sm text-rg-muted">
        <p className="font-medium text-rg-ink mb-2">Optional deep admin</p>
        <p>
          For low-level model editing, Django Admin is still available at{" "}
          <a
            className="text-rg-accent underline"
            href="http://127.0.0.1:8000/admin/"
            target="_blank"
            rel="noreferrer"
          >
            http://127.0.0.1:8000/admin/
          </a>{" "}
          — this custom console is the primary hackathon admin experience.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid sm:grid-cols-[180px_1fr] gap-2 px-5 py-3">
      <dt className="text-rg-muted font-medium">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
