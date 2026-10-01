"use client";

// /dashboard/settings/pipeline - the agency's own sub-stages within the six
// core stages, and custom fields on candidates, jobs and clients
// (lib/custom-fields.js, app/api/customisation).

import { useCallback, useEffect, useState } from "react";
import { getCustomisation, saveCustomisation } from "@/lib/dashboard-api";
import { FIELD_ENTITIES, FIELD_TYPES } from "@/lib/custom-fields";
import { FUNNEL_ORDER, STAGE_COLORS, STAGE_LABELS } from "@/lib/stage-labels";
import { Page, PageHeader, Card, Button, ErrorState, ErrorText, LoadingCard, Select, TextArea, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

const STAGES = [...FUNNEL_ORDER, "Rejected"];
let tempId = 0;
const newKey = () => `new-${++tempId}`;

function RowButtons({ onUp, onDown, onRemove, disabled }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" aria-label="Move up" disabled={disabled || !onUp} onClick={onUp} className="w-7 h-7 rounded-full disabled:opacity-30 hover:bg-[var(--mist)]" style={{ color: INK_MUTED }}>
        ↑
      </button>
      <button type="button" aria-label="Move down" disabled={disabled || !onDown} onClick={onDown} className="w-7 h-7 rounded-full disabled:opacity-30 hover:bg-[var(--mist)]" style={{ color: INK_MUTED }}>
        ↓
      </button>
      <button type="button" aria-label="Remove" disabled={disabled} onClick={onRemove} className="w-7 h-7 rounded-full disabled:opacity-30 hover:bg-[var(--mist)]" style={{ color: "var(--score-low)" }}>
        ×
      </button>
    </div>
  );
}

function move(list, index, by) {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + by, 0, item);
  return next;
}

