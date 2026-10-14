"use client";

// /dashboard/email - the agency's email templates and automated sequences
// (app/api/email-templates, app/api/email-sequences). Templates are used
// from the compose window; candidates are added to sequences from their
// profile or in bulk from Candidates.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getEmailTemplates,
  saveEmailTemplate,
  deleteEmailTemplate,
  getEmailSequences,
  saveEmailSequence,
  deleteEmailSequence,
} from "@/lib/dashboard-api";
import {
  Page,
  PageHeader,
  Card,
  Button,
  Dialog,
  ErrorState,
  ErrorText,
  Field,
  LoadingCard,
  Pill,
  Select,
  TextArea,
  TextInput,
  INK,
  INK_MUTED,
  INK_FAINT,
} from "@/components/dashboard/ui";
import { useConfirm } from "@/components/dashboard/use-confirm";

function FieldChips({ fields, onInsert }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(fields).map(([k, label]) => (
        <button key={k} type="button" onClick={() => onInsert(`{{${k}}}`)} title={`{{${k}}}`} className="text-12 px-2 py-0.5 rounded-full" style={{ border: "1px dashed var(--border)", color: INK_MUTED }}>
          {label}
        </button>
      ))}
    </div>
  );
}

// Inserts at the cursor of the textarea `ref` points at.
function useInsert(ref, value, setValue) {
  return (token) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };
}

