"use client";
// app/employee/dashboard/onboarding-panel.js
// Onboarding checklist - full detail while incomplete, collapses to a
// one-line "Onboarding complete" once every step is checked off, so it
// doesn't take up space for people who finished it months ago.

import { useEffect, useState } from "react";

export default function OnboardingPanel() {
  const [tasks, setTasks] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [expanded, setExpanded] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/employee/onboarding");
      const data = await res.json();
      if (data.ok) {
        setTasks(data.tasks);
        setCompletedCount(data.completedCount);
        setTotalCount(data.totalCount);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(taskKey, completed) {
    setBusyKey(taskKey);
    setTasks((prev) => prev.map((t) => (t.key === taskKey ? { ...t, completed } : t)));
    try {
      const res = await fetch("/api/employee/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskKey, completed }),
      });
      const data = await res.json();
      if (data.ok) {
        setTasks(data.tasks);
        setCompletedCount(data.completedCount);
        setTotalCount(data.totalCount);
      }
    } finally {
      setBusyKey(null);
    }
  }

  if (loading || totalCount === 0) return null;

  const done = completedCount === totalCount;
  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  if (done && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        type="button"
        className="w-full flex items-center justify-between rounded-[14px] px-4 py-3 text-left transition hover:opacity-90"
        style={{ background: "var(--mint)", border: "1px solid var(--border)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--forest)" }}>
          ✓ Onboarding complete: all {totalCount} steps done
        </span>
        <span className="text-xs" style={{ color: "var(--forest)" }}>View</span>
      </button>
    );
  }

  return (
    <section className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }} aria-labelledby="onboarding-title">
      <div className="px-5 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: "var(--border-soft)" }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-0.5" style={{ color: "var(--forest)" }}>Getting started</p>
          <h2 id="onboarding-title" className="text-[15px] font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Onboarding
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{completedCount} of {totalCount} steps complete</p>
        </div>
        {done && (
          <button type="button" onClick={() => setExpanded(false)} className="text-xs" style={{ color: "var(--ink-soft)" }}>
            Collapse
          </button>
        )}
      </div>

      <div className="px-5 pt-4">
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--mist)" }}>
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--forest)" }} />
        </div>
      </div>

      <ul className="divide-y divide-[var(--border-soft)]">
        {tasks.map((task) => (
          <li key={task.key} className="px-5 py-3.5 flex items-start gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={!!task.completed}
              onClick={() => toggle(task.key, !task.completed)}
              disabled={busyKey === task.key}
              className="mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition disabled:opacity-50"
              style={task.completed ? { background: "var(--forest)", border: "2px solid var(--forest)" } : { border: "2px solid var(--border)" }}
              aria-label={task.label}
            >
              {task.completed && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${task.completed ? "line-through" : ""}`} style={{ color: task.completed ? "var(--ink-faint)" : "var(--ink)" }}>
                {task.label}
              </p>
              {task.description && (
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{task.description}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
