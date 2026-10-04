"use client";

// In-product research (docs/ux-research-audit.md, R8): a short pulse survey
// on the dashboard and a research opt-in in Settings. Both post to
// /api/research and are read on the admin Voice of customer page.

import { useEffect, useState } from "react";
import { UMUX_ITEMS } from "@/lib/umux-lite";
import { track } from "@/lib/analytics";
import { reportQuietly } from "@/lib/report-error";

const SNOOZE_KEY = "helixon_pulse_snoozed_until";
const SNOOZE_DAYS = 14;
const SCALE = [1, 2, 3, 4, 5, 6, 7];

function snoozed() {
  try {
    return Number(window.localStorage.getItem(SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

// Shown only once someone has enough experience to judge (10+ screenings),
// at most every 90 days (server) and never again for 14 days after "Not
// now" (this browser). Two validated questions plus one open one: the
// numbers track change over time, the open answer says why.
export function PulseSurvey({ analysesCount }) {
  const [state, setState] = useState("checking"); // checking | hidden | open | sent
  const [answers, setAnswers] = useState({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (analysesCount < 10 || snoozed()) return undefined;
    let cancelled = false;
    fetch("/api/research", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setState(d?.pulseDue ? "open" : "hidden");
      })
      .catch(reportQuietly);
    return () => {
      cancelled = true;
    };
  }, [analysesCount]);

  if (state !== "open" && state !== "sent") return null;

  function snooze() {
    try {
      window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000));
    } catch {
      /* private mode - it'll just ask again next visit */
    }
    track("pulse_survey_snoozed");
    setState("hidden");
  }

  async function submit(e) {
    e.preventDefault();
    if (!answers.capabilities || !answers.ease) {
      setError("Answer both questions - the comment is optional.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "pulse_survey", ...answers, comment }),
      });
      if (!res.ok) throw new Error();
      setState("sent");
    } catch {
      setError("That didn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "sent") {
    return (
      <section role="status" className="rounded-[14px] p-5 text-[14px]" style={{ background: "var(--mint)", color: "var(--ink)" }}>
        <strong>Thank you.</strong> We read every answer, and this helps decide what we work on next.
      </section>
    );
  }

  return (
    <section className="rounded-[14px] p-5 sm:p-6 bg-white" style={{ border: "1px solid var(--border)" }} aria-labelledby="pulse-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="pulse-title" className="text-[16px] font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Two quick questions about Helixon
          </h2>
          <p className="text-[14px] mt-1" style={{ color: "var(--ink-soft)" }}>
            About 20 seconds. We ask at most every few months.
          </p>
        </div>
        <button type="button" onClick={snooze} className="text-[14px] underline shrink-0 min-h-[32px]" style={{ color: "var(--ink-soft)" }}>
          Not now
        </button>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {UMUX_ITEMS.map((item) => (
          <fieldset key={item.key}>
            <legend className="text-[14px] font-medium mb-2" style={{ color: "var(--ink)" }}>
              {item.text}
            </legend>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] w-full sm:w-auto sm:mr-1" style={{ color: "var(--ink-faint)" }}>
                Strongly disagree
              </span>
              {SCALE.map((n) => (
                <label key={n} className="cursor-pointer">
                  <input
                    type="radio"
                    name={item.key}
                    value={n}
                    checked={answers[item.key] === n}
                    onChange={() => setAnswers((a) => ({ ...a, [item.key]: n }))}
                    className="sr-only peer"
                  />
                  <span
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full text-[14px] font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--forest)]"
                    style={answers[item.key] === n ? { background: "var(--forest)", color: "white" } : { border: "1px solid var(--border)", color: "var(--ink)" }}
                  >
                    {n}
                  </span>
                </label>
              ))}
              <span className="text-[13px] sm:ml-1" style={{ color: "var(--ink-faint)" }}>
                Strongly agree
              </span>
            </div>
          </fieldset>
        ))}
        <label className="block">
          <span className="block text-[14px] font-medium mb-1" style={{ color: "var(--ink)" }}>
            What&apos;s the one thing we should improve? (optional)
          </span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={2000} className="w-full text-[14px] px-3 py-2 rounded-[10px]" style={{ border: "1px solid var(--border)", color: "var(--ink)" }} />
        </label>
        {error && (
          <p role="alert" className="text-[14px]" style={{ color: "var(--score-low)" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="text-[14px] font-semibold px-5 rounded-[10px] min-h-[44px] text-white" style={{ background: "var(--forest)", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}

// A standing opt-in so research can recruit from real customers instead of
// whoever happens to reply. Off until the person turns it on.
export function ResearchOptIn() {
  const [optedIn, setOptedIn] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/research", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.available) setOptedIn(Boolean(d.optedIn));
      })
      .catch(reportQuietly);
    return () => {
      cancelled = true;
    };
  }, []);

  if (optedIn === null) return null;

  async function toggle() {
    setBusy(true);
    const next = !optedIn;
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "research_optin", optIn: next }),
      });
      if (res.ok) {
        setOptedIn(next);
        track(next ? "research_opted_in" : "research_opted_out");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[14px] p-5 bg-white" style={{ border: "1px solid var(--border)" }}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
        Help shape Helixon
      </h2>
      <p className="text-[14px] mt-1 max-w-xl" style={{ color: "var(--ink-soft)" }}>
        Now and then we ask a few recruiters to try an idea or talk us through how they work, for about 30 minutes. Turn this on and we may email you an
        invitation. You can say no to any of them, and turn this off whenever you like.
      </p>
      <label className="mt-3 inline-flex items-center gap-2.5 text-[14px] cursor-pointer min-h-[36px]" style={{ color: "var(--ink)" }}>
        <input type="checkbox" checked={optedIn} onChange={toggle} disabled={busy} className="w-4 h-4 accent-[var(--forest)]" />
        I&apos;m happy to be invited to research sessions
      </label>
    </section>
  );
}
