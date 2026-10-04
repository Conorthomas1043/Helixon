"use client";

// Part of the team page (app/dashboard/team/page.jsx).

import Link from "next/link";
import PresenceDot from "@/components/PresenceDot";
import { CARD, INK, INK_FAINT, INK_MUTED } from "@/lib/candidates/format";
import { presenceLine } from "@/lib/presence";
import { setMyPresence, setPresenceHidden } from "@/lib/dashboard-api";
import { useState } from "react";

export const STATUS_CHOICES = [
  { value: null, dot: "active", label: "Automatic", hint: "Active or idle, from what you're doing" },
  { value: "busy", dot: "busy", label: "Busy", hint: "Heads down" },
  { value: "away", dot: "away", label: "Away", hint: "Stepped out" },
];
export const MESSAGE_SUGGESTIONS = ["In interviews", "On a call", "Client meeting", "Lunch", "Out of office"];
export const CLEAR_AFTER = [
  { value: "", label: "Don't clear" },
  { value: "30", label: "In 30 minutes" },
  { value: "60", label: "In 1 hour" },
  { value: "120", label: "In 2 hours" },
  { value: "240", label: "In 4 hours" },
  { value: "eod", label: "End of today" },
];

export function clearAfterToIso(value) {
  if (!value) return null;
  if (value === "eod") {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }
  return new Date(Date.now() + Number(value) * 60_000).toISOString();
}

// Set yourself busy or away, with what you're doing and when it clears.
export function MyStatusCard({ me, presence, enabled, onSaved }) {
  if (!enabled) {
    return (
      <div id="my-status" className="rounded-[14px] p-5 scroll-mt-24" style={CARD}>
        <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
          Presence
        </p>
        <p className="text-[14px]" style={{ color: INK_MUTED }}>
          Showing who&apos;s online is switched off for this workspace, so nothing about when people use Helixon is recorded.{" "}
          <Link href="/dashboard/privacy" className="font-semibold underline" style={{ color: "var(--forest)" }}>
            Data &amp; privacy settings
          </Link>
        </p>
      </div>
    );
  }
  return <MyStatusEditor me={me} presence={presence} onSaved={onSaved} />;
}

export function MyStatusEditor({ me, presence, onSaved }) {
  const raw = me?.presenceRaw || {};
  const currentStatus = presence?.state === "busy" || presence?.state === "away" ? presence.state : null;
  const [status, setStatus] = useState(currentStatus);
  const [message, setMessage] = useState(currentStatus ? raw.message || "" : "");
  const [clearAfter, setClearAfter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const hidden = Boolean(me?.presenceRaw?.hidden);
  async function toggleHidden(next) {
    setSaving(true);
    setError("");
    try {
      onSaved(await setPresenceHidden(next));
    } catch (err) {
      setError(err.message || "Couldn't change that.");
    } finally {
      setSaving(false);
    }
  }

  async function save(next = status) {
    setSaving(true);
    setError("");
    try {
      const updated = await setMyPresence({ status: next, message: next ? message : "", until: next ? clearAfterToIso(clearAfter) : null });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (!next) {
        setMessage("");
        setClearAfter("");
      }
    } catch (err) {
      setError(err.message || "Couldn't update your status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="my-status" className="rounded-[14px] p-5 scroll-mt-24" style={CARD}>
      <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
        Your status
      </p>
      <p className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: INK }}>
        <PresenceDot state={presence?.state === "offline" ? "active" : presence?.state || "active"} size={9} ring="transparent" />
        {presence ? (presence.state === "offline" ? "Active now" : presenceLine(presence)) : "Active now"}
      </p>
      {presence?.message && <p className="text-[13.5px] italic mt-0.5" style={{ color: INK_MUTED }}>“{presence.message}”</p>}

      <div className="grid grid-cols-3 gap-1.5 mt-4" role="radiogroup" aria-label="Status">
        {STATUS_CHOICES.map((c) => {
          const on = status === c.value;
          return (
            <button
              key={c.label}
              type="button"
              role="radio"
              aria-checked={on}
              title={c.hint}
              onClick={() => {
                setStatus(c.value);
                if (!c.value) save(null);
              }}
              className="flex items-center justify-center gap-1.5 text-[13.5px] font-semibold px-2 py-2 rounded-[10px] border transition-colors"
              style={{
                borderColor: on ? "var(--forest)" : "var(--border)",
                background: on ? "var(--mint)" : "white",
                color: on ? "var(--forest-deep)" : INK_MUTED,
              }}
            >
              <PresenceDot state={c.dot} size={8} ring="transparent" />
              {c.label}
            </button>
          );
        })}
      </div>

      {status && (
        <div className="mt-3 space-y-2.5">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={80}
            placeholder={status === "busy" ? "What are you busy with? (optional)" : "Where are you? (optional)"}
            aria-label="Status message"
            className="w-full text-[14px] px-3.5 py-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          />
          <div className="flex flex-wrap gap-1.5">
            {MESSAGE_SUGGESTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMessage(m)}
                className="text-[12.5px] px-2.5 py-1 rounded-full hover:bg-[var(--mint)]"
                style={{ background: message === m ? "var(--mint)" : "var(--mist)", color: INK_MUTED }}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={clearAfter}
              onChange={(e) => setClearAfter(e.target.value)}
              aria-label="Clear status"
              className="flex-1 text-[13.5px] font-semibold px-3 py-2 rounded-full bg-white"
              style={{ border: "1px solid var(--border)", color: INK }}
            >
              {CLEAR_AFTER.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value ? `Clear ${o.label.toLowerCase()}` : o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="text-[13.5px] font-semibold px-4 py-2 rounded-full disabled:opacity-50"
              style={{ background: "var(--forest)", color: "white" }}
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Set status"}
            </button>
          </div>
        </div>
      )}
      {!status && saved && <p className="text-[13px] mt-2" style={{ color: "var(--forest)" }}>Back to automatic ✓</p>}
      {error && <p role="alert" className="text-[13px] mt-2" style={{ color: "var(--score-low)" }}>{error}</p>}
      <p className="text-[12.5px] mt-3" style={{ color: INK_FAINT }}>
        Teammates see you as active while you&apos;re using Helixon, idle after 5 minutes without touching it, and offline once it&apos;s closed.
        Only those times are kept - not what you click or type.
      </p>
      <label className="flex items-start gap-2 mt-3 pt-3 cursor-pointer" style={{ borderTop: "1px solid var(--border)" }}>
        <input
          type="checkbox"
          checked={!hidden}
          disabled={saving}
          onChange={(e) => toggleHidden(!e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[var(--forest)]"
        />
        <span className="text-[13.5px]" style={{ color: INK }}>
          Share my presence with the team
          <span className="block text-[12.5px]" style={{ color: INK_FAINT }}>
            {hidden ? "Hidden - nothing about when you use Helixon is being recorded." : "Untick to hide it and delete what's been recorded."}
          </span>
        </span>
      </label>
    </div>
  );
}
