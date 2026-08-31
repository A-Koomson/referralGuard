export type CapabilityCoverage = Record<
  string,
  {
    present?: boolean;
    state?: string;
    fresh?: boolean;
    expires_at?: string | null;
  }
>;

export function CapabilityCoverageTable({
  coverage,
  needs,
}: {
  coverage: CapabilityCoverage;
  needs: string[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left border border-rg-border">
        <thead className="bg-[#f7fafb] text-rg-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Need code</th>
            <th className="px-3 py-2 font-semibold">On record</th>
            <th className="px-3 py-2 font-semibold">Recorded state</th>
            <th className="px-3 py-2 font-semibold">Availability fresh</th>
          </tr>
        </thead>
        <tbody>
          {needs.map((code) => {
            const row = coverage[code];
            const present = row?.present === true;
            const fresh = row?.fresh === true;
            return (
              <tr key={code} className="border-t border-rg-border">
                <td className="px-3 py-2 font-mono font-medium">{code}</td>
                <td className="px-3 py-2">
                  {present ? (
                    <span className="text-rg-ok font-medium">Yes</span>
                  ) : (
                    <span className="text-rg-critical font-medium">Missing / unknown</span>
                  )}
                </td>
                <td className="px-3 py-2">{row?.state || "—"}</td>
                <td className="px-3 py-2">
                  {!present ? (
                    <span className="text-rg-muted">n/a</span>
                  ) : fresh ? (
                    <span className="text-rg-ok font-medium">Fresh (simulated)</span>
                  ) : (
                    <span className="text-rg-warning font-medium">Stale or unconfirmed</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
