import { useQuery } from "@tanstack/react-query";
import { facilitiesApi } from "@/api/client";

function parseNeeds(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function toggleNeed(value: string, code: string, orderedCodes: string[]): string {
  const selected = new Set(parseNeeds(value));
  if (selected.has(code)) {
    selected.delete(code);
  } else {
    selected.add(code);
  }
  return orderedCodes.filter((c) => selected.has(c)).join(",");
}

export function CapabilityNeedsInput({
  value,
  onChange,
  id = "clinician-confirmed-needs",
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => facilitiesApi.capabilities(),
  });

  const caps = data?.results ?? [];
  const orderedCodes = caps.map((c) => c.code);
  const selected = new Set(parseNeeds(value));

  return (
    <div>
      <label className="rg-label" htmlFor={id}>
        Clinician-confirmed needs
      </label>
      <input
        id={id}
        className="rg-input font-mono text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="OB_CLINICIAN,BLOOD_BANK,THEATRE"
        aria-describedby={`${id}-hint ${id}-options`}
      />
      <p id={`${id}-hint`} className="text-xs text-rg-muted mt-1 leading-relaxed">
        You confirm these needs — the system does not infer them from the referral reason. Click
        options below to add or remove, or type comma-separated codes manually.
      </p>
      <div id={`${id}-options`} className="mt-3 rg-panel p-3 bg-[#f4fafb] border border-rg-border">
        <p className="text-xs font-semibold uppercase tracking-wide text-rg-muted mb-2">
          Available options
        </p>
        {isLoading ? (
          <p className="text-xs text-rg-muted">Loading options…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {caps.map((c) => {
              const active = selected.has(c.code);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange(toggleNeed(value, c.code, orderedCodes))}
                  className={`text-left rounded-md border px-3 py-2 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rg-accent ${
                    active
                      ? "border-rg-accent bg-white shadow-sm"
                      : "border-rg-border bg-white/80 hover:border-rg-accent/60 hover:bg-white"
                  }`}
                  aria-pressed={active}
                  title={c.description || c.name}
                >
                  <span className="block font-mono font-semibold text-rg-accent">{c.code}</span>
                  <span className="block text-rg-muted mt-0.5">{c.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
