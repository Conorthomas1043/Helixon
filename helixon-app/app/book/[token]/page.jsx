"use client";

// Public, account-free interview booking page (app/api/book/[token]): the
// candidate picks one of the times the agency offered, and the interview
// is booked with calendar invites.

import { use, useEffect, useState } from "react";
import PublicCard from "@/components/public/PublicCard";

const INK = "var(--ink)";
const MUTED = "var(--ink-soft)";

function dayKey(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
function time(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function BookPage({ params }) {
  const { token } = use(params);
  const [info, setInfo] = useState(null);
  const [state, setState] = useState("loading");
  const [pick, setPick] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  useEffect(() => {
    fetch(`/api/book/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "This link isn't valid.");
        setInfo(d);
        setState(d.booked ? "booked" : d.status !== "open" || d.slots.length === 0 ? "closed" : "pick");
      })
      .catch((e) => {
        setError(e.message);
        setState("error");
      });
  }, [token]);

  async function book() {
    if (!pick) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/book/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt: pick }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't book that time.");
      setInfo((x) => ({ ...x, booked: { startsAt: d.startsAt, durationMinutes: d.durationMinutes } }));
      setState("booked");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") return <PublicCard><p className="text-sm" style={{ color: MUTED }}>Loading…</p></PublicCard>;
  if (state === "error" || state === "closed") {
    return (
      <PublicCard agencyName={info?.agencyName}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: INK }}>{state === "error" ? "Link not available" : "No times left"}</h1>
        <p className="text-sm" style={{ color: MUTED }}>{state === "error" ? error : "The times on this link have passed or it's been closed - please ask the agency for new ones."}</p>
      </PublicCard>
    );
  }
  if (state === "booked") {
    const b = info.booked;
    return (
      <PublicCard agencyName={info.agencyName}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: INK }}>{b.cancelled ? "This interview was cancelled" : "You're booked in"}</h1>
        {!b.cancelled && (
          <p className="text-sm" style={{ color: MUTED }}>
            {dayKey(b.startsAt)} at {time(b.startsAt)} ({b.durationMinutes} minutes){info.jobTitle ? ` for ${info.jobTitle}` : ""}. A calendar invite is on its way to your inbox.
          </p>
        )}
      </PublicCard>
    );
  }

  const byDay = info.slots.reduce((acc, s) => {
    const k = dayKey(s);
    (acc[k] ||= []).push(s);
    return acc;
  }, {});

  return (
    <PublicCard agencyName={info.agencyName} width={600}>
      <h1 className="text-xl font-semibold" style={{ color: INK, fontFamily: "var(--font-display)" }}>
        {info.firstName ? `${info.firstName}, pick` : "Pick"} a time for your interview
      </h1>
      <p className="text-[13px] mt-1 mb-5" style={{ color: MUTED }}>
        {info.jobTitle ? `${info.jobTitle} · ` : ""}
        {info.kind} · {info.durationMinutes} minutes{info.location ? ` · ${info.location}` : ""}
        {zone ? ` · times shown in your time zone (${zone})` : ""}
      </p>
      <div className="space-y-4" role="radiogroup" aria-label="Interview times">
        {Object.entries(byDay).map(([day, list]) => (
          <div key={day}>
            <p className="text-[13px] font-semibold mb-2" style={{ color: INK }}>{day}</p>
            <div className="flex flex-wrap gap-2">
              {list.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={pick === s}
                  onClick={() => setPick(s)}
                  className="text-[14px] font-semibold px-4 py-2 rounded-full tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={pick === s ? { background: "var(--forest)", color: "white" } : { border: "1px solid var(--border)", color: INK, background: "white" }}
                >
                  {time(s)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-[12px]" style={{ color: "var(--score-low)" }}>{error}</p>}
      <button type="button" onClick={book} disabled={!pick || saving} className="mt-6 w-full text-[14px] font-semibold px-4 py-3 rounded-full disabled:opacity-50" style={{ background: "var(--forest)", color: "white" }}>
        {saving ? "Booking…" : pick ? `Book ${dayKey(pick)} at ${time(pick)}` : "Choose a time"}
      </button>
      <p className="mt-3 text-[11px] text-center" style={{ color: MUTED }}>None of these work? Reply to the email and the agency will suggest others.</p>
    </PublicCard>
  );
}
