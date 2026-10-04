"use client";

// Part of the dashboard home (app/dashboard/page.js).

import Link from "next/link";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/stage-labels";
import { SectionHeading } from "@/components/ui";
import { ACCENT_BG, ACCENT_FG, BORDER, BORDER2, CARD, GREEN_FG, RED, RED_BG, TEXT, TEXT_FAINT, TEXT_SUB, formatNumber } from "./shared";
import { EmptyState } from "./states";

/* ─── Active jobs ───────────────────────────────────────────────────────── */

export const PRIORITY_LABEL = { urgent: "Urgent", high: "High", low: "Low" };

// Open jobs (job status, not "has analysed candidates"), most urgent first,
// with each job's screening mix where it has one.
export function ActiveJobs({ jobs, total, statsByJob }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Roles"
        title="Open jobs"
        action={<Link href="/dashboard/jobs" style={{ fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none" }}>{total > jobs.length ? `All ${total} →` : "All jobs →"}</Link>}
      />
      {jobs.length === 0 ? (
        <EmptyState title="No open jobs" body="Add a job to start building its pipeline." actionLabel="New job" actionHref="/dashboard/jobs?new=1" />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {jobs.map((job, i) => {
            const stats = statsByJob.get(job.id);
            const late = job.targetDate && job.targetDate < today;
            return (
              <li key={job.id} className="fade-up-in" style={{ borderTop: `1px solid ${BORDER}`, "--stagger-delay": `${i * 50}ms` }}>
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="hover:bg-[var(--mist)] transition-colors"
                  style={{ display: "block", padding: "12px 8px", margin: "0 -8px", borderRadius: 10, textDecoration: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${job.title}${job.client ? ` · ${job.client}` : ""}`}>
                      {job.title}
                      {job.client && <span style={{ color: TEXT_SUB, fontWeight: 400 }}> · {job.client}</span>}
                    </p>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {PRIORITY_LABEL[job.priority] && (job.priority === "urgent" || job.priority === "high") && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: RED_BG, color: RED }}>{PRIORITY_LABEL[job.priority]}</span>
                      )}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: TEXT_SUB }}>{formatNumber(job.candidates)}</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: BORDER2, borderRadius: 9999, overflow: "hidden", display: "flex" }}>
                      {(stats?.stageSegments || []).map((seg) =>
                        seg.pct > 0 ? <div key={seg.key} title={`${STAGE_LABELS[seg.key]}: ${seg.pct}%`} style={{ width: `${seg.pct}%`, background: STAGE_COLORS[seg.key] }} /> : null
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: late ? RED : TEXT_FAINT, flexShrink: 0 }}>
                      {job.interviewing ? `${job.interviewing} interviewing · ` : ""}
                      {job.offers ? `${job.offers} offer${job.offers === 1 ? "" : "s"} · ` : ""}
                      {job.targetDate ? `fill by ${new Date(`${job.targetDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}` : `${formatNumber(stats?.strongMatches ?? 0)} strong`}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── Recruiter performance ─────────────────────────────────────────────── */

export function RecruiterPerformance({ recruiters }) {
  if (recruiters.length === 0) return null;
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Team"
        title="Recruiter performance"
        action={<Link href="/dashboard/analytics" style={{ fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none" }}>Full analytics →</Link>}
      />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {recruiters.map((r, i) => (
          <li
            key={r.key}
            className="fade-up-in"
            style={{ borderTop: `1px solid ${BORDER}`, "--stagger-delay": `${i * 50}ms` }}
          >
            <Link
              href={r.id ? `/dashboard/candidates?recruiterId=${encodeURIComponent(r.id)}` : "/dashboard/team"}
              title={`${r.name}'s candidates`}
              className="hover:bg-[var(--mist)] transition-colors"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 8px", margin: "0 -8px", borderRadius: 10, textDecoration: "none" }}
            >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: ACCENT_FG, flexShrink: 0 }}>
                {r.name[0]}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: TEXT_SUB, flexShrink: 0 }}>
              <span><strong style={{ color: TEXT, fontFamily: "var(--font-mono)" }}>{formatNumber(r.completed)}</strong> analysed</span>
              <span><strong style={{ color: TEXT, fontFamily: "var(--font-mono)" }}>{r.avgScore ?? "-"}</strong> avg</span>
              <span><strong style={{ color: GREEN_FG, fontFamily: "var(--font-mono)" }}>{formatNumber(r.placements)}</strong> placed</span>
            </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
