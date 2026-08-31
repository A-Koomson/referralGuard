type FooterProps = {
  disclaimer?: string;
  compact?: boolean;
};

export function SiteFooter({ disclaimer, compact = false }: FooterProps) {
  return (
    <footer
      className="rg-site-footer mt-auto text-white"
      style={{
        background: "linear-gradient(180deg, var(--rg-navy-2) 0%, var(--rg-navy) 100%)",
      }}
    >
      <div
        className="h-0.5 w-full"
        style={{
          background: "linear-gradient(90deg, var(--rg-accent), var(--rg-gold), var(--rg-accent))",
        }}
        aria-hidden
      />
      <div className={`mx-auto max-w-6xl px-4 ${compact ? "py-8" : "py-11"}`}>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <p className="text-lg font-semibold">ReferralGuard</p>
            <p className="mt-2 text-sm leading-relaxed text-white/65 max-w-md">
              Emergency maternity referral <strong>documentation verification</strong> and
              coordination prototype. Synthetic data — decision support only.
            </p>
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.14em] mb-3"
              style={{ color: "var(--rg-gold)" }}
            >
              What it checks
            </p>
            <ul className="space-y-2 text-sm text-white/65">
              <li>Missing referral fields (reason, times, attachments)</li>
              <li>Contradictions across draft vs observations</li>
              <li>Unsupported diagnosis statements</li>
              <li>Provisional checklist — not official GHS guidance</li>
            </ul>
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.14em] mb-3"
              style={{ color: "var(--rg-gold)" }}
            >
              Capability codes (matching)
            </p>
            <ul className="space-y-1.5 text-xs text-white/65 font-mono">
              <li>
                <span className="text-white/80">OB_CLINICIAN</span> — obstetric clinician on duty
              </li>
              <li>
                <span className="text-white/80">THEATRE</span> — operating theatre
              </li>
              <li>
                <span className="text-white/80">BLOOD_BANK</span> — transfusion support
              </li>
              <li>
                <span className="text-white/80">NEONATAL</span> — neonatal support
              </li>
              <li>
                <span className="text-white/80">MAGNESIUM</span> — eclampsia stock (synthetic)
              </li>
              <li>
                <span className="text-white/80">AMBULANCE</span> — transfer desk
              </li>
            </ul>
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.14em] mb-3"
              style={{ color: "var(--rg-gold)" }}
            >
              Safety rails
            </p>
            <ul className="space-y-2 text-sm text-white/65">
              <li>Rules-first verification; LLM extracts facts only</li>
              <li>LLM does not rank or auto-select facilities</li>
              <li>Human approval + acceptance required</li>
              <li>Incomplete exports stay unverified</li>
              <li>Mock eval ≠ measured live AI improvement</li>
            </ul>
          </div>
        </div>
        <div className="mt-9 pt-5 flex flex-col gap-2 sm:flex-row sm:justify-between text-xs text-white/45 border-t border-white/10">
          <p>
            {disclaimer ||
              "Hackathon prototype — synthetic data — not for clinical use. Documentation readiness is not medical clearance. Not clinically validated."}
          </p>
          <p>© {new Date().getFullYear()} ReferralGuard · 12 EVAL cases · SQLite demo</p>
        </div>
      </div>
    </footer>
  );
}
