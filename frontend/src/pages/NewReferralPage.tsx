import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { facilitiesApi, referralsApi } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";
import { CapabilityNeedsInput } from "@/components/CapabilityNeedsInput";
import { useActionSuccess } from "@/hooks/useActionSuccess";

const DOC_OPTIONS = [
  { value: "UNKNOWN", label: "Unknown" },
  { value: "NOT_RECORDED", label: "Not recorded" },
  { value: "NONE_DOCUMENTED", label: "Explicit negative / none documented" },
  { value: "PRESENT", label: "Present (see notes)" },
] as const;

export function NewReferralPage() {
  const navigate = useNavigate();
  const { data: facilities } = useQuery({
    queryKey: ["facilities"],
    queryFn: () => facilitiesApi.list(),
  });
  const [form, setForm] = useState({
    synthetic_case_id: `RG-${Date.now()}`,
    creating_facility: "",
    urgency: "EMERGENCY",
    referral_reason: "",
    gestational_age_weeks: "34",
    gravida: "2",
    para: "1",
    patient_display_label: "Synthetic patient",
    clinician_confirmed_needs: "OB_CLINICIAN,BLOOD_BANK,THEATRE",
    allergy_status: "NOT_RECORDED",
    medication_history_status: "NOT_RECORDED",
  });
  const [error, setError] = useState<string | null>(null);
  const { trigger, isSuccess } = useActionSuccess();

  const create = useMutation({
    mutationFn: () =>
      referralsApi.create({
        synthetic_case_id: form.synthetic_case_id,
        creating_facility: form.creating_facility,
        urgency: form.urgency,
        referral_reason: form.referral_reason,
        gestational_age_weeks: Number(form.gestational_age_weeks),
        gravida: Number(form.gravida),
        para: Number(form.para),
        patient_display_label: form.patient_display_label,
        clinician_confirmed_needs: form.clinician_confirmed_needs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        documentation_status: {
          allergy: form.allergy_status,
          medication_history: form.medication_history_status,
        },
      } as never),
    onSuccess: (r) => {
      trigger("create");
      window.setTimeout(() => navigate(`/referrals/${r.id}`), 400);
    },
    onError: (e: Error) => setError(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.creating_facility) {
      setError("Select creating facility");
      return;
    }
    create.mutate();
  }

  return (
    <div className="w-full flex justify-center rg-fade-up">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold mb-1 text-center">New referral</h1>
        <p className="text-sm text-rg-muted mb-6 text-center">
          Synthetic patient and pregnancy details. Incomplete drafts are allowed. Do not invent
          missing clinical values — use Unknown / Not recorded / Explicit negative.
        </p>
        <form onSubmit={onSubmit} className="rg-panel p-6 space-y-4">
          <div>
            <label className="rg-label" htmlFor="case-id">
              Case ID
            </label>
            <input
              id="case-id"
              className="rg-input bg-[#f4fafb] text-rg-muted cursor-not-allowed"
              value={form.synthetic_case_id}
              readOnly
              aria-readonly="true"
              title="Auto-generated — not editable. Prevents duplicate case IDs."
            />
            <p className="text-xs text-rg-muted mt-1">
              Assigned automatically when you create the referral. You cannot edit it here.
            </p>
          </div>
          <div>
            <label className="rg-label" htmlFor="facility">
              Creating facility
            </label>
            <select
              id="facility"
              className="rg-input"
              value={form.creating_facility}
              onChange={(e) => setForm({ ...form, creating_facility: e.target.value })}
              required
            >
              <option value="">Select…</option>
              {facilities?.results?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Referral reason"
            value={form.referral_reason}
            onChange={(v) => setForm({ ...form, referral_reason: v })}
          />
          <Field
            label="Gestational age (weeks)"
            value={form.gestational_age_weeks}
            onChange={(v) => setForm({ ...form, gestational_age_weeks: v })}
          />
          <StatusSelect
            id="allergy_status"
            label="Allergy documentation"
            value={form.allergy_status}
            onChange={(v) => setForm({ ...form, allergy_status: v })}
          />
          <StatusSelect
            id="med_status"
            label="Medication history documentation"
            value={form.medication_history_status}
            onChange={(v) => setForm({ ...form, medication_history_status: v })}
          />
          <CapabilityNeedsInput
            value={form.clinician_confirmed_needs}
            onChange={(v) => setForm({ ...form, clinician_confirmed_needs: v })}
          />
          {error ? (
            <p className="text-sm text-rg-critical" role="alert">
              {error}
            </p>
          ) : null}
          <ActionButton
            type="submit"
            className="w-full"
            loading={create.isPending}
            loadingLabel="Saving…"
            success={isSuccess("create")}
            successLabel="Created"
          >
            Create referral
          </ActionButton>
        </form>
      </div>
    </div>
  );
}

function StatusSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="rg-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="rg-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {DOC_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div>
      <label className="rg-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="rg-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
