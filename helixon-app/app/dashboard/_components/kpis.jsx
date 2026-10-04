"use client";

// Part of the dashboard home (app/dashboard/page.js).

import CountUp from "@/components/dashboard/CountUp";
import Link from "next/link";
import { METRICS, METRIC_KEYS } from "@/lib/performance";
import { SectionHeading } from "@/components/ui";
import { getPerformance } from "@/lib/dashboard-api";
import { useEffect, useState } from "react";
import { useNow } from "@/lib/hooks/useNow";
import { ACCENT, ACCENT_FG, BORDER2, CARD, GOLD, GREEN, GREEN_FG, RED, SURFACE2, TEXT, TEXT_FAINT, TEXT_SUB, formatMoneyShort, formatNumber } from "./shared";

/* ─── KPIs ──────────────────────────────────────────────────────────────── */

export function KpiCard({ label, value, sub, meter, accent, index = 0 }) {
  // Meter bar grows in from 0 on mount rather than just appearing at its
  // final width - a two-step state flip so the width change is a real
  // CSS transition, not just paint-in-place.
  const [meterGrown, setMeterGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMeterGrown(true), index * 70 + 150);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div
      className="fade-up-in lift-on-hover"
      style={{ ...CARD, padding: 20, "--stagger-delay": `${index * 70}ms` }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, marginBottom: 10, marginTop: 0 }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 600, color: accent || TEXT, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        <CountUp value={value} format={formatNumber} />
      </p>
      {typeof meter === "number" && (
        <div style={{ height: 3, background: BORDER2, borderRadius: 9999, marginTop: 12, marginBottom: 6, overflow: "hidden" }}>
          <div
            style={{
              height: 3,
              width: meterGrown ? `${Math.min(100, Math.max(0, meter))}%` : "0%",
              background: ACCENT,
              borderRadius: 9999,
              transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
      )}
      {sub && <p style={{ fontSize: 13, color: TEXT_FAINT, marginTop: typeof meter === "number" ? 2 : 8, marginBottom: 0 }}>{sub}</p>}
    </div>
  );
}

export function DashboardKpis({ totals }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-live="polite">
      <KpiCard index={0} label="Total analyses" value={totals.total} sub={`${formatNumber(totals.last7)} in the last 7 days`} />
      <KpiCard index={1} label="Strong matches" value={totals.strongMatches} sub={totals.completed > 0 ? `${totals.strongMatchPct}% of completed` : "No completed yet"} accent={GREEN_FG} />
      <KpiCard index={2} label="In pipeline" value={totals.inPipeline} sub="Active, not yet placed" accent={GOLD} />
      <KpiCard index={3} label="Avg. score" value={totals.completed > 0 ? totals.avgScore : "-"} sub={totals.completed > 0 ? "Across completed" : "No completed yet"} meter={totals.completed > 0 ? totals.avgScore : undefined} accent={ACCENT_FG} />
    </div>
  );
}

/* ─── Usage ─────────────────────────────────────────────────────────────── */

// Plan name plus real usage counted from the agency's analyses. The
// agencies.analyses_used counter is never incremented and analyses_limit is
// a placeholder default, so a used/limit meter built on them would show
// every agency "0 of 3" - better to show what actually happened.
export function UsageSummary({ plan, analyses }) {
  const DAY = 86400000;
  const now = useNow();
  const last30 = analyses.filter((a) => a.createdAt && now - a.createdAt.getTime() < 30 * DAY).length;
  const thisMonth = analyses.filter((a) => {
    if (!a.createdAt) return false;
    const d = a.createdAt;
    const n = new Date(now);
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  return (
    <div style={{ ...CARD, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
      <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, marginTop: 0, marginBottom: 6 }}>Your plan</p>
      <p style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: 0, fontFamily: "var(--font-display)" }}>{plan?.name ? `${plan.name}` : "No active plan"}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: TEXT, margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatNumber(thisMonth)}</p>
          <p style={{ fontSize: 13, color: TEXT_FAINT, margin: "2px 0 0" }}>analyses this month</p>
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: TEXT, margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatNumber(last30)}</p>
          <p style={{ fontSize: 13, color: TEXT_FAINT, margin: "2px 0 0" }}>in the last 30 days</p>
        </div>
      </div>
      <Link href="/billing" style={{ fontSize: 13, fontWeight: 600, marginTop: "auto", paddingTop: 16, color: ACCENT_FG, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
        {plan?.name ? "Manage plan →" : "Choose a plan →"}
      </Link>
    </div>
  );
}

