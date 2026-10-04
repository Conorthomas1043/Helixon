"use client";

// Part of the dashboard home (app/dashboard/page.js).

import Link from "next/link";
import { track } from "@/lib/analytics";
import { ACCENT, ACCENT_BG, ACCENT_FG, AMBER_BG, AMBER_FG, BORDER, BORDER2, CARD, GREEN_FG, RED, SURFACE, TEXT, TEXT_FAINT, TEXT_SUB } from "./shared";
import { useHydrated } from "@/lib/hooks/useHydrated";

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/* ─── First run ─────────────────────────────────────────────────────────── */

// What a brand-new account sees instead of a wall of zeros. It used to open
// on five empty business KPIs, an "All clear" risks panel and an empty
// agenda, with the one useful action ("Upload your first CV") below the
// fold. A short checklist gives the first session a clear goal; the
// workspace step starts ticked, because it's done (paying and naming the
// agency created it) and a list that's already under way is one people
// finish. It goes away by itself once the first CV has been screened.
export function GettingStarted({ hasJob, showTeam }) {
  const steps = [
    { key: "workspace", title: "Set up your workspace", body: "Your agency's Helixon is ready.", done: true },
    { key: "analyse", title: "Screen your first CV", body: "Score a CV against a role and see the evidence behind it. It takes under a minute.", href: "/analyse", cta: "Screen a CV", primary: true },
    { key: "job", title: "Add a job you're working on", body: "Keep every candidate for a role, their scores and their stage in one pipeline.", href: "/dashboard/jobs?new=1", cta: "Add a job", done: hasJob },
    { key: "import", title: "Bring in candidates you already have", body: "Import from a spreadsheet or your old system so search covers everyone.", href: "/dashboard/import", cta: "Import" },
    showTeam && { key: "team", title: "Invite your team", body: "Shortlists, notes and scores are shared, with a record of who did what.", href: "/dashboard/team", cta: "Invite" },
  ].filter(Boolean);
  const doneCount = steps.filter((st) => st.done).length;

  return (
    <section style={{ ...CARD, padding: "24px 28px" }} aria-labelledby="getting-started-title">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, margin: "0 0 4px" }}>Getting started</p>
          <h2 id="getting-started-title" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: TEXT, margin: 0 }}>
            Get your first shortlist in a few minutes
          </h2>
        </div>
        <p style={{ fontSize: 14, color: TEXT_SUB, margin: 0 }}>{doneCount} of {steps.length} done</p>
      </div>
      <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}
        style={{ height: 4, borderRadius: 9999, background: BORDER2, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ width: `${(doneCount / steps.length) * 100}%`, height: "100%", background: ACCENT, borderRadius: 9999 }} />
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((st) => (
          <li key={st.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderTop: `1px solid ${BORDER2}` }}>
            <span aria-hidden="true" style={{
              width: 24, height: 24, flexShrink: 0, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center",
              background: st.done ? ACCENT : "transparent", border: `1.5px solid ${st.done ? ACCENT : st.primary ? ACCENT : BORDER}`,
            }}>
              {st.done && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              )}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: st.done ? TEXT_FAINT : TEXT, margin: 0, textDecoration: st.done ? "line-through" : "none" }}>
                {st.title}<span className="sr-only">{st.done ? " (done)" : ""}</span>
              </p>
              {!st.done && <p style={{ fontSize: 14, color: TEXT_SUB, margin: "2px 0 0" }}>{st.body}</p>}
            </div>
            {!st.done && st.href && (
              <Link href={st.href} onClick={() => track("onboarding_step_clicked", { step: st.key })} style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", minHeight: 36, fontSize: 14, fontWeight: 600, padding: "0 14px", borderRadius: 10, textDecoration: "none",
                background: st.primary ? ACCENT : "transparent", color: st.primary ? "#fff" : TEXT, border: st.primary ? "none" : `1.5px solid ${BORDER}`,
              }}>
                {st.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TeamWelcome({ agencyName, onDismiss }) {
  const steps = [
    { key: "jobs", title: "Find the jobs you're working on", body: "Each job keeps its candidates, scores and stages together.", href: "/dashboard/jobs", cta: "Open jobs" },
    { key: "pipeline", title: "See how your team moves candidates", body: "The pipeline shows every stage your agency uses.", href: "/dashboard/pipeline", cta: "Open pipeline" },
    { key: "analyse", title: "Screen your first CV", body: "Score a CV against one of the team's jobs, or a new one.", href: "/analyse", cta: "Screen a CV", primary: true },
  ];
  return (
    <section style={{ ...CARD, padding: "22px 26px" }} aria-labelledby="team-welcome-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, margin: "0 0 4px" }}>New to the team</p>
          <h2 id="team-welcome-title" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: TEXT, margin: 0 }}>
            Welcome to {agencyName || "your agency's"} Helixon
          </h2>
          <p style={{ fontSize: 14, color: TEXT_SUB, margin: "4px 0 0" }}>Three places to start. Press <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 13, padding: "1px 5px", border: `1px solid ${BORDER}`, borderRadius: 4 }}>?</kbd> anywhere for keyboard shortcuts.</p>
        </div>
        <button type="button" onClick={onDismiss} style={{ fontSize: 14, color: TEXT_SUB, textDecoration: "underline", background: "none", border: 0, cursor: "pointer", minHeight: 32 }}>
          Got it
        </button>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((st, i) => (
          <li key={st.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: `1px solid ${BORDER2}` }}>
            <span aria-hidden="true" style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: ACCENT_BG, color: ACCENT_FG }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0 }}>{st.title}</p>
              <p style={{ fontSize: 14, color: TEXT_SUB, margin: "2px 0 0" }}>{st.body}</p>
            </div>
            <Link href={st.href} onClick={() => track("team_welcome_step_clicked", { step: st.key })} style={{
              flexShrink: 0, display: "inline-flex", alignItems: "center", minHeight: 36, fontSize: 14, fontWeight: 600, padding: "0 14px", borderRadius: 10, textDecoration: "none",
              background: st.primary ? ACCENT : "transparent", color: st.primary ? "#fff" : TEXT, border: st.primary ? "none" : `1.5px solid ${BORDER}`,
            }}>
              {st.cta}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ─── Header ────────────────────────────────────────────────────────────── */

