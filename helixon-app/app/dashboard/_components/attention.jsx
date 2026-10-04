"use client";

// Part of the dashboard home (app/dashboard/page.js).

import Link from "next/link";
import { SectionHeading } from "@/components/ui";
import { completeNextAction, getFollowUps } from "@/lib/dashboard-api";
import { useEffect, useState } from "react";
import { ACCENT, ACCENT_FG, AMBER_BG, AMBER_FG, BORDER, CARD, RED, RED_BG, RED_STRONG, SURFACE, SURFACE2, TEXT, TEXT_FAINT, TEXT_SUB, formatDate, formatMoneyShort, scoreColor } from "./shared";
import { EmptyState } from "./states";
import { useHydrated } from "@/lib/hooks/useHydrated";

/* ─── Helpers ───────────────────────────────────────────────────────────── */

export function formatRelativeTime(date) {
  if (!date) return "-";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

/* ─── Attention panel ───────────────────────────────────────────────────── */

export function AttentionPanel({ items: firstItems, allItems, total }) {
  const hydrated = useHydrated(); // clock/time-zone text waits for the browser
  // Everything is already loaded - "show all" expands in place rather than
  // sending you to an unfiltered candidate list.
  const [expanded, setExpanded] = useState(false);
  const items = expanded ? allItems : firstItems;
  const hiddenCount = Math.max(0, total - firstItems.length);
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading eyebrow="Priority" title="Needs your attention" />
      {items.length === 0 ? (
        <EmptyState title="Nothing needs attention" body="No failed analyses, overdue follow-ups, stalled candidates, or unreviewed strong matches right now." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item, i) => (
            <li
              key={item.id}
              className="fade-up-in"
              style={{ borderTop: `1px solid ${BORDER}`, "--stagger-delay": `${i * 50}ms` }}
            >
              <Link href={item.actionHref} title={`${item.candidateName} - ${item.jobTitle}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 8px",
                borderRadius: 10, textDecoration: "none",
              }}
                className="hover:bg-[var(--mist)] transition-colors"
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.candidateName}</p>
                  <p style={{ fontSize: 13, color: TEXT_SUB, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.jobTitle}</p>
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 600,
                  padding: "3px 10px", borderRadius: 9999, whiteSpace: "nowrap",
                  background: item.tone.bg, color: item.tone.fg,
                }}>
                  {item.reasonLabel}
                </span>
                <span style={{ fontSize: 12, color: TEXT_FAINT, whiteSpace: "nowrap", flexShrink: 0 }}>{hydrated ? formatRelativeTime(item.createdAt) : ""}</span>
                {item.score !== null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: scoreColor(item.score), flexShrink: 0, width: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.score}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{ display: "block", width: "100%", textAlign: "center", fontSize: 13, fontWeight: 600, color: ACCENT_FG, background: "none", border: "none", cursor: "pointer", paddingTop: 12, marginTop: 4, borderTop: `1px solid ${BORDER}` }}
        >
          {expanded ? "Show fewer" : `Show ${hiddenCount} more ${hiddenCount === 1 ? "item" : "items"} needing attention`}
        </button>
      )}
    </div>
  );
}

/* ─── Follow-ups ────────────────────────────────────────────────────────── */

export const WHEN_STYLE = {
  overdue: { label: "Overdue", fg: RED_STRONG, bg: RED_BG },
  today: { label: "Today", fg: AMBER_FG, bg: AMBER_BG },
  upcoming: { label: "Upcoming", fg: TEXT_SUB, bg: SURFACE2 },
  undated: { label: "No date", fg: TEXT_FAINT, bg: SURFACE2 },
};

export function formatDue(dueAt) {
  if (!dueAt) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dueAt);
  const d = new Date(dateOnly ? `${dueAt}T12:00:00` : dueAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", dateOnly ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Every open next action and talent-pool check-in, most urgent first -
// "mine" (assigned to me) or the whole team. The one place to see what's
// due across all candidates; done here or on the candidate.
export function FollowUpsPanel() {
  const [scope, setScope] = useState("mine");
  const [state, setState] = useState({ scope: null, items: [], error: false, truncated: false });
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getFollowUps(scope)
      .then((d) => { if (!cancelled) setState({ scope, items: d.items ?? [], error: false, truncated: d.truncated }); })
      .catch(() => { if (!cancelled) setState({ scope, items: [], error: true, truncated: false }); });
    return () => { cancelled = true; };
  }, [scope, reloadKey]);

  async function complete(item) {
    setCompleting(item.id);
    try {
      await completeNextAction(item.candidateId);
      setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }));
    } catch {
      setReloadKey((k) => k + 1);
    } finally {
      setCompleting(null);
    }
  }

  const loading = state.scope !== scope;
  const due = state.items.filter((i) => i.when === "overdue" || i.when === "today").length;
  const shown = expanded ? state.items : state.items.slice(0, 7);
  const tabStyle = (on) => ({
    fontSize: 13, fontWeight: 600, padding: "4px 12px", borderRadius: 9999, cursor: "pointer",
    border: `1px solid ${on ? ACCENT : BORDER}`, background: on ? ACCENT : SURFACE, color: on ? "#fff" : TEXT_SUB,
  });

  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow={loading ? "Follow-ups" : `${due} due now`}
        title="Follow-ups"
        action={
          <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Whose follow-ups">
            <button type="button" aria-pressed={scope === "mine"} onClick={() => { setScope("mine"); setExpanded(false); }} style={tabStyle(scope === "mine")}>Mine</button>
            <button type="button" aria-pressed={scope === "all"} onClick={() => { setScope("all"); setExpanded(false); }} style={tabStyle(scope === "all")}>Everyone</button>
          </div>
        }
      />
      {loading ? (
        <div className="animate-pulse motion-reduce:animate-none" style={{ height: 120, borderRadius: 10, background: SURFACE2 }} aria-busy="true" />
      ) : state.error ? (
        <p style={{ fontSize: 14, color: TEXT_SUB }}>Couldn&apos;t load follow-ups.</p>
      ) : state.items.length === 0 ? (
        <EmptyState
          title="No follow-ups"
          body={scope === "mine" ? "Set a next action on a candidate and it shows up here when it's due." : "Nobody on the team has a follow-up set."}
        />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {shown.map((item) => {
            const w = WHEN_STYLE[item.when] ?? WHEN_STYLE.undated;
            return (
              <li key={item.id} style={{ borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10, padding: "10px 4px" }}>
                <Link
                  href={item.kind === "check_in" ? "/dashboard/talent-pool?due=1" : item.kind === "interview" ? "/dashboard/interviews" : `/dashboard/candidates/${item.candidateId}`}
                  style={{ minWidth: 0, flex: 1, textDecoration: "none" }}
                  className="hover:underline"
                >
                  <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: 13, color: TEXT_SUB, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.candidateName}
                    {item.jobTitle ? ` · ${item.jobTitle}` : ""}
                    {scope === "all" && item.recruiterName ? ` · ${item.recruiterName}` : ""}
                  </p>
                </Link>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 9999, whiteSpace: "nowrap", background: w.bg, color: w.fg }}>
                  {item.dueAt ? formatDue(item.dueAt) : w.label}
                </span>
                {item.kind === "action" && (
                  <button
                    type="button"
                    onClick={() => complete(item)}
                    disabled={completing === item.id}
                    title="Mark done"
                    aria-label={`Mark "${item.label}" for ${item.candidateName} done`}
                    style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 9999, border: `1px solid ${BORDER}`, background: SURFACE, color: ACCENT_FG, cursor: "pointer", opacity: completing === item.id ? 0.5 : 1 }}
                  >
                    Done
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!loading && state.items.length > 7 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{ display: "block", width: "100%", textAlign: "center", fontSize: 13, fontWeight: 600, color: ACCENT_FG, background: "none", border: "none", cursor: "pointer", paddingTop: 12, marginTop: 4, borderTop: `1px solid ${BORDER}` }}
        >
          {expanded ? "Show fewer" : `Show all ${state.items.length}${state.truncated ? "+" : ""}`}
        </button>
      )}
    </div>
  );
}

export const ALERT_TONE = {
  red: { bg: RED_BG, fg: RED },
  amber: { bg: AMBER_BG, fg: AMBER_FG },
  neutral: { bg: SURFACE2, fg: TEXT_SUB },
};

// Money, compliance and contract risks that need someone today.
export function RisksPanel({ alerts }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? alerts : alerts.slice(0, 6);
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading eyebrow="Money & compliance" title="Don't let these slip" />
      {alerts.length === 0 ? (
        <EmptyState title="All clear" body="No overdue invoices, timesheets waiting, expiring checks, or contracts and rebate periods ending soon." />
      ) : (
        <>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {shown.map((a) => {
              const tone = ALERT_TONE[a.tone] || ALERT_TONE.neutral;
              return (
                <li key={a.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Link href={a.href} className="hover:bg-[var(--mist)] transition-colors" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", margin: "0 -8px", borderRadius: 10, textDecoration: "none" }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: tone.fg, flexShrink: 0 }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: TEXT }}>{a.title}</span>
                      {a.detail && <span style={{ display: "block", fontSize: 13, color: TEXT_SUB, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</span>}
                    </span>
                    {typeof a.amount === "number" && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: tone.fg, flexShrink: 0 }}>{formatMoneyShort(a.amount)}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          {alerts.length > 6 && (
            <button type="button" onClick={() => setExpanded((v) => !v)} style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: ACCENT_FG, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {expanded ? "Show fewer" : `Show all ${alerts.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Interviews in the next 7 days, and client follow-ups that are due.
export function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function AgendaPanel({ interviews, total, clientFollowUps }) {
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Next 7 days"
        title="Agenda"
        action={<Link href="/dashboard/interviews" style={{ fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none" }}>{total > interviews.length ? `All ${total} →` : "Interviews →"}</Link>}
      />
      {interviews.length === 0 && clientFollowUps.length === 0 ? (
        <EmptyState title="Nothing booked" body="No interviews in the next week and no client follow-ups due." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {interviews.map((i) => (
            <li key={i.id} style={{ borderTop: `1px solid ${BORDER}` }}>
              <Link href={`/dashboard/candidates/${i.candidateId}`} className="hover:bg-[var(--mist)] transition-colors" style={{ display: "flex", gap: 12, padding: "10px 8px", margin: "0 -8px", borderRadius: 10, textDecoration: "none" }}>
                <span style={{ width: 78, flexShrink: 0, fontSize: 13, color: TEXT_SUB }}>
                  <span style={{ display: "block", fontWeight: 600, color: TEXT }}>{dayLabel(i.startsAt)}</span>
                  {new Date(i.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: TEXT }}>{i.candidateName}</span>
                  <span style={{ display: "block", fontSize: 13, color: TEXT_SUB }}>
                    {i.round > 1 ? `Round ${i.round} · ` : ""}
                    {i.jobTitle || "Interview"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {clientFollowUps.map((c) => (
            <li key={`client-${c.id}`} style={{ borderTop: `1px solid ${BORDER}` }}>
              <Link href={`/dashboard/clients/${c.id}`} className="hover:bg-[var(--mist)] transition-colors" style={{ display: "flex", gap: 12, padding: "10px 8px", margin: "0 -8px", borderRadius: 10, textDecoration: "none" }}>
                <span style={{ width: 78, flexShrink: 0, fontSize: 13, fontWeight: 600, color: c.overdue ? RED : TEXT }}>{c.overdue ? "Overdue" : "Today"}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: TEXT }}>{c.label}</span>
                  <span style={{ display: "block", fontSize: 13, color: TEXT_SUB }}>Client · {c.name}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
