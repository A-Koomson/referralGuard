import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { facilitiesApi } from "@/api/client";
import { StatusBadge } from "@/components/StatusBadge";

export function FacilityDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["facility", id],
    queryFn: () => facilitiesApi.get(id),
    enabled: Boolean(id),
  });
  if (isLoading) return <p className="text-rg-muted">Loading…</p>;
  if (!data) return <p className="text-rg-critical">Not found</p>;

  return (
    <div className="space-y-6 rg-fade-up">
      <div>
        <Link to="/facilities" className="text-sm text-rg-accent hover:underline">
          ← All facilities
        </Link>
        <h1 className="font-display text-2xl font-semibold mt-2">{data.name}</h1>
        <p className="text-sm text-rg-muted mt-1">
          {data.facility_type.replace(/_/g, " ")} · {data.district}, {data.region}
        </p>
        <p className="text-xs text-rg-muted mt-2">
          Fictional facility · synthetic coordinates · service-level capabilities only
        </p>
      </div>

      <section className="rg-panel p-5">
        <h2 className="text-base font-semibold mb-3">Recorded capabilities</h2>
        <p className="text-sm text-rg-muted mb-4">
          These are what facility matching compares against your clinician-confirmed needs. Stale
          availability timestamps may show a capability on record but not freshly confirmed.
        </p>
        {data.capabilities?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-rg-muted text-xs uppercase bg-[#f7fafb]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Code</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Recorded state</th>
                </tr>
              </thead>
              <tbody>
                {data.capabilities.map((fc) => (
                  <tr key={fc.id} className="border-t border-rg-border">
                    <td className="px-3 py-2 font-mono text-rg-accent">{fc.capability.code}</td>
                    <td className="px-3 py-2">{fc.capability.name}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={fc.availability_state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-rg-muted">No capabilities on record.</p>
        )}
      </section>

      <p className="text-sm text-rg-muted">
        Phone placeholder: {data.phone_placeholder} · See{" "}
        <Link to="/availability" className="text-rg-accent underline">
          Availability console
        </Link>{" "}
        for time-stamped updates (simulation).
      </p>
    </div>
  );
}
