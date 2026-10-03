"use client";

// Documents sent for e-signature (app/api/signatures, lib/signatures.js),
// on a client's page (terms of business) or a candidate's (offer letters,
// contracts). `template(kind, agencyName)` returns { title, body } to start
// the document from.

import { useCallback, useEffect, useState } from "react";
import { createSignatureRequest, getSignatureRequest, getSignatureRequests, voidSignatureRequest } from "@/lib/dashboard-api";
import { SIGNATURE_KINDS, SIGNATURE_STATUSES } from "@/lib/signatures-shared";
import { Button, Card, Dialog, ErrorText, Field, Pill, Select, TextArea, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";
import { formatDateOnly } from "@/lib/candidate-format";

const STATUS_STYLE = {
  sent: [INK_MUTED, "var(--mist)"],
  signed: ["var(--forest)", "var(--mint)"],
  declined: ["var(--score-low)", "rgba(192,57,43,0.08)"],
  void: [INK_FAINT, "var(--mist)"],
};

// The agency's name goes into the starting wording, so the form waits for it.
function NewDocumentDialog(props) {
  const [agency, setAgency] = useState({ loaded: false, name: null });
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAgency({ loaded: true, name: d?.user?.agencyName || null }))
      .catch(() => setAgency({ loaded: true, name: null }));
  }, []);
  if (!agency.loaded) {
    return (
      <Dialog title="Send for signature" onClose={props.onClose}>
        <p className="text-[13px]" style={{ color: INK_FAINT }}>Loading…</p>
      </Dialog>
    );
  }
  return <NewDocumentForm {...props} agencyName={agency.name} />;
}

