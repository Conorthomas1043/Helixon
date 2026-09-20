"use client";
// app/employee/ops/page.js
// Read-only company snapshot for any employee - broader than the personal
// dashboard's platform stats card, narrower than the admin console (no IPs,
// no revenue, no per-agency detail - see app/api/employee/ops/route.js for
// exactly what's excluded and why).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function BarList({ items, labelKey, countKey }) {
  const max = Math.max(1, ...items.map((i) => i[countKey]));
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item[labelKey]}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span style={{ color: "var(--ink-soft)" }}>{item[labelKey]}</span>
            <span className="font-medium" style={{ color: "var(--ink)" }}>{item[countKey]}</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--mist)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${(item[countKey] / max) * 100}%`, background: "var(--forest)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EmployeeOpsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/employee/ops")
      .then(async (r) => {
        if (r.status === 401) { router.replace("/employee/login"); return null; }
        const b = await r.json();
        if (!r.ok) throw new Error(b.error || "Request failed");
        return b;
      })
      .then((b) => { if (b) setData(b); })
      .catch((e) => setError(e.message))
      .finally(() => setChecking(false));
  }, [router]);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b"
        style={{ borderColor: "var(--border)" }}
        aria-label="Main"
      >
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link href="/employee/dashboard" className="flex items-center gap-3 group" aria-label="Employee dashboard">
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105"
              style={{ background: "var(--forest)" }}
            >
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Helixon
              </span>
              <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Employee portal
              </span>
            </span>
          </Link>

          <Link
            href="/employee/dashboard"
            className="text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:bg-white"
            style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}
          >
            ← My dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            Platform ops
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            A read-only company snapshot - agencies, pipeline volume, and where leads come from.
          </p>
        </div>

        {checking ? (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 rounded-full animate-spin"
              style={{ border: "4px solid var(--border)", borderTopColor: "var(--forest)" }}
            />
          </div>
        ) : error ? (
          <div
            className="rounded-[14px] px-4 py-3 text-sm"
            style={{ background: "#fdf1f0", border: "1px solid #f4d4d2", color: "#e0554f" }}
          >
            {error}
          </div>
        ) : (
          <>
            {/* ── KPI grid ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
              {[
                { label: "Agencies", value: data.kpis.agencies },
                { label: "Candidates screened", value: data.kpis.candidates },
                { label: "Jobs created", value: data.kpis.jobs },
                { label: "Analyses run", value: data.kpis.analyses },
                { label: "Demo leads", value: data.kpis.leads },
              ].map((s) => (
                <div key={s.label} className="rounded-[14px] p-4" style={{ background: "white", border: "1px solid var(--border)" }}>
                  <p className="text-xl font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                    {s.value}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* ── Agencies by plan ────────────────────────────────────── */}
              <div className="rounded-[16px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                  Agencies by plan
                </h2>
                {data.sales.agenciesByPlan.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--ink-faint)" }}>No agencies yet.</p>
                ) : (
                  <BarList items={data.sales.agenciesByPlan} labelKey="plan" countKey="count" />
                )}
              </div>

              {/* ── Lead acquisition channels ───────────────────────────── */}
              <div className="rounded-[16px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                  Demo leads by channel
                </h2>
                {data.seo.channels.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--ink-faint)" }}>No demo requests yet.</p>
                ) : (
                  <BarList items={data.seo.channels} labelKey="channel" countKey="count" />
                )}
              </div>
            </div>

            <p className="text-[11px] mt-8" style={{ color: "var(--ink-faint)" }}>
              Signed in as {data.employee.email || data.employee.display_name || data.employee.username}. This view
              excludes revenue, per-agency detail, IP/security data, and audit logs - see the admin console for those.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
