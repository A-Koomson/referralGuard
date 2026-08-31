import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";
import { useActionSuccess } from "@/hooks/useActionSuccess";

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  facility_name: string | null;
  is_active: boolean;
  is_staff: boolean;
};

export function AdminUsersPage() {
  const { trigger, isSuccess } = useActionSuccess();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api<AdminUser[]>("/api/v1/admin/users/"),
    retry: false,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Users</h2>
      <p className="text-sm text-rg-muted">
        Read-only list for super-admins. Create, update, or deactivate accounts in Django Admin
        (<a className="text-rg-accent underline" href="/admin/accounts/user/">
          /admin/accounts/user/
        </a>
        ). Prefer deactivation over deletion. QUALIFIED_REVIEWER is a demo label, not professional
        qualification.
      </p>
      {isLoading ? <p className="text-rg-muted">Loading…</p> : null}
      {isError ? (
        <div className="rg-panel p-4" role="alert">
          <p className="text-sm text-rg-critical">
            {(error as Error)?.message || "Unable to load users (super-admin required)."}
          </p>
          <ActionButton
            variant="secondary"
            className="mt-3"
            success={isSuccess("retry")}
            onClick={() => {
              void refetch();
              trigger("retry");
            }}
          >
            Retry
          </ActionButton>
        </div>
      ) : null}
      <div className="rg-panel overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-rg-muted border-b border-rg-border" style={{ background: "#f7fafb" }}>
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Facility</th>
              <th className="px-4 py-3 font-semibold">Active</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((u) => (
              <tr key={u.id} className="border-t border-rg-border">
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.role.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">{u.facility_name || "—"}</td>
                <td className="px-4 py-3">{u.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