export default function PipelineSettingsPage() {
  const [status, setStatus] = useState("loading");
  const [canManage, setCanManage] = useState(false);
  const [subStages, setSubStages] = useState([]);
  const [fields, setFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCustomisation({ fresh: true })
      .then((d) => {
        if (cancelled) return;
        setSubStages(d.subStages.map((s) => ({ ...s, key: s.id })));
        setFields(d.customFields.map((f) => ({ ...f, key: f.id, options: (f.options || []).join("\n") })));
        setCanManage(d.canManage);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const d = await saveCustomisation({
        subStages: subStages.map(({ id, label, stage }) => ({ id, label, stage })),
        customFields: fields.map(({ id, label, type, entity, options, hint }) => ({ id, label, type, entity, options, hint })),
      });
      setSubStages(d.subStages.map((s) => ({ ...s, key: s.id })));
      setFields(d.customFields.map((f) => ({ ...f, key: f.id, options: (f.options || []).join("\n") })));
      setNotice("Saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const locked = !canManage || saving;
  const editSub = (key, patch) => setSubStages((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const editField = (key, patch) => setFields((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  return (
    <Page width={900}>
      <PageHeader
        back={{ href: "/dashboard/settings", label: "Settings" }}
        eyebrow="Workspace"
        title="Pipeline & fields"
        subtitle="Make the pipeline match how you work: add your own steps inside each stage, and the extra details you track on candidates, jobs and clients."
      />
      {status === "loading" && <LoadingCard rows={6} />}
      {status === "error" && <ErrorState title="Unable to load these settings" onRetry={retry} />}
      {status === "ready" && (
        <>
          {!canManage && (
            <p className="text-[13px]" style={{ color: INK_MUTED }}>
              Only the workspace owner or an admin can change these.
            </p>
          )}

          <Card title="Sub-stages">
            <p className="text-[12px] mb-4" style={{ color: INK_MUTED }}>
              Steps inside a stage - &quot;CV sent to client&quot; under Shortlisted, &quot;2nd interview&quot; and &quot;Final&quot; under Interview. The six stages stay the same, so the funnel and analytics keep working; sub-stages show on the pipeline board and each profile.
            </p>
            <div className="space-y-5">
              {STAGES.map((stage) => {
                const items = subStages.filter((s) => s.stage === stage);
                return (
                  <div key={stage}>
                    <p className="text-[12px] font-semibold mb-2 flex items-center gap-2" style={{ color: INK }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_COLORS[stage] }} />
                      {STAGE_LABELS[stage]}
                    </p>
                    <ul className="space-y-1.5 pl-4">
                      {items.map((s) => {
                        const all = subStages.indexOf(s);
                        const pos = items.indexOf(s);
                        return (
                          <li key={s.key} className="flex items-center gap-2">
                            <TextInput aria-label="Sub-stage name" maxLength={60} value={s.label} disabled={locked} onChange={(e) => editSub(s.key, { label: e.target.value })} />
                            <RowButtons
                              disabled={locked}
                              onUp={pos > 0 ? () => setSubStages((list) => move(list, all, list.indexOf(items[pos - 1]) - all)) : null}
                              onDown={pos < items.length - 1 ? () => setSubStages((list) => move(list, all, list.indexOf(items[pos + 1]) - all)) : null}
                              onRemove={() => setSubStages((list) => list.filter((x) => x.key !== s.key))}
                            />
                          </li>
                        );
                      })}
                      {canManage && (
                        <li>
                          <button
                            type="button"
                            disabled={locked}
                            className="text-[12px] font-semibold"
                            style={{ color: "var(--forest)" }}
                            onClick={() => setSubStages((list) => [...list, { key: newKey(), label: "", stage }])}
                          >
                            + Add a step
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card
            title="Custom fields"
            action={
              canManage && (
                <Button size="sm" disabled={locked} onClick={() => setFields((list) => [...list, { key: newKey(), label: "", type: "text", entity: "candidate", options: "" }])}>
                  Add field
                </Button>
              )
            }
          >
            <p className="text-[12px] mb-4" style={{ color: INK_MUTED }}>
              Extra details in a &quot;Your fields&quot; card on each profile - notice period, day rate, clearance level, hiring budget. Removing a field hides it; values already entered are kept.
            </p>
            {fields.length === 0 ? (
              <p className="text-[13px]" style={{ color: INK_FAINT }}>
                No custom fields yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {fields.map((f, i) => (
                  <li key={f.key} className="rounded-[10px] p-3 space-y-2" style={{ border: "1px solid var(--border)" }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <TextInput aria-label="Field name" placeholder="Field name" maxLength={60} value={f.label} disabled={locked} onChange={(e) => editField(f.key, { label: e.target.value })} style={{ flex: "2 1 180px", width: "auto" }} />
                      <Select
                        aria-label="On"
                        value={f.entity}
                        disabled={locked}
                        onChange={(e) => editField(f.key, { entity: e.target.value })}
                        options={Object.entries(FIELD_ENTITIES).map(([value, label]) => ({ value, label }))}
                        style={{ flex: "1 1 120px", width: "auto" }}
                      />
                      <Select
                        aria-label="Type"
                        value={f.type}
                        disabled={locked}
                        onChange={(e) => editField(f.key, { type: e.target.value })}
                        options={Object.entries(FIELD_TYPES).map(([value, label]) => ({ value, label }))}
                        style={{ flex: "1 1 140px", width: "auto" }}
                      />
                      <RowButtons
                        disabled={locked}
                        onUp={i > 0 ? () => setFields((list) => move(list, i, -1)) : null}
                        onDown={i < fields.length - 1 ? () => setFields((list) => move(list, i, 1)) : null}
                        onRemove={() => setFields((list) => list.filter((x) => x.key !== f.key))}
                      />
                    </div>
                    {f.type === "select" && (
                      <TextArea rows={3} aria-label="Options" placeholder={"One option per line"} value={f.options} disabled={locked} onChange={(e) => editField(f.key, { options: e.target.value })} />
                    )}
                    <TextInput aria-label="Help text" placeholder="Help text (optional)" maxLength={200} value={f.hint || ""} disabled={locked} onChange={(e) => editField(f.key, { hint: e.target.value })} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <ErrorText>{error}</ErrorText>
          {notice && (
            <p className="text-[12px]" role="status" style={{ color: "var(--forest)" }}>
              {notice}
            </p>
          )}
          {canManage && (
            <div>
              <Button variant="primary" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
