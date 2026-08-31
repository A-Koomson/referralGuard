export function SystemTransparencyPanel() {
  return (
    <section className="rg-panel p-5 border-l-4 border-rg-accent">
      <h2 className="text-base font-semibold mb-2">How this prototype decides</h2>
      <dl className="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-semibold text-rg-accent">Verification findings</dt>
          <dd className="text-rg-muted mt-1 leading-relaxed">
            Mostly <strong>deterministic checklist rules</strong> (missing reason, contradictions,
            etc.). A human must resolve or export incomplete — never auto-fixed.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-rg-accent">LLM (when configured)</dt>
          <dd className="text-rg-muted mt-1 leading-relaxed">
            One structured <strong>fact extraction</strong> pass during analysis. It does{" "}
            <strong>not</strong> rank hospitals or invent missing clinical values.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-rg-accent">Facility matching</dt>
          <dd className="text-rg-muted mt-1 leading-relaxed">
            Compares your <strong>clinician-confirmed need codes</strong> to fictional facility
            records + simulated availability timestamps. Transparent gaps shown per facility.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-rg-accent">Acceptance</dt>
          <dd className="text-rg-muted mt-1 leading-relaxed">
            Explicit human action (simulation). Accepting one referral does not mean the facility
            is universally available.
          </dd>
        </div>
      </dl>
    </section>
  );
}
