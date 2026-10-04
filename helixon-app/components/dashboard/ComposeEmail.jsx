"use client";

// Compose an email to one or many candidates: start from a template (or
// blank), insert merge fields, preview exactly what each person gets, then
// send - each email separately, kept on their thread (app/api/emails/send).

import { useEffect, useRef, useState } from "react";
import { getEmailTemplates, sendCandidateEmails } from "@/lib/dashboard-api";
import { Button, Dialog, ErrorText, Field, Select, TextArea, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

export default function ComposeEmail({ candidateIds, onClose, onSent, title }) {
  const [templates, setTemplates] = useState([]);
  const [fields, setFields] = useState({});
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    getEmailTemplates()
      .then((d) => {
        setTemplates(d.templates.filter((t) => t.audience === "candidate"));
        setFields(d.mergeFields);
      })
      .catch(() => {});
  }, []);

  function pickTemplate(id) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
    }
  }

  function insertField(key) {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function doPreview() {
    setBusy(true);
    setError("");
    try {
      setPreview(await sendCandidateEmails({ candidateIds, subject, body, templateId: templateId || undefined, preview: true }));
      setIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doSend() {
    setBusy(true);
    setError("");
    try {
      const res = await sendCandidateEmails({ candidateIds, subject, body, templateId: templateId || undefined });
      setResult(res);
      onSent?.(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const many = candidateIds.length > 1;
  const current = preview?.emails[index];
  const missingCount = preview ? preview.emails.filter((e) => e.missing.length).length : 0;

  return (
    <Dialog title={title || (many ? `Email ${candidateIds.length} candidates` : "Email candidate")} onClose={onClose} busy={busy} width={680}>
      {result ? (
        <div className="space-y-3 text-[13px]" style={{ color: INK }}>
          <p>
            Sent {result.sent} email{result.sent === 1 ? "" : "s"}
            {result.failed ? `, ${result.failed} failed` : ""}.
          </p>
          {result.skippedNoEmail?.length > 0 && (
            <p style={{ color: INK_MUTED }}>No email address for: {result.skippedNoEmail.join(", ")}</p>
          )}
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      ) : preview ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[12px]" style={{ color: INK_MUTED }}>
            <span>
              {current.name} {current.email ? `<${current.email}>` : "- no email address, won't be sent"}
            </span>
            {preview.emails.length > 1 && (
              <span className="flex items-center gap-2">
                <Button size="sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>←</Button>
                {index + 1} / {preview.emails.length}
                <Button size="sm" disabled={index === preview.emails.length - 1} onClick={() => setIndex((i) => i + 1)}>→</Button>
              </span>
            )}
          </div>
          <div className="rounded-[10px] p-4 text-[13px] whitespace-pre-wrap" style={{ border: "1px solid var(--border)", color: INK }}>
            <p className="font-semibold mb-3">{current.subject}</p>
            {current.body}
          </div>
          {current.missing.length > 0 && (
            <p className="text-[12px]" style={{ color: "#92620f" }}>
              Empty for {current.name}: {current.missing.map((m) => `{{${m}}}`).join(", ")}
            </p>
          )}
          {missingCount > 0 && preview.emails.length > 1 && (
            <p className="text-[12px]" style={{ color: "#92620f" }}>
              {missingCount} of {preview.emails.length} emails have an empty merge field - check them before sending.
            </p>
          )}
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy || preview.sendable === 0} onClick={doSend}>
              {busy ? "Sending…" : `Send ${preview.sendable} email${preview.sendable === 1 ? "" : "s"}`}
            </Button>
            <Button onClick={() => setPreview(null)} disabled={busy}>Back to edit</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.length > 0 && (
            <Field label="Start from a template">
              <Select value={templateId} onChange={(e) => pickTemplate(e.target.value)} options={[{ value: "", label: "Blank email" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]} />
            </Field>
          )}
          <Field label="Subject">
            <TextInput maxLength={300} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message">
            <TextArea ref={bodyRef} rows={10} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>Insert</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(fields).map(([k, label]) => (
                <button key={k} type="button" onClick={() => insertField(k)} title={`{{${k}}}`} className="text-[11px] px-2 py-0.5 rounded-full" style={{ border: "1px dashed var(--border)", color: INK_MUTED }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy || !subject.trim() || !body.trim()} onClick={doPreview}>
              {busy ? "Preparing…" : "Preview"}
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
