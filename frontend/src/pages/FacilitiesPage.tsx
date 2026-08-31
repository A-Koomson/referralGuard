import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { facilitiesApi } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";
import { CapabilityCodesReference } from "@/components/CapabilityCodesReference";
import { useActionSuccess } from "@/hooks/useActionSuccess";

export function FacilitiesPage() {
  const { trigger, isSuccess } = useActionSuccess();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["facilities"],
    queryFn: () => facilitiesApi.list(),
  });

  return (
    <div className="rg-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Facilities</h1>
        <p className="text-sm text-rg-muted mt-1 max-w-2xl">
          Explicitly fictional facilities for capability matching. Availability is synthetic and
          time-stamped — not real hospital capacity. Matching compares clinician-confirmed need
          codes to the capabilities listed on each facility profile.
        </p>
      </div>

      <section className="rg-panel p-5">
        <h2 className="text-base font-semibold mb-2">Capability codes used in matching</h2>
        <CapabilityCodesReference />
      </section>

      {isLoading ? <p className="text-rg-muted">Loading…</p> : null}
      {isError ? (
        <ActionButton
          variant="secondary"
          success={isSuccess("retry")}
          onClick={() => {
            void refetch();
            trigger("retry");
          }}
        >
          Retry
        </ActionButton>
      ) : null}

      <ul className="grid sm:grid-cols-2 gap-3">
        {data?.results?.map((f) => (
          <li key={f.id} className="rg-panel p-5">
            <Link to={`/facilities/${f.id}`} className="font-medium text-rg-accent hover:underline">
              {f.name}
            </Link>
            <p className="text-sm text-rg-muted mt-1">
              {f.facility_type.replace(/_/g, " ")} · {f.district}, {f.region}
            </p>
            {f.capabilities?.length ? (
              <div className="flex flex-wrap gap-1 mt-3">
                {f.capabilities.map((fc) => (
                  <code
                    key={fc.id}
                    className="text-[10px] bg-[#f4fafb] border border-rg-border px-1.5 py-0.5 rounded text-rg-accent"
                    title={fc.capability.name}
                  >
                    {fc.capability.code}
                  </code>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-rg-muted mt-3">Fictional · synthetic</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