export function BusinessKpis({ kpis }) {
  const items = [
    { label: "Open jobs", value: kpis.openJobs, sub: kpis.openings > kpis.openJobs ? `${formatNumber(kpis.openings)} openings` : "Roles you're filling", href: "/dashboard/jobs" },
    { label: "Interviews", value: kpis.interviewsThisWeek, sub: kpis.interviewsToday ? `${kpis.interviewsToday} today` : "Next 7 days", href: "/dashboard/interviews" },
    { label: "Offers out", value: kpis.offersOut, sub: "Waiting on an answer", href: "/dashboard/placements" },
    { label: "Placed this month", value: kpis.placementsThisMonth, sub: kpis.feesThisMonth == null ? "This month" : `${formatMoneyShort(kpis.feesThisMonth)} in fees`, href: "/dashboard/placements" },
    // Hidden from members when money is admin-only (lib/permissions.js).
    kpis.outstanding != null && {
      label: "Owed to you",
      value: formatMoneyShort(kpis.outstanding),
      sub: kpis.overdueCount ? `${formatMoneyShort(kpis.overdueTotal)} overdue` : "Nothing overdue",
      tone: kpis.overdueCount ? RED : null,
      href: "/dashboard/placements?tab=invoices",
    },
  ].filter(Boolean);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {items.map((it, i) => (
        <Link
          key={it.label}
          href={it.href}
          className="fade-up-in lift-on-hover"
          style={{ ...CARD, padding: 18, textDecoration: "none", display: "block", "--stagger-delay": `${i * 60}ms` }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, margin: "0 0 8px" }}>{it.label}</p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, color: TEXT, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {typeof it.value === "number" ? formatNumber(it.value) : it.value}
          </p>
          <p style={{ fontSize: 13, color: it.tone || TEXT_FAINT, margin: "8px 0 0" }}>{it.sub}</p>
        </Link>
      ))}
    </div>
  );
}

export function formatMetric(key, n) {
  if (METRICS[key]?.money) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(n || 0));
  }
  return formatNumber(Number(n || 0));
}

// This month against target - the same figures as /dashboard/performance,
// for you or for the team depending on the Mine/Team switch.
export function TargetsCard({ scope }) {
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    getPerformance("this_month")
      .then((data) => { if (!cancelled) setState({ status: "ready", data }); })
      .catch(() => { if (!cancelled) setState({ status: "error", data: null }); });
    return () => { cancelled = true; };
  }, []);

  // Not every plan or role can read performance - nothing to show then.
  if (state.status === "error") return null;

  const source = state.data
    ? scope === "mine"
      ? state.data.people?.find((p) => p.me) ?? null
      : state.data.team ?? null
    : null;
  const rows = source
    ? METRIC_KEYS.filter((k) => Number(source.targets?.[k]) > 0)
        .slice(0, 4)
        .map((k) => {
          const actual = Number(source.metrics?.[k] || 0);
          const target = Number(source.targets[k]);
          return { key: k, label: METRICS[k].label, actual, target, pct: Math.min(100, Math.round((actual / target) * 100)) };
        })
    : [];

  return (
    <section style={{ ...CARD, padding: 24 }} aria-busy={state.status === "loading"}>
      <SectionHeading
        eyebrow="This month"
        title={scope === "mine" ? "Your targets" : "Team targets"}
        action={<Link href="/dashboard/performance" style={{ fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none" }}>Leaderboard →</Link>}
      />
      {state.status === "loading" ? (
        <div style={{ height: 96, borderRadius: 10, background: SURFACE2 }} />
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 14, color: TEXT_SUB, margin: 0 }}>
          No targets set{scope === "mine" ? " for you" : ""} yet.{" "}
          <Link href="/dashboard/settings/targets" style={{ color: ACCENT_FG, fontWeight: 600 }}>Set targets</Link>
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map((r) => (
            <li key={r.key}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                <span style={{ color: TEXT }}>{r.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: TEXT_SUB, fontVariantNumeric: "tabular-nums" }}>
                  {formatMetric(r.key, r.actual)} / {formatMetric(r.key, r.target)}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 9999, background: BORDER2, marginTop: 6, overflow: "hidden" }} role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.label}: ${r.pct}% of target`}>
                <div style={{ height: 6, width: `${r.pct}%`, borderRadius: 9999, background: r.pct >= 100 ? GREEN : r.pct >= 60 ? GOLD : RED }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
