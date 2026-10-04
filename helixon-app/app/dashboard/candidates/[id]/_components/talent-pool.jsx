"use client";

// Part of the candidate profile page (../page.jsx).

import Link from "next/link";
import { CARD, INK, INK_FAINT, INK_MUTED, formatRelativeTime, scoreColor } from "@/lib/candidates/format";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { useState } from "react";
import { FieldLabel, SectionHeading } from "./primitives";

export function TalentPoolPanel({ candidate, jobs, onSave, onUpdate, onRemove, onRescreen }) {
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState("");
  const [screening, setScreening] = useState(false);
  const pool = candidate.talentPool;

  const screenedJobIds = new Set([candidate.jobId, ...candidate.otherRoles.map((r) => r.jobId)]);
  const availableJobs = jobs.filter((j) => !screenedJobIds.has(j.id));
  const openJobs = availableJobs.filter((j) => j.status === "open");
  const closedJobs = availableJobs.filter((j) => j.status !== "open");

  async function save() {
    setBusy(true);
    const ok = await onSave(note);
    setBusy(false);
    if (ok) {
      setNote("");
      setNoting(false);
    }
  }

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading
        eyebrow="Talent pool"
        title={pool ? "Saved for future roles" : "Keep for future roles"}
        action={
          <Link href="/dashboard/talent-pool" className="text-[13px] font-semibold" style={{ color: "var(--forest)" }}>
            Open pool →
          </Link>
        }
      />

      {pool ? (
        <div className="rounded-[10px] p-3 mb-4" style={{ background: "var(--mint)" }}>
          <p className="text-[13.5px] font-semibold" style={{ color: "var(--forest-deep)" }}>
            In the talent pool
          </p>
          <p className="text-[12.5px] mt-0.5" style={{ color: INK_MUTED }}>
            Saved {formatRelativeTime(new Date(pool.savedAt))}
            {pool.savedBy ? ` by ${pool.savedBy}` : ""}
          </p>
          {pool.note && <p className="text-[13.5px] italic mt-1.5" style={{ color: INK }}>“{pool.note}”</p>}
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <label className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: INK_FAINT }}>
              Availability
              <select
                value={pool.status || ""}
                onChange={(e) => onUpdate({ status: e.target.value || null })}
                className="mt-1 w-full text-[13px] font-semibold normal-case tracking-normal px-2.5 py-1.5 rounded-full bg-white"
                style={{ border: "1px solid var(--border)", color: INK }}
              >
                <option value="">Unknown</option>
                <option value="available">Available</option>
                <option value="open">Open to offers</option>
                <option value="not_looking">Not looking</option>
              </select>
            </label>
            <label className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: INK_FAINT }}>
              Check in
              <input
                type="date"
                value={pool.checkIn || ""}
                onChange={(e) => onUpdate({ checkIn: e.target.value || null })}
                className="mt-1 w-full text-[13px] font-semibold normal-case tracking-normal px-2.5 py-1 rounded-full bg-white"
                style={{ border: "1px solid var(--border)", color: INK }}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={async () => {
              setBusy(true);
              await onRemove();
              setBusy(false);
            }}
            disabled={busy}
            className="text-[12.5px] font-semibold mt-2 hover:underline disabled:opacity-50"
            style={{ color: INK_MUTED }}
          >
            Remove from pool
          </button>
        </div>
      ) : noting ? (
        <div className="mb-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Why keep them? e.g. great fit for senior sales, wants remote (optional)"
            aria-label="Why keep them"
            className="w-full text-[14px] p-2.5 rounded-[10px] resize-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setNoting(false)} className="text-[13px] font-semibold px-3 py-1.5 rounded-full" style={{ color: INK_MUTED }}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={busy} className="text-[13px] font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-50" style={{ background: "var(--forest)", color: "white" }}>
              {busy ? "Saving…" : "Save to pool"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setNoting(true)}
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold px-4 py-2 rounded-full"
            style={{ border: "1px solid var(--forest)", color: "var(--forest)" }}
          >
            ☆ Save to talent pool
          </button>
          <p className="text-[12.5px] mt-2" style={{ color: INK_FAINT }}>
            Not right for this role? Keep them - when a new job comes in, you can screen them against it without re-uploading.
          </p>
        </div>
      )}

      <FieldLabel>Screened for</FieldLabel>
      <ul className="space-y-1.5 mb-4">
        <li className="flex items-center justify-between gap-2 text-[13.5px]">
          <span className="truncate" style={{ color: INK }}>
            {candidate.jobTitle} <span style={{ color: INK_FAINT }}>(this page)</span>
          </span>
          <span className="tabular-nums font-semibold" style={{ color: scoreColor(candidate.score) }}>{candidate.score ?? "–"}</span>
        </li>
        {candidate.otherRoles.map((r) => (
          <li key={r.candidateId} className="flex items-center justify-between gap-2 text-[13.5px]">
            <Link href={`/dashboard/candidates/${r.candidateId}`} className="truncate hover:underline" style={{ color: "var(--forest)" }}>
              {r.jobTitle}
              {r.stage ? <span style={{ color: INK_FAINT }}> · {STAGE_LABELS[r.stage] || r.stage}</span> : null}
            </Link>
            <span className="tabular-nums font-semibold" style={{ color: scoreColor(r.score) }}>{r.score ?? "–"}</span>
          </li>
        ))}
      </ul>

      <FieldLabel>Screen for another job</FieldLabel>
      {candidate.hasCvText ? (
        <div className="flex gap-2">
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            disabled={screening}
            aria-label="Job to screen them for"
            className="min-w-0 flex-1 text-[13.5px] px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            <option value="">{availableJobs.length ? "Choose a job…" : "No other jobs yet"}</option>
            {openJobs.length > 0 && (
              <optgroup label="Open">
                {openJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </optgroup>
            )}
            {closedJobs.length > 0 && (
              <optgroup label="Closed">
                {closedJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            type="button"
            disabled={!jobId || screening}
            onClick={async () => {
              setScreening(true);
              const ok = await onRescreen(jobId);
              setScreening(false);
              if (ok) setJobId("");
            }}
            className="text-[13px] font-semibold px-3.5 py-1.5 rounded-full shrink-0 disabled:opacity-40"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {screening ? "Screening…" : "Screen"}
          </button>
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: INK_FAINT }}>No CV text on file - upload their CV on Analyse to screen them for another job.</p>
      )}
      {screening && <p className="text-[12.5px] mt-2" style={{ color: INK_FAINT }}>Running a full analysis - about 20–40 seconds.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Loading / error / not-found
 * ---------------------------------------------------------------------- */
