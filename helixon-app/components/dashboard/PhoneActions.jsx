"use client";

// Call / text / WhatsApp a candidate from their profile, then log it in one
// tap. The links open the phone's dialler, messages app or WhatsApp (or a
// softphone / WhatsApp Desktop on a computer); nothing is sent through
// Helixon. Logged calls count on the Performance page.

import { useState } from "react";
import { logCandidateActivity } from "@/lib/dashboard-api";
import { smsHref, telHref, whatsappHref } from "@/lib/phone";

const LOG_TYPES = { call: ["call_logged", "Call"], sms: ["sms_logged", "Text"], whatsapp: ["whatsapp_logged", "WhatsApp"] };
const linkCls = "font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded";

export default function PhoneActions({ candidateId, phone, firstName, onLogged }) {
  const [pending, setPending] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const greeting = `Hi${firstName ? ` ${firstName}` : ""}, `;
  const wa = whatsappHref(phone, greeting);

  async function log() {
    setBusy(true);
    setError(null);
    try {
      await logCandidateActivity(candidateId, LOG_TYPES[pending][0], note.trim() || undefined);
      setPending(null);
      setNote("");
      onLogged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{phone}</span>
      <a href={telHref(phone)} onClick={() => setPending("call")} className={linkCls} style={{ color: "var(--forest)" }}>
        Call
      </a>
      <a href={smsHref(phone, greeting)} onClick={() => setPending("sms")} className={linkCls} style={{ color: "var(--forest)" }}>
        Text
      </a>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => setPending("whatsapp")} className={linkCls} style={{ color: "var(--forest)" }}>
          WhatsApp
        </a>
      )}
      {pending && (
        <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full pl-3 pr-1 py-0.5" style={{ background: "var(--mist)" }}>
          <span>Log {LOG_TYPES[pending][1].toLowerCase()}?</span>
          <input
            aria-label="Note"
            placeholder="Outcome (optional)"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && log()}
            className="text-[13px] px-2 py-0.5 rounded-full bg-white"
            style={{ border: "1px solid var(--border)", width: 150 }}
          />
          <button type="button" disabled={busy} onClick={log} className="font-semibold px-2" style={{ color: "var(--forest)" }}>
            Log
          </button>
          <button type="button" aria-label="Don't log" onClick={() => setPending(null)} className="px-1.5">
            ×
          </button>
          {error && <span style={{ color: "var(--score-low)" }}>{error}</span>}
        </span>
      )}
    </span>
  );
}
