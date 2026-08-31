import { useQuery } from "@tanstack/react-query";
import { facilitiesApi } from "@/api/client";

export function CapabilityCodesReference({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => facilitiesApi.capabilities(),
  });

  if (isLoading) {
    return <p className="text-xs text-rg-muted">Loading capability codes…</p>;
  }

  const caps = data?.results || [];

  if (compact) {
    return (
      <ul className="text-xs text-rg-muted space-y-1 mt-2">
        {caps.map((c) => (
          <li key={c.id}>
            <code className="text-rg-accent">{c.code}</code> — {c.name}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-rg-muted text-xs uppercase">
          <tr>
            <th className="py-2 pr-4 font-semibold">Code</th>
            <th className="py-2 pr-4 font-semibold">Name</th>
            <th className="py-2 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>
          {caps.map((c) => (
            <tr key={c.id} className="border-t border-rg-border">
              <td className="py-2 pr-4 font-mono text-rg-accent whitespace-nowrap">{c.code}</td>
              <td className="py-2 pr-4 font-medium">{c.name}</td>
              <td className="py-2 text-rg-muted">{c.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
