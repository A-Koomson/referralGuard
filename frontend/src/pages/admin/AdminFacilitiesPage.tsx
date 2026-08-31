import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { facilitiesApi } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";
import { useActionSuccess } from "@/hooks/useActionSuccess";

export function AdminFacilitiesPage() {
  const { trigger, isSuccess } = useActionSuccess();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-facilities"],
    queryFn: () => facilitiesApi.list(),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Facilities</h2>
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
      <ul className="space-y-2">
        {data?.results?.map((f) => (
          <li key={f.id} className="rg-panel p-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link to={`/facilities/${f.id}`} className="font-medium text-rg-accent hover:underline">
                {f.name}
              </Link>
              <p className="text-sm text-rg-muted">
                {f.facility_type.replace(/_/g, " ")} · {f.district}, {f.region}
              </p>
            </div>
            <span className="text-xs text-rg-muted">Synthetic · fictional</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
