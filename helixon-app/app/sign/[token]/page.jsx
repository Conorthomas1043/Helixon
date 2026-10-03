"use client";

// Public, account-free signing page (app/api/sign/[token]), reached from
// the email an agency sends. The signer reads the document, types their
// name and confirms; the agency gets the signed copy with an audit trail.

import { use, useEffect, useState } from "react";
import PublicCard from "@/components/public/PublicCard";

const INK = "var(--ink)";
const MUTED = "var(--ink-soft)";
const input = "w-full text-[14px] px-3 py-2.5 rounded-[10px] focus-visible:outline focus-visible:outline-2";
const inputStyle = { border: "1px solid var(--border)", color: INK };

function formatWhen(iso) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SignPage({ params }) {
  const { token } = use(params);
  const [doc, setDoc] = useState(null);
  const [state, setState] = useState("loading");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "This link isn't valid.");
        setDoc(d);
        setName(d.signerName || "");
        setState(d.status === "signed" ? "signed" : d.status !== "sent" ? "closed" : d.expired ? "expired" : "form");
      })
      .catch((e) => {
        setError(e.message);
        setState("error");
      });
  }, [token]);

  async function send(payload) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/sign/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't save that.");
      if (d.status === "signed") {
        setDoc((x) => ({ ...x, signedAt: d.signedAt, signedName: payload.name }));
        setState("signed");
      } else setState("declined");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") return <PublicCard><p className="text-sm" style={{ color: MUTED }}>Loading…</p></PublicCard>;
  if (state === "error" || state === "expired" || state === "closed" || state === "declined") {
    const [title, body] = {
      error: ["Link not available", error],
      expired: ["This link has expired", "Please ask for a new link."],
      closed: ["No longer available", "This document has been withdrawn or already answered."],
      declined: ["Thanks for letting us know", "We've told the agency you won't be signing."],
    }[state];
    return (
      <PublicCard agencyName={doc?.agencyName}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: INK }}>{title}</h1>
        <p className="text-sm" style={{ color: MUTED }}>{body}</p>
      </PublicCard>
    );
  }

  const document = (
    <article className="rounded-[12px] p-4 sm:p-5 text-[14px] leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto print:max-h-none print:overflow-visible" style={{ background: "var(--mist)", color: INK }}>
      {doc.body}
    </article>
  );

  if (state === "signed") {
    return (
      <PublicCard agencyName={doc.agencyName} width={720}>
        <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--forest)" }}>Signed</p>
        <h1 className="text-xl font-semibold mb-4" style={{ color: INK, fontFamily: "var(--font-display)" }}>{doc.title}</h1>
        {document}
        <div className="mt-5 pt-4 text-[13px]" style={{ borderTop: "1px solid var(--border)", color: MUTED }}>
          <p style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 28, color: INK }}>{doc.signedName}</p>
          <p>Signed electronically by {doc.signedName}{doc.signedAt ? ` on ${formatWhen(doc.signedAt)}` : ""}.</p>
          {doc.documentHash && <p className="text-[11px] mt-1 break-all">Document fingerprint (SHA-256): {doc.documentHash}</p>}
        </div>
        <button type="button" onClick={() => window.print()} className="mt-4 text-[13px] font-semibold underline print:hidden" style={{ color: "var(--forest)" }}>
          Print or save a copy
        </button>
      </PublicCard>
    );
  }

  return (
    <PublicCard agencyName={doc.agencyName} width={720}>
      <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: MUTED }}>{doc.kind}</p>
      <h1 className="text-xl font-semibold" style={{ color: INK, fontFamily: "var(--font-display)" }}>{doc.title}</h1>
      <p className="text-[13px] mt-1 mb-4" style={{ color: MUTED }}>
        {doc.agencyName || "The agency"} has asked {doc.signerName} to read and sign this. Please read it all before signing.
      </p>
      {document}
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          send({ name, agree });
        }}
      >
        <label className="block">
          <span className="block text-[13px] font-semibold mb-1.5" style={{ color: INK }}>Type your full name to sign</span>
          <input required minLength={2} maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={input} style={inputStyle} autoComplete="name" />
        </label>
        {name.trim().length > 1 && (
          <p aria-hidden="true" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 30, color: INK, lineHeight: 1.1 }}>{name}</p>
        )}
        <label className="flex items-start gap-2 text-[13px]" style={{ color: INK }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
          <span>I&apos;ve read this document and agree to it. I understand typing my name here is my electronic signature.</span>
        </label>
        {error && <p role="alert" className="text-[12px]" style={{ color: "var(--score-low)" }}>{error}</p>}
        <button type="submit" disabled={saving || !agree || name.trim().length < 2} className="w-full text-[14px] font-semibold px-4 py-3 rounded-full disabled:opacity-50" style={{ background: "var(--forest)", color: "white" }}>
          {saving ? "Signing…" : "Sign"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            const reason = window.prompt("Optional: tell the agency why you're not signing.");
            if (reason !== null) send({ decline: true, reason });
          }}
          className="w-full text-[12px] underline"
          style={{ color: MUTED }}
        >
          I don&apos;t want to sign this
        </button>
      </form>
    </PublicCard>
  );
}
