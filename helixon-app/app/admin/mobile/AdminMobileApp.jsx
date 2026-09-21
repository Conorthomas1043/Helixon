"use client";

import { useMemo, useState } from "react";
import { useAdminStats, useAdminTraffic, useAdminUsers, useAdminHealth } from "../_shared/hooks";
import { useAdminSession } from "../_shared/session";
import { ModalHost, confirmAction } from "../_shared/modal";
import { ToastHost, toast } from "../_shared/toast";
import { timeAgo } from "../_shared/data";
import { Icon } from "../_shared/icons";

const RED = "#e0554f";
const AMBER = "#d99a3a";
const GREEN = "#0b6e4f";

const TABS = [
  { id: "overview", label: "Overview", icon: "command" },
  { id: "health", label: "Health", icon: "activity" },
  { id: "security", label: "Security", icon: "shield" },
  { id: "users", label: "Users", icon: "users" },
];

const RANGES = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

export default function AdminMobileApp({ username }) {
  const [tab, setTab] = useState("overview");
  const { signOut } = useAdminSession();

  return (
    <div className="mobile-app" style={{ background: "var(--mist)", minHeight: "100dvh" }}>
      <ModalHost />
      <ToastHost />

      <header
        className="flex items-center justify-between px-4"
        style={{
          height: 52,
          paddingTop: "env(safe-area-inset-top)",
          background: "white",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-[8px] flex items-center justify-center"
            style={{ background: "var(--forest)" }}
          >
            <span className="text-white text-[11px] font-bold">H</span>
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
              Admin
            </div>
            <div className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
              {username}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="w-9 h-9 flex items-center justify-center rounded-[10px]"
          style={{ color: "var(--ink-soft)" }}
        >
          <Icon name="logout" size={18} />
        </button>
      </header>

      <main
        className="px-4 pt-4"
        style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
      >
        {tab === "overview" && <OverviewTab />}
        {tab === "health" && <HealthTab />}
        {tab === "security" && <SecurityTab />}
        {tab === "users" && <UsersTab />}
      </main>

      <nav
        className="flex items-stretch"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: "white",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
          zIndex: 20,
        }}
        aria-label="Sections"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5"
              style={{ color: active ? "var(--forest)" : "var(--ink-faint)" }}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={t.icon} size={20} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────

function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-2.5 mt-5 first:mt-0">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
        {children}
      </h2>
      {right}
    </div>
  );
}

