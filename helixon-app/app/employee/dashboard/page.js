"use client";
// app/employee/dashboard/page.js
// The employee "Today" page: what's due, what's on, who to call back, and
// how your goals are going, in one place. Lower-privilege than the admin
// console - personal to-dos plus read-only summaries of the shared
// calendar, goals, cold-call log and platform stats. No access to admin
// controls, security, traffic or agency management.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EmployeeShell from "../_shared/EmployeeShell";
import TeamPresencePanel from "../_shared/TeamPresencePanel";
import { useHeartbeat } from "../_shared/useHeartbeat";
import { Toaster, useToasts } from "../_shared/Toaster";
import { FullPageSpinner, Kpi } from "../_shared/ui";
import OnboardingPanel from "./onboarding-panel";
import TeamTasksPanel from "./team-tasks-panel";
import MyTasksPanel from "./my-tasks-panel";
import { AgendaCard, CallsCard, GoalsCard, PlatformCard } from "./day-cards";
import {
  addDays,
  completedSince,
  dayKey,
  eventsOnDay,
  followUps,
  fromDayKey,
  groupTasks,
  myOpenGoals,
  startOfWeekKey,
} from "@/lib/employee-day";

// Follow-ups are read from the calls you've logged in this window.
const CALL_HISTORY_DAYS = 120;
// Refetch when the tab regains focus, but not more often than this.
const REFRESH_ON_FOCUS_MS = 60_000;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameOf(name) {
  return name ? String(name).trim().split(/\s+/)[0] : "";
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) throw Object.assign(new Error("Not signed in"), { status: 401 });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `Couldn't load ${url}`);
  return data;
}

