"use client";

// The agency's own sub-stages and custom fields on screen
// (lib/custom-fields.js): a sub-stage picker for under the stage select,
// a sub-stage label for cards, and a card of custom fields for a
// candidate, job or client.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCustomisation, setCustomFieldValues } from "@/lib/dashboard-api";
import { fieldsFor, formatFieldValue, subStagesFor } from "@/lib/custom-fields";
import { Button, Card, ErrorText, Field, Select, TextArea, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

// The customisation, or null while loading / if it couldn't be read.
export function useCustomisation() {
  const [value, setValue] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getCustomisation()
      .then((c) => {
        if (!cancelled) setValue(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return value;
}

// The sub-stage's label, when it belongs to the stage they're in now.
export function subStageLabel(customisation, stage, subStage) {
  if (!subStage || !customisation) return null;
  const s = customisation.subStages.find((x) => x.id === subStage);
  return s && s.stage === stage ? s.label : null;
}

export function SubStagePicker({ stage, subStage, onChange, disabled, className = "" }) {
  const c = useCustomisation();
  const options = c ? subStagesFor(c.subStages, stage) : [];
  if (!options.length) return null;
  const current = options.some((o) => o.id === subStage) ? subStage : "";
  return (
    <select
      aria-label="Sub-stage"
      value={current}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className={`w-full text-sm px-3 py-2 rounded-[10px] bg-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      style={{ border: "1px solid var(--border)", color: INK }}
    >
      <option value="">No sub-stage</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FieldInput({ def, value, onChange }) {
  const v = value ?? "";
  switch (def.type) {
    case "longtext":
      return <TextArea rows={3} maxLength={4000} value={v} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <TextInput type="number" inputMode="decimal" step="any" value={v} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <TextInput type="date" value={v} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return <Select value={v} onChange={(e) => onChange(e.target.value)} options={[{ value: "", label: "-" }, ...def.options.map((o) => ({ value: o, label: o }))]} />;
    case "checkbox":
      return (
        <Select
          value={v === true ? "yes" : v === false ? "no" : ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value === "yes")}
          options={[
            { value: "", label: "-" },
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
      );
    case "url":
      return <TextInput type="url" inputMode="url" maxLength={500} value={v} onChange={(e) => onChange(e.target.value)} placeholder="https://" />;
    default:
      return <TextInput maxLength={300} value={v} onChange={(e) => onChange(e.target.value)} />;
  }
}

// entity: "candidate" | "job" | "client". Shows nothing when the agency
// has no fields for it.
export function CustomFieldsCard({ entity, recordId, values: initial, onSaved }) {
  const c = useCustomisation();
  const [values, setValues] = useState(initial || {});
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const defs = c ? fieldsFor(c.customFields, entity) : [];
  if (!defs.length) return null;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const changed = Object.fromEntries(defs.filter((d) => draft[d.id] !== values[d.id]).map((d) => [d.id, draft[d.id] ?? ""]));
      const saved = Object.keys(changed).length ? await setCustomFieldValues(entity, recordId, changed) : values;
      setValues(saved);
      setDraft(null);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      eyebrow="Your fields"
      title="Details"
      action={
        !draft && (
          <Button size="sm" onClick={() => setDraft({ ...values })}>
            Edit
          </Button>
        )
      }
    >
      {draft ? (
        <form onSubmit={save} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {defs.map((d) => (
              <Field key={d.id} label={d.label} hint={d.hint} className={d.type === "longtext" ? "sm:col-span-2" : ""}>
                <FieldInput def={d} value={draft[d.id]} onChange={(v) => setDraft((x) => ({ ...x, [d.id]: v }))} />
              </Field>
            ))}
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
          {defs.map((d) => {
            const shown = formatFieldValue(d, values[d.id]);
            return (
              <div key={d.id} className={d.type === "longtext" ? "sm:col-span-2" : ""}>
                <dt className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: INK_FAINT }}>
                  {d.label}
                </dt>
                <dd className="text-[13px] whitespace-pre-wrap break-words" style={{ color: shown ? INK : INK_FAINT }}>
                  {!shown ? (
                    "-"
                  ) : d.type === "url" ? (
                    <a href={values[d.id]} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--forest)" }}>
                      {shown.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    shown
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {c?.canManage && (
        <p className="text-[11px] mt-3" style={{ color: INK_MUTED }}>
          <Link href="/dashboard/settings/pipeline" className="underline">
            Change these fields
          </Link>
        </p>
      )}
    </Card>
  );
}
