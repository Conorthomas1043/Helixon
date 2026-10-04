"use client";

// The candidate profile's Compliance card: whether they've had the privacy
// notice (or given consent), right-to-work and other checks with expiry
// dates and a copy of the document, and references (lib/compliance.js).

import { useCallback, useEffect, useState } from "react";
import {
  addComplianceCheck,
  complianceDocumentLink,
  deleteComplianceCheck,
  deleteReference,
  getCandidateCompliance,
  getReferenceLink,
  privacyNoticeAction,
  requestReference,
  updateComplianceCheck,
  updateReference,
} from "@/lib/dashboard-api";
import { CHECK_KINDS, CHECK_STATUSES, REFERENCE_QUESTIONS, RTW_DOCUMENTS, checkState } from "@/lib/compliance";
import { Button, Card, Dialog, ErrorText, Field, Pill, Select, TextArea, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

const STATE_PILL = {
  ok: ["Verified", "#1f6f43", "#e5f4ea"],
  expiring: ["Expiring soon", "#8a5a00", "#fdf3dc"],
  expired: ["Expired", "var(--score-low)", "#fbeaea"],
  pending: ["To do", INK_MUTED, "var(--mist)"],
  failed: ["Failed", "var(--score-low)", "#fbeaea"],
};

export function CheckStatePill({ state }) {
  const [label, color, background] = STATE_PILL[state] || STATE_PILL.pending;
  return (
    <Pill color={color} background={background}>
      {label}
    </Pill>
  );
}

function fmt(d) {
  if (!d) return null;
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function CheckDialog({ candidateId, check, onClose, onSaved }) {
  const [f, setF] = useState({
    kind: check?.kind || "right_to_work",
    label: check?.label || "",
    status: check?.status || "verified",
    documentType: check?.documentType || "",
    checkedOn: check?.checkedOn || new Date().toISOString().slice(0, 10),
    expiresOn: check?.expiresOn || "",
    followUpOn: check?.followUpOn || "",
    notes: check?.notes || "",
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (check) await updateComplianceCheck(candidateId, check.id, f, file);
      else await addComplianceCheck(candidateId, f, file);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title={check ? "Edit check" : "Add a check"} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check">
            <Select value={f.kind} onChange={set("kind")} options={Object.entries(CHECK_KINDS).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Result">
            <Select value={f.status} onChange={set("status")} options={Object.entries(CHECK_STATUSES).map(([value, label]) => ({ value, label }))} />
          </Field>
        </div>
        {f.kind !== "right_to_work" && (
          <Field label="Name" hint="e.g. Enhanced DBS, CSCS card, NMC PIN">
            <TextInput maxLength={120} value={f.label} onChange={set("label")} />
          </Field>
        )}
        <Field label="Evidence seen">
          {f.kind === "right_to_work" ? (
            <Select value={f.documentType} onChange={set("documentType")} options={[{ value: "", label: "Pick…" }, ...RTW_DOCUMENTS.map((d) => ({ value: d, label: d }))]} />
          ) : (
            <TextInput maxLength={120} value={f.documentType} onChange={set("documentType")} placeholder="Certificate number, document type…" />
          )}
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Checked on">
            <TextInput type="date" value={f.checkedOn} onChange={set("checkedOn")} />
          </Field>
          <Field label="Expires">
            <TextInput type="date" value={f.expiresOn} onChange={set("expiresOn")} />
          </Field>
          <Field label="Re-check by" hint={f.kind === "right_to_work" ? "Time-limited permission" : null}>
            <TextInput type="date" value={f.followUpOn} onChange={set("followUpOn")} />
          </Field>
        </div>
        <Field label="Notes" hint={f.kind === "right_to_work" ? "Share code, who checked, how - kept as your record of the check." : null}>
          <TextArea maxLength={2000} value={f.notes} onChange={set("notes")} />
        </Field>
        <Field label={check?.document ? `Replace document (${check.document.name})` : "Copy of the document (optional)"} hint="PDF, JPG or PNG, up to 10MB. Stored privately; removed if the candidate is deleted.">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-[12px]" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ReferenceDialog({ candidateId, onClose, onSaved }) {
  const [f, setF] = useState({ refereeName: "", refereeEmail: "", refereeCompany: "", refereeTitle: "", refereePhone: "", relationship: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await requestReference(candidateId, { ...f, send: true });
      onSaved(res);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title="Ask for a reference" onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Referee's name">
            <TextInput required maxLength={200} value={f.refereeName} onChange={set("refereeName")} />
          </Field>
          <Field label="Email" hint="They're emailed a short form to fill in.">
            <TextInput type="email" maxLength={254} value={f.refereeEmail} onChange={set("refereeEmail")} />
          </Field>
          <Field label="Company">
            <TextInput maxLength={200} value={f.refereeCompany} onChange={set("refereeCompany")} />
          </Field>
          <Field label="Their job title">
            <TextInput maxLength={200} value={f.refereeTitle} onChange={set("refereeTitle")} />
          </Field>
          <Field label="Phone">
            <TextInput maxLength={40} value={f.refereePhone} onChange={set("refereePhone")} />
          </Field>
          <Field label="Relationship">
            <TextInput maxLength={200} value={f.relationship} onChange={set("relationship")} placeholder="Line manager" />
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : f.refereeEmail ? "Save and email them" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ReferenceAnswers({ answers }) {
  if (!answers) return null;
  if (answers.method === "phone") {
    return (
      <p className="text-[12px] whitespace-pre-wrap mt-1" style={{ color: INK }}>
        {answers.comments}
        <span className="block text-[11px]" style={{ color: INK_FAINT }}>
          Taken by phone by {answers.takenBy}
        </span>
      </p>
    );
  }
  return (
    <dl className="mt-2 space-y-1.5 text-[12px]">
      {REFERENCE_QUESTIONS.filter((q) => answers[q.id] != null).map((q) => (
        <div key={q.id}>
          <dt style={{ color: INK_FAINT }}>{q.label}</dt>
          <dd className="whitespace-pre-wrap" style={{ color: INK }}>
            {q.type === "rating" ? `${answers[q.id]} / 5` : answers[q.id]}
          </dd>
        </div>
      ))}
      <p className="text-[11px]" style={{ color: INK_FAINT }}>
        Completed by {answers.completedBy}
        {answers.completedByTitle ? `, ${answers.completedByTitle}` : ""}
      </p>
    </dl>
  );
}

export default function CompliancePanel({ candidate, onChanged }) {
  const [data, setData] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [openRef, setOpenRef] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCandidateCompliance(candidate.id)
      .then((d) => {
        if (!cancelled) setData({ ...d, today: new Date().toISOString().slice(0, 10) });
      })
      .catch(() => {
        if (!cancelled) setData({ checks: [], references: [], privacy: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [candidate.id, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
    onChanged?.();
  }, [onChanged]);
  const close = useCallback(() => setDialog(null), []);

  const run = async (fn, done) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fn();
      if (done) setNotice(typeof done === "function" ? done(r) : done);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  async function openDocument(check) {
    setError(null);
    try {
      window.open(await complianceDocumentLink(candidate.id, check.id), "_blank", "noopener");
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyLink(ref) {
    setError(null);
    try {
      await navigator.clipboard.writeText(await getReferenceLink(candidate.id, ref.id));
      setNotice("Link copied - send it to the referee yourself.");
    } catch (err) {
      setError(err.message || "Couldn't copy the link.");
    }
  }

  const p = data?.privacy;
  const rtw = data?.checks.find((c) => c.kind === "right_to_work");

  return (
    <Card eyebrow="Compliance" title={rtw ? `Right to work: ${CHECK_STATUSES[rtw.status]}` : "Compliance"}>
      {!data ? (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>Loading…</p>
      ) : data.failed ? (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>Compliance records couldn&apos;t be loaded.</p>
      ) : (
        <div className="space-y-5">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
              Privacy
            </p>
            <p className="text-[12px]" style={{ color: INK }}>
              {p.consentGivenAt
                ? `Consent given ${fmt(p.consentGivenAt)}${p.consentSource ? ` (${p.consentSource.replace(/_/g, " ")})` : ""}.`
                : p.noticeSentAt
                  ? `Privacy notice sent ${fmt(p.noticeSentAt)}.`
                  : p.due
                    ? `Privacy notice ${p.due.overdue ? "overdue" : "due"} by ${fmt(p.due.dueOn)} - they didn't apply directly, so they need telling how you use their data.`
                    : "Applied through your jobs page, so they saw your privacy notice."}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {!p.noticeSentAt && (
                <Button size="sm" variant={p.due ? "primary" : "secondary"} disabled={busy || !candidate.email} title={candidate.email ? null : "No email address on file"} onClick={() => run(() => privacyNoticeAction(candidate.id, "send"), "Privacy notice sent.")}>
                  Email privacy notice
                </Button>
              )}
              {p.consentGivenAt ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm("Record that they've withdrawn consent?") && run(() => privacyNoticeAction(candidate.id, "withdraw"), "Consent withdrawn.")}>
                  Consent withdrawn
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    const how = window.prompt("How did they give consent? (e.g. on a call, by email)", "on a call");
                    if (how) run(() => privacyNoticeAction(candidate.id, "consent", { source: how }), "Consent recorded.");
                  }}
                >
                  Record consent
                </Button>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: INK_FAINT }}>
                Checks
              </p>
              <Button size="sm" onClick={() => setDialog({ type: "check" })}>
                Add check
              </Button>
            </div>
            {data.checks.length === 0 ? (
              <p className="text-[12px]" style={{ color: INK_MUTED }}>
                No checks recorded. Add right to work before they start.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.checks.map((c) => (
                  <li key={c.id} className="text-[12px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold" style={{ color: INK }}>
                        {c.label || CHECK_KINDS[c.kind]}
                      </span>
                      <CheckStatePill state={checkState(c, data.today)} />
                    </div>
                    <p style={{ color: INK_MUTED }}>
                      {[c.documentType, c.checkedOn && `checked ${fmt(c.checkedOn)}${c.checkedBy ? ` by ${c.checkedBy}` : ""}`, c.expiresOn && `expires ${fmt(c.expiresOn)}`, c.followUpOn && `re-check by ${fmt(c.followUpOn)}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {c.notes && (
                      <p className="whitespace-pre-wrap" style={{ color: INK_MUTED }}>
                        {c.notes}
                      </p>
                    )}
                    <div className="flex gap-3 mt-0.5">
                      {c.document && (
                        <button type="button" className="font-semibold" style={{ color: "var(--forest)" }} onClick={() => openDocument(c)}>
                          Open document
                        </button>
                      )}
                      <button type="button" style={{ color: INK_MUTED }} onClick={() => setDialog({ type: "check", check: c })}>
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        style={{ color: INK_FAINT }}
                        onClick={() => window.confirm("Delete this check and any stored document?") && run(() => deleteComplianceCheck(candidate.id, c.id))}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: INK_FAINT }}>
                References
              </p>
              <Button size="sm" onClick={() => setDialog({ type: "reference" })}>
                Ask for reference
              </Button>
            </div>
            {data.references.length === 0 ? (
              <p className="text-[12px]" style={{ color: INK_MUTED }}>
                None yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {data.references.map((r) => (
                  <li key={r.id} className="text-[12px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold" style={{ color: INK }}>
                        {r.refereeName}
                      </span>
                      <span style={{ color: INK_MUTED }}>{[r.refereeTitle, r.refereeCompany].filter(Boolean).join(", ")}</span>
                      <Pill color={r.status === "received" ? "#1f6f43" : r.status === "declined" ? "var(--score-low)" : INK_MUTED} background={r.status === "received" ? "#e5f4ea" : undefined}>
                        {r.status === "requested" ? (r.requestedAt ? "Awaiting" : "Not sent") : r.status === "received" ? "Received" : "Declined"}
                      </Pill>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-0.5">
                      {r.status === "received" && (
                        <button type="button" className="font-semibold" style={{ color: "var(--forest)" }} onClick={() => setOpenRef(openRef === r.id ? null : r.id)}>
                          {openRef === r.id ? "Hide reference" : "Read reference"}
                        </button>
                      )}
                      {r.status === "requested" && (
                        <>
                          {r.refereeEmail && (
                            <button type="button" disabled={busy} style={{ color: "var(--forest)" }} onClick={() => run(() => updateReference(candidate.id, r.id, { action: "resend" }), `Emailed ${r.refereeName}.`)}>
                              {r.requestedAt ? "Send reminder" : "Email form"}
                            </button>
                          )}
                          <button type="button" style={{ color: INK_MUTED }} onClick={() => copyLink(r)}>
                            Copy link
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            style={{ color: INK_MUTED }}
                            onClick={() => {
                              const notes = window.prompt(`What did ${r.refereeName} say?`);
                              if (notes) run(() => updateReference(candidate.id, r.id, { action: "taken", notes }), "Reference saved.");
                            }}
                          >
                            Took it by phone
                          </button>
                        </>
                      )}
                      <button type="button" disabled={busy} style={{ color: INK_FAINT }} onClick={() => window.confirm("Delete this reference?") && run(() => deleteReference(candidate.id, r.id))}>
                        Delete
                      </button>
                    </div>
                    {openRef === r.id && <ReferenceAnswers answers={r.answers} />}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <ErrorText>{error}</ErrorText>
          {notice && (
            <p className="text-[12px]" role="status" style={{ color: "var(--forest)" }}>
              {notice}
            </p>
          )}
        </div>
      )}
      {dialog?.type === "check" && (
        <CheckDialog
          candidateId={candidate.id}
          check={dialog.check}
          onClose={close}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {dialog?.type === "reference" && (
        <ReferenceDialog
          candidateId={candidate.id}
          onClose={close}
          onSaved={(res) => {
            setDialog(null);
            setNotice(res.emailError ? `Saved, but the email couldn't be sent (${res.emailError}). Use "Copy link" to send it yourself.` : res.reference.requestedAt ? "Reference request emailed." : "Saved - use “Copy link” to send them the form.");
            reload();
          }}
        />
      )}
    </Card>
  );
}