export function DashboardHeader({ greetingName, agencyName, plan, subtitle, isRefreshing, refreshError, onRefresh }) {
  const hydrated = useHydrated(); // clock/time-zone text waits for the browser
  return (
    <header style={{
      ...CARD,
      position: "relative",
      overflow: "hidden",
      padding: "28px 32px",
      display: "flex",
      flexWrap: "wrap",
      gap: 20,
      alignItems: "center",
      justifyContent: "space-between",
      background: `linear-gradient(135deg, ${SURFACE} 0%, rgba(var(--forest-rgb),0.06) 100%)`,
    }}>
      <div
        className="ambient-glow"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-40%",
          right: "-10%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(var(--forest-rgb),0.10) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ minWidth: 0, flex: 1, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {plan && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "3px 10px",
              borderRadius: 9999,
              background: ACCENT_BG,
              color: ACCENT_FG,
              border: `1px solid rgba(var(--forest-rgb),0.2)`,
            }}>
              {plan.name} plan
            </span>
          )}
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 600, color: TEXT, marginBottom: 6, marginTop: 0 }}>
          {hydrated ? getGreeting() : "Hello"}
          {greetingName ? <>, <span style={{ color: ACCENT_FG }}>{greetingName}</span></> : null}
        </h1>
        {agencyName && (
          <p style={{ fontSize: 14, color: TEXT_FAINT, marginTop: 0, marginBottom: 6 }}>{agencyName}</p>
        )}
        <p style={{ fontSize: 14, color: TEXT_SUB, maxWidth: 520, marginBottom: 10, marginTop: 0 }}>{subtitle}</p>

        <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 20 }} aria-live="polite">
          {isRefreshing && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: TEXT_FAINT }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN_FG, display: "inline-block" }} aria-hidden="true" />
              Refreshing…
            </span>
          )}
          {!isRefreshing && refreshError && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: RED }}>
              Couldn&apos;t refresh - showing last data.
              <button type="button" onClick={onRefresh} style={{ color: RED, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}>
                Retry
              </button>
            </span>
          )}
          {!isRefreshing && !refreshError && (
            <button type="button" onClick={onRefresh} style={{ fontSize: 12, color: TEXT_FAINT, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Refresh ↺
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
        <Link href="/dashboard/candidates" style={{
          display: "inline-flex", alignItems: "center", fontSize: 14, fontWeight: 600,
          padding: "10px 16px", borderRadius: 9999, border: `1px solid ${BORDER}`,
          color: TEXT, textDecoration: "none", background: SURFACE,
        }}>
          Browse candidates
        </Link>
        <Link href="/dashboard/pipeline" style={{
          display: "inline-flex", alignItems: "center", fontSize: 14, fontWeight: 600,
          padding: "10px 16px", borderRadius: 9999, border: `1px solid ${BORDER}`,
          color: TEXT, textDecoration: "none", background: SURFACE,
        }}>
          Pipeline
        </Link>
        <Link href="/analyse" style={{
          display: "inline-flex", alignItems: "center", fontSize: 14, fontWeight: 600,
          padding: "10px 16px", borderRadius: 9999,
          background: ACCENT, color: "#fff", textDecoration: "none",
        }}>
          + Screen a CV
        </Link>
      </div>
    </header>
  );
}

/* ─── Footer ────────────────────────────────────────────────────────────── */

export function DashboardFooter() {
  return (
    <footer style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 20, fontSize: 13, color: TEXT_FAINT, borderTop: `1px solid ${BORDER}` }}>
      <span>Helixon - recruiter dashboard</span>
      <nav style={{ display: "flex", alignItems: "center", gap: 20 }} aria-label="Support links">
        {[["FAQ", "/faq"], ["Contact", "/contact"], ["Privacy", "/privacy"]].map(([label, href]) => (
          <Link key={href} href={href} style={{ color: TEXT_FAINT, textDecoration: "none" }} className="hover:text-[var(--ink)] transition-colors">{label}</Link>
        ))}
      </nav>
    </footer>
  );
}