function RangeControl({ value, onChange }) {
  return (
    <div
      className="inline-flex rounded-[10px] p-0.5"
      style={{ background: "var(--mint)" }}
    >
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-[8px] transition-colors"
          style={{
            background: value === r.id ? "white" : "transparent",
            color: value === r.id ? "var(--forest)" : "var(--ink-faint)",
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className="rounded-[14px] p-3.5" style={{ background: "white", border: "1px solid var(--border)" }}>
      <div className="text-[10px] font-medium mb-1" style={{ color: "var(--ink-faint)" }}>
        {label}
      </div>
      <div
        className="text-xl font-semibold tabular-nums"
        style={{ color: tone || "var(--ink)", fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="rounded-[14px]" style={{ background: "white", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

function EmptyRow({ children }) {
  return (
    <div className="text-[12px] text-center py-6" style={{ color: "var(--ink-faint)" }}>
      {children}
    </div>
  );
}

function ErrorNotice({ message }) {
  if (!message) return null;
  return (
    <div
      className="text-[12px] rounded-[10px] px-3 py-2.5 mb-3"
      style={{ background: "#fdf1f0", color: RED, border: "1px solid #f6d6d3" }}
    >
      {message}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const [range, setRange] = useState("24h");
  const { stats, error, loading, reload } = useAdminStats(range);
  const t = stats?.totals;

  return (
    <div>
      <SectionTitle right={<RangeControl value={range} onChange={setRange} />}>Key stats</SectionTitle>
      <ErrorNotice message={error} />
      {loading && !stats ? (
        <EmptyRow>Loading…</EmptyRow>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <Kpi label="Agencies" value={t?.agencies ?? "-"} />
          <Kpi label="Customers" value={t?.users ?? "-"} />
          <Kpi label="CVs screened" value={t?.analyses ?? "-"} />
          <Kpi label="Jobs" value={t?.jobs ?? "-"} />
          <Kpi label={`Requests (${range})`} value={t?.requests ?? "-"} />
          <Kpi label="Blocked requests" value={t?.blockedRequests ?? "-"} tone={t?.blockedRequests ? RED : undefined} />
          <Kpi
            label="Failed sign-ins"
            value={t?.failedAuthAttempts ?? "-"}
            tone={t?.failedAuthAttempts ? AMBER : undefined}
          />
          <Kpi label="Employees" value={t?.employees ?? "-"} />
        </div>
      )}
      <button
        type="button"
        onClick={reload}
        className="mt-4 w-full flex items-center justify-center gap-1.5 text-[12px] font-medium py-2.5 rounded-[10px]"
        style={{ color: "var(--ink-soft)", border: "1px solid var(--border)" }}
      >
        <Icon name="refresh" size={14} />
        Refresh
      </button>
    </div>
  );
}

// ── Health ───────────────────────────────────────────────────────────────
// Mobile counterpart of /admin/health: the database, the AI providers the
// product runs on, third-party services, and how many of the curated
// public-page checks are currently failing. Condensed - full per-page
// detail (path/status/latency table) stays desktop-only.

function StatusRow({ label, snapshot, ok, note, first }) {
  const tone = !snapshot?.configured ? "#94a3b8" : snapshot?.error || snapshot?.connected === false ? RED : ok ? GREEN : AMBER;
  const text = !snapshot?.configured ? "Not configured" : snapshot?.error || note || "Connected";

  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3" style={{ borderTop: first ? "none" : "1px solid var(--border)" }}>
      <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-medium truncate" style={{ color: tone, maxWidth: "60%" }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone }} />
        <span className="truncate">{text}</span>
      </span>
    </div>
  );
}

function HealthTab() {
  const { health, error, loading, reload } = useAdminHealth();
  const database = health?.database;
  const ai = health?.aiProviders;
  const pages = health?.pages;

  const overall = useMemo(() => {
    if (!health) return null;
    const criticalDown = [database, ai?.anthropic, ai?.gemini].some((s) => s?.configured && (s.error || s.connected === false));
    const degraded = [health?.stripe, health?.clerk, health?.redis, health?.resend, health?.sentry].some((s) => s?.configured && s.error);
    const pagesFailing = (pages?.failing || 0) > 0;
    if (criticalDown) return { tone: RED, label: "Critical - core dependency down" };
    if (degraded || pagesFailing) return { tone: AMBER, label: "Degraded - see details" };
    return { tone: GREEN, label: "All systems operational" };
  }, [health, database, ai, pages]);

  return (
    <div>
      <SectionTitle>System health</SectionTitle>
      <ErrorNotice message={error} />

      {loading && !health ? (
        <EmptyRow>Loading…</EmptyRow>
      ) : (
        <>
          {overall && (
            <div className="flex items-center gap-2.5 rounded-[14px] p-3.5 mb-4" style={{ background: "white", border: "1px solid var(--border)" }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: overall.tone }} />
              <span className="text-[13px] font-semibold" style={{ color: overall.tone }}>
                {overall.label}
              </span>
            </div>
          )}

          <SectionTitle>Core infrastructure</SectionTitle>
          <Card>
            <StatusRow
              first
              label="Database"
              snapshot={database}
              ok={database?.connected}
              note={database?.connected ? `${database.latencyMs}ms query` : "Configured, unreachable"}
            />
            <StatusRow
              label="Redis"
              snapshot={health?.redis}
              ok={health?.redis?.connected}
              note={health?.redis?.connected ? `${health.redis.latencyMs}ms ping` : "Rate limiting fails open"}
            />
          </Card>

          <SectionTitle>AI providers</SectionTitle>
          <Card>
            <StatusRow
              first
              label="Anthropic"
              snapshot={ai?.anthropic}
              ok={ai?.anthropic?.connected}
              note={ai?.anthropic?.connected ? `${ai.anthropic.latencyMs}ms` : "Configured, unreachable"}
            />
            <StatusRow
              label="Gemini"
              snapshot={ai?.gemini}
              ok={ai?.gemini?.connected}
              note={ai?.gemini?.connected ? `${ai.gemini.latencyMs}ms` : "Configured, unreachable"}
            />
            <StatusRow label="Voyage" snapshot={ai?.voyage} ok={ai?.voyage?.configured} note="Not live-checked" />
          </Card>

          <SectionTitle>Business services</SectionTitle>
          <Card>
            <StatusRow first label="Stripe" snapshot={health?.stripe} ok note={health?.stripe?.configured ? `${health.stripe.totalSubscriptions ?? 0} subs` : undefined} />
            <StatusRow label="Clerk" snapshot={health?.clerk} ok note={health?.clerk?.configured ? `${health.clerk.totalUsers ?? 0} users` : undefined} />
            <StatusRow label="Resend" snapshot={health?.resend} ok={health?.resend?.allVerified} note={health?.resend?.configured ? `${health.resend.domains?.length ?? 0} domain(s)` : undefined} />
            <StatusRow
              label="Sentry"
              snapshot={health?.sentry}
              ok={health?.sentry?.configured && !health?.sentry?.unresolvedLast24h}
              note={health?.sentry?.configured ? `${health.sentry.unresolvedLast24h ?? 0} unresolved` : undefined}
            />
          </Card>

          <SectionTitle>Public pages</SectionTitle>
          <Card>
            {!pages || pages.pages.length === 0 ? (
              <EmptyRow>No page checks yet.</EmptyRow>
            ) : pages.failing === 0 ? (
              <StatusRow first label={`${pages.pages.length} pages checked`} snapshot={{ configured: true }} ok note="All returning 2xx/3xx" />
            ) : (
              pages.pages
                .filter((p) => !p.ok)
                .map((p, i) => (
                  <StatusRow key={p.path} first={i === 0} label={p.path} snapshot={{ configured: true, error: p.error }} ok={false} note={p.status ? `HTTP ${p.status}` : p.error} />
                ))
            )}
          </Card>

          <button
            type="button"
            onClick={reload}
            className="mt-4 w-full flex items-center justify-center gap-1.5 text-[12px] font-medium py-2.5 rounded-[10px]"
            style={{ color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            <Icon name="refresh" size={14} />
            Refresh
          </button>
        </>
      )}
    </div>
  );
}

// ── Security ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const { traffic, error, busy, loading, reload, block, unblock } = useAdminTraffic("24h");

  const blockedIps = useMemo(() => traffic?.blockedIps || [], [traffic]);
  const blockedSet = useMemo(() => new Set(blockedIps.map((b) => b.ip)), [blockedIps]);

  const offenders = useMemo(() => {
    const rows = traffic?.rows || [];
    const map = new Map();
    for (const row of rows) {
      if (!row.ip || blockedSet.has(row.ip)) continue;
      const entry = map.get(row.ip) || { ip: row.ip, count: 0, blocked: 0, country: row.country || "" };
      entry.count += 1;
      if (row.blocked) entry.blocked += 1;
      map.set(row.ip, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.blocked - a.blocked || b.count - a.count)
      .slice(0, 8);
  }, [traffic, blockedSet]);

  return (
    <div>
      <SectionTitle>Security, last 24h</SectionTitle>
      <ErrorNotice message={error} />
      {loading && !traffic ? (
        <EmptyRow>Loading…</EmptyRow>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Kpi
              label="Blocked requests"
              value={(traffic?.rows || []).filter((r) => r.blocked).length}
              tone={RED}
            />
            <Kpi label="IPs blocked" value={blockedIps.length} />
          </div>

          <SectionTitle>Currently blocked</SectionTitle>
          <Card>
            {blockedIps.length === 0 ? (
              <EmptyRow>No IPs are blocked right now.</EmptyRow>
            ) : (
              blockedIps.map((entry, i) => (
                <div
                  key={entry.ip}
                  className="flex items-center justify-between gap-3 px-3.5 py-3"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium tabular-nums truncate" style={{ color: "var(--ink)" }}>
                      {entry.ip}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: "var(--ink-faint)" }}>
                      {entry.reason || "No reason given"} · {timeAgo(entry.created_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => unblock(entry.ip)}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] shrink-0"
                    style={{ background: "var(--mint)", color: "var(--forest)" }}
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </Card>

          <SectionTitle>Top offenders</SectionTitle>
          <Card>
            {offenders.length === 0 ? (
              <EmptyRow>Nothing suspicious in the last 24h.</EmptyRow>
            ) : (
              offenders.map((entry, i) => (
                <div
                  key={entry.ip}
                  className="flex items-center justify-between gap-3 px-3.5 py-3"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium tabular-nums truncate" style={{ color: "var(--ink)" }}>
                      {entry.ip}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: "var(--ink-faint)" }}>
                      {entry.count} requests{entry.blocked ? `, ${entry.blocked} already blocked` : ""}
                      {entry.country ? ` · ${entry.country}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => block(entry.ip)}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] shrink-0"
                    style={{ background: "#fdf1f0", color: RED }}
                  >
                    Block
                  </button>
                </div>
              ))
            )}
          </Card>

          <button
            type="button"
            onClick={reload}
            className="mt-4 w-full flex items-center justify-center gap-1.5 text-[12px] font-medium py-2.5 rounded-[10px]"
            style={{ color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            <Icon name="refresh" size={14} />
            Refresh
          </button>
        </>
      )}
    </div>
  );
}

// ── Users ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { users, clerkWarning, searchInput, setSearchInput, error, busy, loading, action } = useAdminUsers();

  async function toggleLockout(user) {
    const isBanned = Boolean(user.bannedUntil);
    if (!isBanned) {
      const confirmed = await confirmAction(
        `Lock ${user.email || "this user"} out immediately? This revokes their sessions and blocks sign-in.`,
        { title: "Lock down user", danger: true },
      );
      if (!confirmed) return;
    }
    await action(user.id, isBanned ? "unban" : "ban");
    toast.success(isBanned ? "User unlocked." : "User locked out.");
  }

  return (
    <div>
      <SectionTitle>Users</SectionTitle>
      <div className="relative mb-3">
        <Icon
          name="search"
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--ink-faint)" }}
        />
        <input
          type="text"
          inputMode="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full text-[13px] rounded-[10px] pl-9 pr-3 py-2.5"
          style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
        />
      </div>

      <ErrorNotice message={error} />
      {clerkWarning && (
        <div
          className="text-[12px] rounded-[10px] px-3 py-2.5 mb-3"
          style={{ background: "#fdf5e9", color: AMBER, border: "1px solid #f2e3c2" }}
        >
          {clerkWarning}
        </div>
      )}

      {loading ? (
        <EmptyRow>Loading…</EmptyRow>
      ) : (
        <Card>
          {users.length === 0 ? (
            <EmptyRow>No users match.</EmptyRow>
          ) : (
            users.slice(0, 50).map((user, i) => {
              const banned = Boolean(user.bannedUntil);
              const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-3"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                      {user.email || name || user.id}
                    </div>
                    <div className="text-[11px] truncate flex items-center gap-1.5" style={{ color: "var(--ink-faint)" }}>
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: banned ? RED : GREEN }}
                      />
                      {banned ? "Locked out" : "Active"} · {name || user.username || "—"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleLockout(user)}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] shrink-0"
                    style={{
                      background: banned ? "var(--mint)" : "#fdf1f0",
                      color: banned ? "var(--forest)" : RED,
                    }}
                  >
                    {banned ? "Unlock" : "Lock out"}
                  </button>
                </div>
              );
            })
          )}
        </Card>
      )}
      {users.length > 50 && (
        <p className="text-[11px] text-center mt-2" style={{ color: "var(--ink-faint)" }}>
          Showing first 50 - narrow your search for more.
        </p>
      )}
    </div>
  );
}
