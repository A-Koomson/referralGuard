import { Link } from "react-router-dom";
import type { FacilityMatch } from "@/api/client";
import { CapabilityCoverageTable } from "@/components/CapabilityCoverageTable";

export function FacilityMatchResults({
  matches,
  needs,
  selectedFacilityId,
  onSelect,
  showSelect = false,
}: {
  matches: FacilityMatch[];
  needs: string[];
  selectedFacilityId?: string;
  onSelect?: (facilityId: string) => void;
  showSelect?: boolean;
}) {
  if (!matches.length) {
    return (
      <p className="text-sm text-rg-muted">
        No facility matches yet. Run <strong>Match facilities</strong> after documentation checks.
        Matching uses clinician-confirmed need codes — not an LLM diagnosis.
      </p>
    );
  }

  const allNeedsMet = (m: FacilityMatch) =>
    needs.every((code) => m.capability_coverage[code]?.present === true);

  const anyFullMatch = matches.some(allNeedsMet);

  return (
    <div className="space-y-4">
      <p className="text-sm text-rg-muted leading-relaxed">
        Ranked by recorded capability coverage and simulated availability freshness (stale ≠
        confirmed). <strong>No facility is auto-selected.</strong> The LLM does not choose
        destinations — you confirm acceptance manually.
      </p>
      {!anyFullMatch ? (
        <p className="text-sm text-rg-warning border border-rg-warning/30 bg-[#fff8f0] px-3 py-2 rounded">
          No facility on record meets every clinician-confirmed need with fresh availability.
          Review gaps below before accepting (simulation).
        </p>
      ) : null}
      <ol className="space-y-4">
        {matches.map((m) => {
          const full = allNeedsMet(m);
          return (
            <li
              key={m.id}
              className={`border rounded-lg overflow-hidden ${
                m.rank === 1 ? "border-rg-accent" : "border-rg-border"
              }`}
            >
              <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3 bg-[#f4fafb]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-rg-accent">Rank #{m.rank}</span>
                    {m.rank === 1 ? (
                      <span className="text-[10px] uppercase tracking-wide text-rg-muted">
                        highest ranked
                      </span>
                    ) : null}
                    {full ? (
                      <span className="text-[10px] uppercase tracking-wide text-rg-ok font-semibold">
                        all needs on record
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-rg-warning font-semibold">
                        gaps present
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/facilities/${m.facility}`}
                    className="font-semibold text-rg-accent hover:underline mt-1 inline-block"
                  >
                    {m.facility_name}
                  </Link>
                  <p className="text-xs text-rg-muted mt-1">
                    {m.distance_km != null ? `${m.distance_km} km (synthetic)` : "—"} · Freshness:{" "}
                    {m.availability_freshness.replace(/_/g, " ")}
                  </p>
                </div>
                {showSelect && onSelect ? (
                  <button
                    type="button"
                    className={selectedFacilityId === m.facility ? "rg-btn" : "rg-btn-secondary"}
                    onClick={() => onSelect(m.facility)}
                  >
                    {selectedFacilityId === m.facility ? "Selected" : "Select for acceptance"}
                  </button>
                ) : null}
              </div>
              <div className="px-4 py-3 space-y-3 bg-white">
                <p className="text-sm text-rg-muted">{m.explanation}</p>
                <CapabilityCoverageTable coverage={m.capability_coverage} needs={needs} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
