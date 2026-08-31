import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { adminApi, type SystemSettingRow } from "@/api/client";
import { ActionButton } from "@/components/ActionButton";
import { useActionSuccess } from "@/hooks/useActionSuccess";

export function AdminSettingsPage() {
  const { user, disclaimer } = useAuth();
  const { trigger, isSuccess } = useActionSuccess();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminApi.systemSettings(),
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    if (data?.settings) {
      const init: Record<string, string> = {};
      for (const s of data.settings) {
        if (s.editable && !s.is_secret) {
          init[s.key] = s.value || s.display_value || "";
        }
      }
      setDraft(init);
    }
  }, [data?.settings]);

  const save = useMutation({
    mutationFn: () => adminApi.patchSystemSettings(draft),
    onSuccess: (res) => {
      setMsg({ tone: "ok", text: `Saved: ${res.updated.join(", ") || "no changes"}` });
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 1500);
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => setMsg({ tone: "err", text: e.message }),
  });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createSystemSetting({
        key: newKey,
        label: newLabel,
        value: newValue,
        category: "custom",
      }),
    onSuccess: () => {
      setMsg({ tone: "ok", text: `Created setting ${newKey}` });
      setCreateSuccess(true);
      window.setTimeout(() => setCreateSuccess(false), 1500);
      setNewKey("");
      setNewLabel("");
      setNewValue("");
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => setMsg({ tone: "err", text: e.message }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="space-y-5">
      <div className="rg-panel p-5">
        <h2 className="text-lg font-semibold">Workspace settings</h2>
        <p className="text-sm text-rg-muted mt-1">{data?.architecture_note}</p>
      </div>

      <dl className="rg-panel divide-y divide-rg-border text-sm">
        <Row label="Signed-in user" value={user?.email || "—"} />
        <Row label="Role" value={user?.role?.replace(/_/g, " ") || "—"} />
        <Row label="Disclaimer" value={disclaimer || "Synthetic prototype"} />
      </dl>

      {isLoading ? <p className="text-rg-muted">Loading settings…</p> : null}
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

      {data?.settings ? (
        <form onSubmit={onSubmit} className="rg-panel p-5 space-y-4">
          <h3 className="font-semibold">Editable configuration</h3>
          {data.settings.map((s: SystemSettingRow) => (
            <SettingField
              key={s.key}
              setting={s}
              value={draft[s.key] ?? ""}
              onChange={(v) => setDraft({ ...draft, [s.key]: v })}
            />
          ))}
          <ActionButton type="submit" loading={save.isPending} success={saveSuccess} successLabel="Saved">
            Save settings
          </ActionButton>
        </form>
      ) : null}

      <div className="rg-panel p-5 space-y-3">
        <h3 className="font-semibold text-sm">Add custom setting</h3>
        <input
          className="rg-input"
          placeholder="KEY_NAME"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <input
          className="rg-input"
          placeholder="Label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <input
          className="rg-input"
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
        <ActionButton
          variant="secondary"
          loading={create.isPending}
          success={createSuccess}
          successLabel="Created"
          disabled={!newKey.trim()}
          onClick={() => create.mutate()}
        >
          Create setting
        </ActionButton>
      </div>

      {msg ? (
        <p
          className={`text-sm ${msg.tone === "err" ? "text-rg-critical" : "text-rg-ok"}`}
          role="status"
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}

function SettingField({
  setting,
  value,
  onChange,
}: {
  setting: SystemSettingRow;
  value: string;
  onChange: (v: string) => void;
}) {
  if (setting.is_secret) {
    return (
      <div>
        <label className="rg-label">{setting.label}</label>
        <p className="text-sm text-rg-muted mt-1">{setting.display_value}</p>
        <p className="text-xs text-rg-muted">{setting.help_text}</p>
      </div>
    );
  }
  if (!setting.editable) {
    return (
      <div>
        <label className="rg-label">{setting.label}</label>
        <p className="text-sm mt-1">{setting.display_value}</p>
      </div>
    );
  }
  if (setting.key === "LLM_PROVIDER") {
    return (
      <div>
        <label className="rg-label" htmlFor={setting.key}>
          {setting.label}
        </label>
        <select
          id={setting.key}
          className="rg-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="mock">mock</option>
          <option value="live">live</option>
          <option value="replay">replay</option>
        </select>
        <p className="text-xs text-rg-muted mt-1">{setting.help_text}</p>
      </div>
    );
  }
  return (
    <div>
      <label className="rg-label" htmlFor={setting.key}>
        {setting.label}
      </label>
      <input
        id={setting.key}
        className="rg-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-rg-muted mt-1">{setting.help_text}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid sm:grid-cols-[180px_1fr] gap-2 px-5 py-3">
      <dt className="text-rg-muted font-medium">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