function NewDocumentForm({ kinds, signer, template, clientId, candidateId, placementId, agencyName, onClose, onSaved }) {
  const [kind, setKind] = useState(kinds[0]);
  const [f, setF] = useState(() => ({ ...template(kinds[0], agencyName), signerName: signer?.name || "", signerEmail: signer?.email || "" }));
  const [edited, setEdited] = useState(false);
  const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  function changeKind(next) {
    setKind(next);
    if (!edited) setF((x) => ({ ...x, ...template(next, agencyName) }));
  }
  const set = (k) => (e) => {
    if (k === "title" || k === "body") setEdited(true);
    setF((x) => ({ ...x, [k]: e.target.value }));
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await createSignatureRequest({ kind, ...f, clientId, candidateId, placementId, send: send && Boolean(f.signerEmail) });
      setDone(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Dialog title="Sent for signature" onClose={onSaved}>
        <p className="text-[13px] mb-3" style={{ color: INK_MUTED }}>
          {done.emailError ? `The email couldn't be sent (${done.emailError}). Share this link instead:` : send && f.signerEmail ? `We've emailed ${f.signerEmail} a link to sign. You can also share it yourself:` : "Share this private link with the signer:"}
        </p>
        <TextInput readOnly value={done.link} onFocus={(e) => e.target.select()} aria-label="Signing link" />
        <div className="flex gap-2 mt-4">
          <Button variant="primary" onClick={() => navigator.clipboard?.writeText(done.link)}>Copy link</Button>
          <Button onClick={onSaved}>Done</Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Send for signature" onClose={onClose} busy={busy} width={720}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {kinds.length > 1 && (
            <Field label="Document">
              <Select value={kind} onChange={(e) => changeKind(e.target.value)} options={kinds.map((k) => ({ value: k, label: SIGNATURE_KINDS[k] }))} />
            </Field>
          )}
          <Field label="Title">
            <TextInput required maxLength={200} value={f.title} onChange={set("title")} />
          </Field>
          <Field label="Signer's name">
            <TextInput required maxLength={200} value={f.signerName} onChange={set("signerName")} />
          </Field>
          <Field label="Signer's email">
            <TextInput type="email" maxLength={254} value={f.signerEmail} onChange={set("signerEmail")} />
          </Field>
        </div>
        <Field label="Wording" hint="A starting point from what's on file - check it, and take your own legal advice on terms.">
          <TextArea required rows={14} maxLength={60000} value={f.body} onChange={set("body")} />
        </Field>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: INK }}>
          <input type="checkbox" checked={send && Boolean(f.signerEmail)} disabled={!f.signerEmail} onChange={(e) => setSend(e.target.checked)} />
          Email the signing link {f.signerEmail ? `to ${f.signerEmail}` : "(add an email first)"}
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Sending…" : "Send for signature"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ViewDialog({ id, onClose }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getSignatureRequest(id).then(setDoc).catch((e) => setError(e.message));
  }, [id]);
  return (
    <Dialog title={doc?.title || "Document"} onClose={onClose} width={720}>
      {error && <ErrorText>{error}</ErrorText>}
      {!doc && !error && <p className="text-[13px]" style={{ color: INK_FAINT }}>Loading…</p>}
      {doc && (
        <>
          <article className="rounded-[10px] p-4 text-[13px] whitespace-pre-wrap max-h-[50vh] overflow-y-auto" style={{ background: "var(--mist)", color: INK }}>
            {doc.body}
          </article>
          {doc.audit ? (
            <dl className="mt-4 text-[12px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" style={{ color: INK_MUTED }}>
              <dt>Signed by</dt>
              <dd style={{ color: INK }}>{doc.audit.signedName}</dd>
              <dt>When</dt>
              <dd>{new Date(doc.audit.signedAt).toLocaleString("en-GB")}</dd>
              <dt>IP address</dt>
              <dd>{doc.audit.ip || "-"}</dd>
              <dt>Browser</dt>
              <dd className="truncate">{doc.audit.userAgent || "-"}</dd>
              <dt>Fingerprint</dt>
              <dd className="break-all">{doc.audit.documentHash}</dd>
            </dl>
          ) : (
            <p className="mt-3 text-[12px]" style={{ color: INK_MUTED }}>
              {SIGNATURE_STATUSES[doc.status]}
              {doc.viewedAt ? ` · opened ${new Date(doc.viewedAt).toLocaleString("en-GB")}` : " · not opened yet"}
              {doc.declinedReason ? ` · "${doc.declinedReason}"` : ""}
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => {
                const w = window.open("", "_blank", "noopener");
                if (!w) return;
                w.document.title = doc.title;
                const pre = w.document.createElement("pre");
                pre.style.cssText = "white-space:pre-wrap;font:14px/1.6 system-ui;max-width:720px;margin:40px auto";
                pre.textContent = `${doc.title}\n\n${doc.body}${doc.audit ? `\n\n---\nSigned electronically by ${doc.audit.signedName} on ${new Date(doc.audit.signedAt).toLocaleString("en-GB")}\nIP ${doc.audit.ip || "-"}\nSHA-256 ${doc.audit.documentHash}` : ""}`;
                w.document.body.appendChild(pre);
                w.print();
              }}
            >
              Print / save PDF
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

export default function SignaturesCard({ title = "Documents to sign", kinds, signer, template, clientId = null, candidateId = null, placementId = null, onChanged }) {
  const [list, setList] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getSignatureRequests({ clientId, candidateId })
      .then((d) => {
        if (cancelled) return;
        setList(d.requests || []);
        setUnavailable(Boolean(d.unavailable));
      })
      .catch(() => { if (!cancelled) setList([]); });
    return () => { cancelled = true; };
  }, [clientId, candidateId, reloadKey]);

  const reload = useCallback(() => {
    setCreating(false);
    setReloadKey((k) => k + 1);
    onChanged?.();
  }, [onChanged]);
  const close = useCallback(() => setCreating(false), []);

  async function withdraw(r) {
    if (!window.confirm(`Withdraw "${r.title}"? The link will stop working.`)) return;
    try {
      await voidSignatureRequest(r.id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card title={title} action={!unavailable && <Button size="sm" onClick={() => setCreating(true)}>+ Send</Button>}>
      {list === null ? (
        <p className="text-[13px]" style={{ color: INK_FAINT }}>Loading…</p>
      ) : unavailable ? (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>E-signatures need a database update (migration 20261003010000).</p>
      ) : list.length === 0 ? (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>Nothing sent yet. Send a document to be signed online - no printing or scanning.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const [fg, bg] = STATUS_STYLE[r.status] || STATUS_STYLE.sent;
            return (
              <li key={r.id} className="text-[13px]">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="min-w-0 text-left" onClick={() => setViewing(r.id)}>
                    <span className="block font-semibold truncate" style={{ color: INK }}>{r.title}</span>
                    <span className="block text-[12px]" style={{ color: INK_MUTED }}>
                      {r.signerName}
                      {r.status === "signed" && r.signedAt ? ` · signed ${formatDateOnly(r.signedAt)}` : ` · sent ${formatDateOnly(r.createdAt)}`}
                    </span>
                  </button>
                  <Pill color={fg} background={bg}>{r.status === "sent" ? "Waiting" : SIGNATURE_STATUSES[r.status]}</Pill>
                </div>
                {r.status === "sent" && (
                  <div className="flex gap-3 mt-1 text-[11px] font-semibold">
                    {r.link && (
                      <button type="button" style={{ color: "var(--forest)" }} onClick={() => navigator.clipboard?.writeText(r.link)}>
                        Copy link
                      </button>
                    )}
                    <button type="button" style={{ color: INK_FAINT }} onClick={() => withdraw(r)}>
                      Withdraw
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ErrorText>{error}</ErrorText>
      {creating && <NewDocumentDialog kinds={kinds} signer={signer} template={template} clientId={clientId} candidateId={candidateId} placementId={placementId} onClose={close} onSaved={reload} />}
      {viewing && <ViewDialog id={viewing} onClose={() => setViewing(null)} />}
    </Card>
  );
}
