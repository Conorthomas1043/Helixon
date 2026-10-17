"use client";

// The amber "reads as AI-written" prompt (lib/screening/ai-writing.js) with
// the signs the CV reader noticed. Shown on the screening report, the
// candidate profile and the split view. Informational only: the score never
// takes it into account.
//
// With a candidateId it asks "Does this look right?" - the answers go to
// /api/ai-writing-feedback, so how often the check raises a false alarm can
// be measured from real use.

import { useEffect, useState } from "react";
import { Notice, Pill } from "@/components/ui";
import { track } from "@/lib/analytics/track";

/**
 * The short form for lists (bulk results, Compare, the Candidates list):
 * an amber pill whose tooltip says what it means.
 * @param {{ className?: string }} props
 */
export function AiWritingBadge({ className = "" }) {
  return (
    <Pill tone="amber" className={className}>
      <span title="This CV reads as if much of it was written with AI. Check the specifics at interview - it doesn't affect the score.">Possibly AI-written</span>
    </Pill>
  );
}

/**
 * @param {{
 *   notice: { message: string, signals: string[] } | null | undefined,
 *   candidateId?: string | null,
 *   where?: string,
 *   className?: string,
 * }} props `where` names the screen, for the usage event
 */
export default function AiWritingNotice({ notice, candidateId = null, where = "report", className = "" }) {
  const shown = Boolean(notice);
  useEffect(() => {
    if (shown) track("ai_writing_notice_shown", { where });
  }, [shown, where]);
  if (!notice) return null;
  return (
    <Notice tone="warn" className={className}>
      <p className="font-semibold">Possibly AI-written</p>
      <p>{notice.message}</p>
      {notice.signals?.length > 0 && (
        <ul className="mt-1.5 list-disc pl-4 space-y-0.5 text-sm">
          {notice.signals.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {candidateId && <Verdict candidateId={candidateId} where={where} />}
    </Notice>
  );
}

/** @param {{ candidateId: string, where: string }} props */
function Verdict({ candidateId, where }) {
  const [state, setState] = useState(/** @type {"ask" | "sending" | "done" | "failed"} */ ("ask"));

  async function send(verdict) {
    setState("sending");
    track("ai_writing_feedback", { verdict, where });
    try {
      const res = await fetch("/api/ai-writing-feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, verdict }),
      });
      setState(res.ok ? "done" : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "done") return <p className="mt-2 text-sm">Thanks - that helps us tune the check.</p>;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span>Does this look right?</span>
      <button type="button" disabled={state === "sending"} onClick={() => send("right")} className="rounded-full border border-current px-2.5 py-0.5 font-semibold hover:bg-[var(--bg)]/60 disabled:opacity-50">
        Yes
      </button>
      <button type="button" disabled={state === "sending"} onClick={() => send("wrong")} className="rounded-full border border-current px-2.5 py-0.5 font-semibold hover:bg-[var(--bg)]/60 disabled:opacity-50">
        No, it reads as written by them
      </button>
      {state === "failed" && <span>Couldn&apos;t save that - try again.</span>}
    </div>
  );
}