function TemplateDialog({ template, fields, onClose, onSaved }) {
  const [f, setF] = useState({ name: template?.name ?? "", audience: template?.audience ?? "candidate", subject: template?.subject ?? "", body: template?.body ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef(null);
  const insert = useInsert(bodyRef, f.body, (body) => setF((v) => ({ ...v, body })));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveEmailTemplate(template?.id, f);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Dialog title={template ? "Edit template" : "New template"} onClose={onClose} busy={saving} width={680}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-[2fr_1fr] gap-3">
          <Field label="Name">
            <TextInput required maxLength={120} value={f.name} onChange={(e) => setF((v) => ({ ...v, name: e.target.value }))} placeholder="e.g. Interview invite - first round" />
          </Field>
          <Field label="For">
            <Select value={f.audience} onChange={(e) => setF((v) => ({ ...v, audience: e.target.value }))} options={[{ value: "candidate", label: "Candidates" }, { value: "client", label: "Clients" }]} />
          </Field>
        </div>
        <Field label="Subject">
          <TextInput required maxLength={300} value={f.subject} onChange={(e) => setF((v) => ({ ...v, subject: e.target.value }))} />
        </Field>
        <Field label="Message">
          <TextArea ref={bodyRef} required rows={10} maxLength={20000} value={f.body} onChange={(e) => setF((v) => ({ ...v, body: e.target.value }))} />
        </Field>
        <FieldChips fields={fields} onInsert={insert} />
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save template"}</Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}

function SequenceDialog({ sequence, fields, onClose, onSaved }) {
  const [name, setName] = useState(sequence?.name ?? "");
  const [steps, setSteps] = useState(sequence?.steps?.length ? sequence.steps : [{ delayDays: 0, subject: "", body: "" }]);
  const [focused, setFocused] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const refs = useRef([]);

  const setStep = (i, patch) => setSteps((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  function insert(token) {
    const el = refs.current[focused];
    const body = steps[focused]?.body ?? "";
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setStep(focused, { body: body.slice(0, start) + token + body.slice(end) });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveEmailSequence(sequence?.id, { name, steps: steps.map((s) => ({ ...s, delayDays: Number(s.delayDays) })) });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Dialog title={sequence ? "Edit sequence" : "New sequence"} onClose={onClose} busy={saving} width={720}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <TextInput required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Passive candidate nurture" />
        </Field>
        {steps.map((s, i) => (
          <div key={i} className="rounded-xl p-3 space-y-2" style={{ border: "1px solid var(--border)" }}>
            <div className="flex flex-wrap items-center gap-2 text-13" style={{ color: INK }}>
              <span className="font-semibold">Email {i + 1}</span>
              <span style={{ color: INK_MUTED }}>sent</span>
              <TextInput type="number" min={0} max={90} value={s.delayDays} onChange={(e) => setStep(i, { delayDays: e.target.value })} className="!w-20" aria-label={`Days before email ${i + 1}`} />
              <span style={{ color: INK_MUTED }}>{i === 0 ? "days after they're added" : "days after the previous email"}</span>
              {steps.length > 1 && (
                <button type="button" className="ml-auto text-12 font-semibold" style={{ color: INK_FAINT }} onClick={() => setSteps((list) => list.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </div>
            <TextInput required maxLength={300} value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder="Subject" aria-label={`Subject of email ${i + 1}`} />
            <TextArea
              ref={(el) => (refs.current[i] = el)}
              required
              rows={5}
              maxLength={20000}
              value={s.body}
              onFocus={() => setFocused(i)}
              onChange={(e) => setStep(i, { body: e.target.value })}
              aria-label={`Message of email ${i + 1}`}
            />
          </div>
        ))}
        {steps.length < 10 && (
          <Button onClick={() => setSteps((list) => [...list, { delayDays: 3, subject: "", body: "" }])}>+ Add a follow-up email</Button>
        )}
        <div>
          <p className="text-12 font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>Insert into email {focused + 1}</p>
          <FieldChips fields={fields} onInsert={insert} />
        </div>
        <p className="text-13" style={{ color: INK_MUTED }}>
          Sequences stop automatically when the candidate replies (if reply capture is on), is rejected or is placed.
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save sequence"}</Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function EmailSettingsPage() {
  const [ask, confirmDialog] = useConfirm();
  const [data, setData] = useState(null);
  const [sequences, setSequences] = useState([]);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [templateDialog, setTemplateDialog] = useState(null);
  const [sequenceDialog, setSequenceDialog] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getEmailTemplates(), getEmailSequences()])
      .then(([t, s]) => {
        if (cancelled) return;
        setData(t);
        setSequences(s);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const closeTemplate = useCallback(() => setTemplateDialog(null), []);
  const closeSequence = useCallback(() => setSequenceDialog(null), []);

  async function run(fn) {
    setError("");
    try {
      await fn();
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      {confirmDialog}
    <Page>
      <PageHeader
        eyebrow="Outreach"
        title="Email templates & sequences"
        subtitle="Reusable emails with merge fields, and automated follow-up series. Everything sent is kept on the candidate's record."
      />
      {status === "loading" && <LoadingCard rows={6} />}
      {status === "error" && <ErrorState title="Unable to load your email settings" onRetry={reload} />}
      {status === "ready" && (
        <>
          {!data.repliesCaptured && (
            // Plain words for the agency: the set-up itself (environment
            // variables and a Resend webhook) is Helixon's job, and the
            // startup check in lib/env.js tells the people who can do it.
            <div className="rounded-xl px-4 py-3 text-13" style={{ background: "var(--ui-warn-soft)", color: "var(--ui-warn)", border: "1px solid rgba(138,90,18,0.2)" }}>
              Replies go straight to the sender&apos;s inbox for now. Filing them on the candidate&apos;s record, and stopping a sequence when
              someone replies, isn&apos;t switched on for your workspace yet - email{" "}
              <a href="mailto:support@helixon.co.uk" className="underline font-semibold">support@helixon.co.uk</a> and we&apos;ll turn it on.
            </div>
          )}
          <ErrorText>{error}</ErrorText>
          <Card title="Templates" eyebrow={`${data.templates.length} saved`} action={<Button variant="primary" size="sm" onClick={() => setTemplateDialog("new")}>New template</Button>}>
            {data.templates.length === 0 ? (
              <p className="text-14" style={{ color: INK_MUTED }}>No templates yet - save the emails you send most, like interview invites and rejections.</p>
            ) : (
              <ul className="divide-y">
                {data.templates.map((t) => (
                  <li key={t.id} className="py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-14 font-semibold truncate" style={{ color: INK }}>
                        {t.name} {t.audience === "client" && <Pill>Client</Pill>}
                      </p>
                      <p className="text-13 truncate" style={{ color: INK_MUTED }}>{t.subject}</p>
                    </div>
                    <span className="text-12 tabular-nums" style={{ color: INK_FAINT }}>used {t.uses}×</span>
                    <Button size="sm" onClick={() => setTemplateDialog(t)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={async () => (await ask({ title: `Delete "${t.name}"?`, confirmLabel: "Delete template", danger: true })) && run(() => deleteEmailTemplate(t.id))}>Delete</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Sequences" eyebrow={`${sequences.length} saved`} action={<Button variant="primary" size="sm" onClick={() => setSequenceDialog("new")}>New sequence</Button>}>
            {sequences.length === 0 ? (
              <p className="text-14" style={{ color: INK_MUTED }}>No sequences yet - e.g. a three-email nurture for passive candidates, sent a few days apart.</p>
            ) : (
              <ul className="divide-y">
                {sequences.map((s) => (
                  <li key={s.id} className="py-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-14 font-semibold truncate" style={{ color: INK }}>
                        {s.name} {!s.active && <Pill>Paused</Pill>}
                      </p>
                      <p className="text-13" style={{ color: INK_MUTED }}>
                        {s.steps.length} email{s.steps.length === 1 ? "" : "s"} over {s.steps.reduce((a, x) => a + Number(x.delayDays || 0), 0)} days · {s.stats.active} active · {s.stats.completed} finished · {s.stats.replied} replied
                      </p>
                    </div>
                    <Button size="sm" onClick={() => run(() => saveEmailSequence(s.id, { active: !s.active }))}>{s.active ? "Pause" : "Resume"}</Button>
                    <Button size="sm" onClick={() => setSequenceDialog(s)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={async () => (await ask({ title: `Delete "${s.name}"?`, body: "Everyone on it stops getting its emails.", confirmLabel: "Delete sequence", danger: true })) && run(() => deleteEmailSequence(s.id))}>Delete</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      {templateDialog && (
        <TemplateDialog template={templateDialog === "new" ? null : templateDialog} fields={data.mergeFields} onClose={closeTemplate} onSaved={() => { setTemplateDialog(null); reload(); }} />
      )}
      {sequenceDialog && (
        <SequenceDialog sequence={sequenceDialog === "new" ? null : sequenceDialog} fields={data.mergeFields} onClose={closeSequence} onSaved={() => { setSequenceDialog(null); reload(); }} />
      )}
    </Page>
    </>
  );
}