// Consumed on the first render after login (the login page sets it); the
// effect below clears it so a reload doesn't greet you twice.
function readJustLoggedIn() {
  try {
    return typeof window !== "undefined" && !!sessionStorage.getItem("employee_just_logged_in");
  } catch {
    return false;
  }
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const [employee, setEmployee] = useState(null);
  const [checking, setChecking] = useState(true);
  const [justLoggedIn] = useState(readJustLoggedIn);

  const [todos, setTodos] = useState([]);
  const [todosLoaded, setTodosLoaded] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [goals, setGoals] = useState([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [calls, setCalls] = useState([]);
  const [callStats, setCallStats] = useState(null);
  const [callsLoaded, setCallsLoaded] = useState(false);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [taskView, setTaskView] = useState("mine");

  const { toasts, notify, dismiss } = useToasts();
  const quickAddRef = useRef(null);
  const lastLoad = useRef(0);

  useHeartbeat(!checking);

  const todayKey = dayKey();

  // ── Session ──────────────────────────────────────────────────────────────
  useEffect(() => {
    getJson("/api/employee/me")
      .then((d) => setEmployee(d.employee))
      .catch(() => router.replace("/employee/login"))
      .finally(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    if (!justLoggedIn) return;
    try { sessionStorage.removeItem("employee_just_logged_in"); } catch { /* ignore */ }
  }, [justLoggedIn]);

  // ── Data ────────────────────────────────────────────────────────────────
  // Each source loads on its own so one slow or failing API doesn't hold
  // up (or blank) the rest of the page.
  const loadTodos = useCallback(() =>
    getJson("/api/employee/todos").then((d) => setTodos(d.todos || [])).finally(() => setTodosLoaded(true)), []);

  const loadAll = useCallback(async () => {
    lastLoad.current = Date.now();
    const today = dayKey();
    const from = fromDayKey(today).toISOString();
    const to = fromDayKey(addDays(today, 8)).toISOString();
    const callsFrom = fromDayKey(addDays(today, -CALL_HISTORY_DAYS)).toISOString();

    const results = await Promise.allSettled([
      loadTodos(),
      getJson(`/api/employee/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .then((d) => setEvents(d.events || []))
        .finally(() => setEventsLoaded(true)),
      getJson("/api/employee/goals").then((d) => setGoals(d.goals || [])).finally(() => setGoalsLoaded(true)),
      getJson(`/api/employee/cold-calls?mine=1&stats=1&from=${encodeURIComponent(callsFrom)}`)
        .then((d) => { setCalls(d.calls || []); setCallStats(d.stats || null); })
        .finally(() => setCallsLoaded(true)),
      getJson("/api/employee/stats").then((d) => setStats(d.stats || null)),
    ]);
    if (results.some((r) => r.status === "rejected" && r.reason?.status === 401)) {
      router.replace("/employee/login");
      return;
    }
    setLoadError(results.some((r) => r.status === "rejected"));
  }, [loadTodos, router]);

  useEffect(() => {
    if (checking) return undefined;
    let cancelled = false;
    // Kicked off from a timer so every state update lands in a callback,
    // after the first paint of the page frame.
    const first = setTimeout(() => {
      loadAll().catch(() => { if (!cancelled) setLoadError(true); });
    }, 0);
    function onFocus() {
      if (Date.now() - lastLoad.current > REFRESH_ON_FOCUS_MS) loadAll();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearTimeout(first);
      window.removeEventListener("focus", onFocus);
    };
  }, [checking, loadAll]);

  async function refresh() {
    setRefreshing(true);
    try { await loadAll(); } finally { setRefreshing(false); }
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  const groups = useMemo(() => groupTasks(todos, todayKey), [todos, todayKey]);
  const openCount = todos.filter((t) => !t.done).length;
  const doneThisWeek = useMemo(() => completedSince(todos, startOfWeekKey(todayKey)), [todos, todayKey]);
  const todaysEvents = useMemo(() => eventsOnDay(events, todayKey), [events, todayKey]);
  const follow = useMemo(() => (employee ? followUps(calls, employee.id, todayKey) : { due: [], upcoming: [] }), [calls, employee, todayKey]);
  const goalsMine = useMemo(() => (employee ? myOpenGoals(goals, employee.id) : []), [goals, employee]);
  const myCallStats = callStats?.byEmployee?.find((r) => r.employeeId === employee?.id);

  if (checking) return <FullPageSpinner />;

  const name = firstNameOf(employee?.fullName);
  const dateLine = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const summary = [];
  if (todosLoaded) {
    if (groups.overdue.length) summary.push(`${plural(groups.overdue.length, "task")} overdue`);
    if (groups.today.length) summary.push(`${plural(groups.today.length, "task")} due today`);
  }
  if (eventsLoaded && todaysEvents.length) summary.push(plural(todaysEvents.length, "event"));
  if (callsLoaded && follow.due.length) summary.push(plural(follow.due.length, "follow-up call"));
  const allLoaded = todosLoaded && eventsLoaded && callsLoaded;
  const summaryText = summary.length
    ? `${summary.join(" · ")}.`
    : allLoaded ? "Nothing urgent today. A good day to get ahead." : "Getting your day together…";

  const blocked = goalsMine.filter((g) => g.status === "blocked").length;

  return (
    <EmployeeShell employee={employee}>
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header
          className="relative overflow-hidden rounded-[18px] p-6 sm:p-7 mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5"
          style={{ background: "linear-gradient(135deg, #ffffff 0%, rgba(var(--forest-rgb),0.07) 100%)", border: "1px solid var(--border)" }}
        >
          <div
            className="ambient-glow absolute -top-1/2 -right-16 w-[320px] h-[320px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(var(--forest-rgb),0.12) 0%, transparent 70%)" }}
            aria-hidden="true"
          />
          <div className="relative min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: "var(--forest)" }}>
              {justLoggedIn ? "Welcome back" : dateLine}
            </p>
            <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight leading-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              {greeting()}{name ? `, ${name}` : ""}
            </h1>
            <p className="text-[15px] mt-1.5" style={{ color: "var(--ink-soft)" }} aria-live="polite">{summaryText}</p>
            <div className="flex items-center gap-3 mt-2 min-h-[20px]">
              {loadError ? (
                <p className="text-xs" style={{ color: "#a83226" }} role="alert">
                  Some of today&rsquo;s information didn&rsquo;t load.{" "}
                  <button type="button" onClick={refresh} className="underline font-semibold">Try again</button>
                </p>
              ) : (
                <button type="button" onClick={refresh} disabled={refreshing} className="text-xs hover:underline disabled:no-underline" style={{ color: "var(--ink-faint)" }}>
                  {refreshing ? "Refreshing…" : "Refresh ↺"}
                </button>
              )}
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { setTaskView("mine"); setTimeout(() => quickAddRef.current?.focus(), 0); }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-full text-white"
              style={{ background: "var(--forest)" }}
            >
              <span aria-hidden="true">+</span> New task
            </button>
            <Link href="/employee/cold-calls" className="inline-flex items-center text-sm font-semibold px-4 py-2.5 rounded-full bg-white" style={{ border: "1px solid var(--border)", color: "var(--ink)" }}>
              Log a call
            </Link>
            <Link href="/employee/calendar" className="inline-flex items-center text-sm font-semibold px-4 py-2.5 rounded-full bg-white" style={{ border: "1px solid var(--border)", color: "var(--ink)" }}>
              Add an event
            </Link>
          </div>
        </header>

        {/* ── KPIs ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Kpi
            index={0}
            label="Due today"
            value={todosLoaded ? groups.today.length + groups.overdue.length : null}
            tone={groups.overdue.length ? "#c0392b" : undefined}
            sub={todosLoaded ? (groups.overdue.length ? `${groups.overdue.length} overdue` : "Nothing overdue") : " "}
          />
          <Kpi index={1} label="Open tasks" value={todosLoaded ? openCount : null} sub={todosLoaded ? `${doneThisWeek} done this week` : " "} />
          <Kpi
            index={2}
            label="Calls today"
            value={callsLoaded ? myCallStats?.today ?? 0 : null}
            sub={callsLoaded ? `${myCallStats?.thisWeek ?? 0} this week` : " "}
            href="/employee/cold-calls"
          />
          <Kpi
            index={3}
            label="Your goals"
            value={goalsLoaded ? goalsMine.length : null}
            tone={blocked ? "#c0392b" : undefined}
            sub={goalsLoaded ? (blocked ? `${blocked} blocked` : "None blocked") : " "}
            href="/employee/goals"
          />
        </div>

        {/* ── Main + side columns ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <div className="space-y-4 min-w-0">
            <OnboardingPanel />

            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>Tasks</h2>
              <div className="flex rounded-[10px] p-0.5 gap-0.5 bg-white" style={{ border: "1px solid var(--border)" }} role="group" aria-label="Which tasks">
                {[
                  { key: "mine", label: "Mine" },
                  { key: "team", label: "Team" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTaskView(t.key)}
                    aria-pressed={taskView === t.key}
                    className="text-sm px-3.5 py-1.5 rounded-[8px] font-medium transition"
                    style={taskView === t.key ? { background: "var(--forest)", color: "white" } : { color: "var(--ink-soft)" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {taskView === "mine" ? (
              <MyTasksPanel
                todos={todos}
                setTodos={setTodos}
                loaded={todosLoaded}
                reload={loadTodos}
                notify={notify}
                quickAddRef={quickAddRef}
              />
            ) : (
              <TeamTasksPanel currentEmployeeId={employee?.id} notify={notify} />
            )}
          </div>

          <aside className="space-y-4 min-w-0" aria-label="Your day">
            <AgendaCard events={events} loaded={eventsLoaded} todayKey={todayKey} />
            <CallsCard stats={callStats} follow={follow} loaded={callsLoaded} employeeId={employee?.id} todayKey={todayKey} />
            <GoalsCard goals={goalsMine} loaded={goalsLoaded} todayKey={todayKey} />
            <TeamPresencePanel currentEmployeeId={employee?.id} />
            <PlatformCard stats={stats} />
          </aside>
        </div>

        <p className="text-xs text-center mt-10" style={{ color: "var(--ink-faint)" }}>
          Shortcuts: <kbd className="font-semibold">N</kbd> new task · <kbd className="font-semibold">/</kbd> search tasks
        </p>
      </div>
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </EmployeeShell>
  );
}