export function ScopeToggle({ scope, onChange }) {
  const tab = (active) => ({
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 9999,
    border: "none",
    cursor: "pointer",
    background: active ? SURFACE : "transparent",
    color: active ? TEXT : TEXT_SUB,
    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <p style={{ fontSize: 13, color: TEXT_FAINT, margin: 0 }}>
        {scope === "mine" ? "Showing candidates assigned to you." : "Showing the whole team's candidates."}
      </p>
      <div role="group" aria-label="Whose numbers to show" style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 9999, background: BORDER2 }}>
        <button type="button" aria-pressed={scope === "mine"} onClick={() => onChange("mine")} style={tab(scope === "mine")}>Mine</button>
        <button type="button" aria-pressed={scope === "team"} onClick={() => onChange("team")} style={tab(scope === "team")}>Team</button>
      </div>
    </div>
  );
}

export function TruncatedNotice() {
  return (
    <div role="status" style={{ ...CARD, padding: "12px 16px", fontSize: 14, color: AMBER_FG, background: AMBER_BG, borderColor: "transparent" }}>
      Your agency has more candidates than the Overview can load at once, so these numbers leave out the oldest ones.
      {" "}<Link href="/dashboard/analytics" style={{ color: AMBER_FG, fontWeight: 600 }}>Analytics</Link> counts everything.
    </div>
  );
}
