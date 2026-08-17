"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════
// Agency dashboard — lands here after email verification. Same nav/footer/
// tokens as the landing page, but authenticated (no "Try now" CTA).
//
// Data model note: `fetchDashboardData()` is still a stub. Swap it for a
// real call to GET /api/agency/me once that route exists — the shape below
// (recentAnalyses[].candidate / .job / .scoreBreakdown / .status) is what
// that route should return so this page needs zero changes when you wire
// it up for real.
// ═══════════════════════════════════════════════════════════════════════════

async function fetchDashboardData() {
  // TODO: replace with a real call, e.g.:
  // const res = await fetch("/api/agency/me");
  // if (!res.ok) throw new Error("Failed to load dashboard");
  // return res.json();
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          agencyName: "Your Agency",
          email: "you@example.com",
          plan: "trial",
          analysesUsed: 4,
          analysesLimit: 10,
          recentAnalyses: [
            {
              id: "an_01j9k2",
              status: "completed", // completed | processing | failed
              createdAt: "2026-08-15T10:22:00Z",
              score: 87,
              scoreBreakdown: {
                skillsMatch: 92,
                experienceMatch: 84,
                educationMatch: 78,
                seniorityFit: 90,
              },
              standoutFactors: [
                "5 yrs production Kubernetes at scale",
                "Led a 6-person platform team",
                "Direct experience with the exact stack (Go, Terraform, AWS)",
              ],
              gaps: ["No formal AWS certification", "Limited frontend exposure"],
              job: {
                title: "Senior Platform Engineer",
                company: "Acme Robotics",
                seniority: "Senior",
                location: "Remote (UK)",
              },
              candidate: {
                name: "Priya Nandakumar",
                email: "priya.n@example.com",
                phone: "+44 7700 900123",
                location: "Manchester, UK",
                currentTitle: "Platform Engineer II",
                currentEmployer: "Vertex Systems",
                yearsExperience: 6,
                noticePeriod: "4 weeks",
                salaryExpectation: "£75k–£85k",
                linkedinUrl: "https://linkedin.com/in/example",
                resumeUrl: "/files/resume_01j9k2.pdf",
                skills: ["Kubernetes", "Go", "Terraform", "AWS", "PostgreSQL", "CI/CD"],
                source: "Direct upload",
              },
              draftEmail:
                "Hi Priya, your background in platform engineering at Vertex looks like a strong match for our Senior Platform Engineer role at Acme Robotics...",
              recruiterNotes: "",
            },
            {
              id: "an_01j9k1",
              status: "completed",
              createdAt: "2026-08-14T15:03:00Z",
              score: 62,
              scoreBreakdown: {
                skillsMatch: 58,
                experienceMatch: 65,
                educationMatch: 70,
                seniorityFit: 55,
              },
              standoutFactors: ["Strong communication in cover letter", "Relevant internship experience"],
              gaps: ["Only 1.5 yrs experience vs 4+ required", "No cloud infra experience listed"],
              job: {
                title: "Backend Engineer",
                company: "Northwind Logistics",
                seniority: "Mid",
                location: "Leeds, UK (Hybrid)",
              },
              candidate: {
                name: "Tom Ashworth",
                email: "tom.ashworth@example.com",
                phone: "+44 7700 900456",
                location: "Leeds, UK",
                currentTitle: "Junior Software Engineer",
                currentEmployer: "Bramwell Digital",
                yearsExperience: 1.5,
                noticePeriod: "1 month",
                salaryExpectation: "£38k–£42k",
                linkedinUrl: "https://linkedin.com/in/example2",
                resumeUrl: "/files/resume_01j9k1.pdf",
                skills: ["Node.js", "Express", "MongoDB", "REST APIs"],
                source: "Email intake",
              },
              draftEmail:
                "Hi Tom, thanks for applying to the Backend Engineer role at Northwind Logistics...",
              recruiterNotes: "Keep warm for junior roles opening next quarter.",
            },
            {
              id: "an_01j9k0",
              status: "failed",
              createdAt: "2026-08-13T09:47:00Z",
              score: null,
              scoreBreakdown: null,
              standoutFactors: [],
              gaps: [],
              job: { title: "DevOps Engineer", company: "Acme Robotics", seniority: "Mid", location: "Remote" },
              candidate: {
                name: "Unreadable file",
                email: "",
                phone: "",
                location: "",
                currentTitle: "",
                currentEmployer: "",
                yearsExperience: null,
                noticePeriod: "",
                salaryExpectation: "",
                linkedinUrl: "",
                resumeUrl: "/files/resume_01j9k0.pdf",
                skills: [],
                source: "Direct upload",
              },
              draftEmail: "",
              recruiterNotes: "",
              errorMessage: "Could not parse resume — password-protected PDF",
            },
          ],
        }),
      300
    )
  );
}

function DashboardNav({ email }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
        <Link href="/analyse" className="flex items-center gap-3 group" aria-label="Helixon home">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
            <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "#8aaa9a" }}>Screen candidates in seconds</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1 text-xs font-medium" style={{ color: "#5a7a6a" }}>
          <Link href="/dashboard" className="px-3 py-1.5 rounded-[8px]" style={{ background: "var(--mint)", color: "var(--forest)", fontWeight: 600 }}>Dashboard</Link>
          <Link href="/analyse" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>New analysis</Link>
          <Link href="/contact" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Contact</Link>
        </div>

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-colors"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: "var(--forest)" }}>
              {(email || "?").charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] font-medium hidden sm:block" style={{ color: "#13201b" }}>{email}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-44 rounded-[12px] p-1.5 bg-white" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 24px -12px rgba(19,32,27,0.25)" }}>
              <Link href="/account" className="block text-xs px-3 py-2 rounded-[8px]" style={{ color: "#13201b" }} onClick={() => setMenuOpen(false)}>Account settings</Link>
              <Link href="/billing" className="block text-xs px-3 py-2 rounded-[8px]" style={{ color: "#13201b" }} onClick={() => setMenuOpen(false)}>Billing</Link>
              <a href="/api/auth/logout" className="block text-xs px-3 py-2 rounded-[8px]" style={{ color: "#b91c1c" }}>Log out</a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-[14px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>{label}</p>
      <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#13201b" }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: "#5a7a6a" }}>{sub}</p>}
    </div>
  );
}

function EmptyAnalyses() {
  return (
    <div className="rounded-[16px] p-10 text-center" style={{ background: "white", border: "1px dashed var(--border)" }}>
      <div className="w-11 h-11 rounded-[12px] flex items-center justify-center mx-auto mb-4" style={{ background: "var(--mint)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>No analyses yet</h3>
      <p className="text-xs max-w-xs mx-auto mb-5" style={{ color: "#5a7a6a" }}>
        Upload your first CV against a job spec to see a match score, standout factors, and a ready-to-send email.
      </p>
      <Link
        href="/analyse"
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-[10px] text-white"
        style={{ background: "var(--forest)" }}
      >
        Run your first analysis
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </Link>
    </div>
  );
}

function scoreColor(score) {
  if (score === null || score === undefined) return "#8aaa9a";
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return "#c9922e";
  return "#c0392b";
}

function statusBadge(status) {
  const map = {
    completed: { bg: "#eef7f1", fg: "var(--forest)", label: "Completed" },
    processing: { bg: "#fff8e6", fg: "#c9922e", label: "Processing" },
    failed: { bg: "#fef2f2", fg: "#b91c1c", label: "Failed" },
  };
  const s = map[status] || map.completed;
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Filter / sort controls ──────────────────────────────────────────────────
function AnalysesToolbar({ query, setQuery, statusFilter, setStatusFilter, sortBy, setSortBy }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search candidate, role, or company…"
        className="flex-1 text-xs px-3 py-2.5 rounded-[10px] outline-none"
        style={{ border: "1px solid var(--border)", color: "#13201b" }}
      />
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="text-xs px-3 py-2.5 rounded-[10px]"
        style={{ border: "1px solid var(--border)", color: "#13201b", background: "white" }}
      >
        <option value="all">All statuses</option>
        <option value="completed">Completed</option>
        <option value="processing">Processing</option>
        <option value="failed">Failed</option>
      </select>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        className="text-xs px-3 py-2.5 rounded-[10px]"
        style={{ border: "1px solid var(--border)", color: "#13201b", background: "white" }}
      >
        <option value="date_desc">Newest first</option>
        <option value="date_asc">Oldest first</option>
        <option value="score_desc">Highest score</option>
        <option value="score_asc">Lowest score</option>
      </select>
    </div>
  );
}

// ── Candidate detail drawer ────────────────────────────────────────────────
function CandidateDrawer({ analysis, onClose }) {
  if (!analysis) return null;
  const c = analysis.candidate;
  const b = analysis.scoreBreakdown;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full sm:w-[480px] h-full bg-white overflow-y-auto p-6" style={{ borderLeft: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "#13201b" }}>{c.name}</h2>
            <p className="text-xs" style={{ color: "#5a7a6a" }}>{c.currentTitle}{c.currentEmployer ? ` · ${c.currentEmployer}` : ""}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xs px-2 py-1 rounded-[6px]" style={{ color: "#5a7a6a" }}>✕</button>
        </div>

        {analysis.status === "failed" ? (
          <div className="rounded-[10px] p-4" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#b91c1c" }}>Analysis failed</p>
            <p className="text-xs" style={{ color: "#b91c1c" }}>{analysis.errorMessage}</p>
          </div>
        ) : (
          <>
            {/* Match score */}
            <div className="rounded-[14px] p-4 mb-5" style={{ background: "var(--mist)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#8aaa9a" }}>Overall match</span>
                <span className="text-xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: scoreColor(analysis.score) }}>{analysis.score}</span>
              </div>
              <div className="space-y-2">
                {b && Object.entries(b).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between text-[10px] mb-1" style={{ color: "#5a7a6a" }}>
                      <span className="capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                      <span>{v}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div className="h-full rounded-full" style={{ width: `${v}%`, background: scoreColor(v) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact / logistics */}
            <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
              <InfoRow label="Email" value={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
              <InfoRow label="Phone" value={c.phone} href={c.phone ? `tel:${c.phone}` : undefined} />
              <InfoRow label="Location" value={c.location} />
              <InfoRow label="Experience" value={c.yearsExperience != null ? `${c.yearsExperience} yrs` : "—"} />
              <InfoRow label="Notice period" value={c.noticePeriod} />
              <InfoRow label="Salary expectation" value={c.salaryExpectation} />
              <InfoRow label="Source" value={c.source} />
              <InfoRow label="LinkedIn" value={c.linkedinUrl ? "View profile" : "—"} href={c.linkedinUrl} />
            </div>

            {/* Skills */}
            {c.skills?.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Skills detected</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.skills.map((s) => (
                    <span key={s} className="text-[11px] px-2 py-1 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Standout factors / gaps */}
            {analysis.standoutFactors?.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Standout factors</p>
                <ul className="space-y-1">
                  {analysis.standoutFactors.map((f, i) => (
                    <li key={i} className="text-xs flex gap-1.5" style={{ color: "#13201b" }}>
                      <span style={{ color: "var(--forest)" }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.gaps?.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Possible gaps</p>
                <ul className="space-y-1">
                  {analysis.gaps.map((g, i) => (
                    <li key={i} className="text-xs flex gap-1.5" style={{ color: "#5a7a6a" }}>
                      <span style={{ color: "#c9922e" }}>!</span>{g}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Job matched against */}
            <div className="rounded-[10px] p-3 mb-5" style={{ background: "var(--mist)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#8aaa9a" }}>Matched against</p>
              <p className="text-xs font-semibold" style={{ color: "#13201b" }}>{analysis.job.title} · {analysis.job.company}</p>
              <p className="text-[11px]" style={{ color: "#5a7a6a" }}>{analysis.job.seniority} · {analysis.job.location}</p>
            </div>

            {/* Draft outreach */}
            {analysis.draftEmail && (
              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Draft outreach email</p>
                <textarea
                  readOnly
                  value={analysis.draftEmail}
                  rows={5}
                  className="w-full text-xs p-3 rounded-[10px] resize-none"
                  style={{ border: "1px solid var(--border)", color: "#13201b", background: "var(--mist)" }}
                />
              </div>
            )}

            <a href={c.resumeUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-semibold px-4 py-2.5 rounded-[10px] text-white" style={{ background: "var(--forest)" }}>
              View original resume
            </a>
          </>
        )}

        <p className="text-[10px] mt-6" style={{ color: "#8aaa9a" }}>Analysis ID: {analysis.id} · {formatDate(analysis.createdAt)}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value, href }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#8aaa9a" }}>{label}</p>
      {href ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="text-xs font-medium hover:underline" style={{ color: "var(--forest)" }}>
          {value || "—"}
        </a>
      ) : (
        <p className="text-xs font-medium" style={{ color: "#13201b" }}>{value || "—"}</p>
      )}
    </div>
  );
}

function AnalysesList({ items, onSelect }) {
  return (
    <div className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }}>
      {items.map((a, i) => (
        <button
          key={a.id}
          onClick={() => onSelect(a)}
          className="w-full flex items-center gap-4 px-5 py-4 transition-colors text-left"
          style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}
        >
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "var(--mint)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold truncate" style={{ color: "#13201b" }}>{a.candidate.name}</p>
              {statusBadge(a.status)}
            </div>
            <p className="text-[11px] truncate" style={{ color: "#8aaa9a" }}>
              vs {a.job.title} @ {a.job.company} · {formatDate(a.createdAt)}
            </p>
          </div>
          <span className="text-lg font-semibold shrink-0" style={{ fontFamily: "var(--font-mono)", color: scoreColor(a.score) }}>
            {a.score ?? "—"}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function AgencyDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError("Couldn't load your dashboard. Please refresh."); });
    return () => { cancelled = true; };
  }, []);

  const used = data?.analysesUsed ?? 0;
  const limit = data?.analysesLimit ?? 3;
  const remaining = Math.max(limit - used, 0);

  const filteredSorted = useMemo(() => {
    if (!data) return [];
    let items = data.recentAnalyses;

    if (statusFilter !== "all") {
      items = items.filter((a) => a.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      items = items.filter((a) =>
        [a.candidate.name, a.job.title, a.job.company].join(" ").toLowerCase().includes(q)
      );
    }

    const sorted = [...items].sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "score_desc":
          return (b.score ?? -1) - (a.score ?? -1);
        case "score_asc":
          return (a.score ?? 999) - (b.score ?? 999);
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
    return sorted;
  }, [data, query, statusFilter, sortBy]);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav email={data?.email} />

      <section className="max-w-[1100px] mx-auto px-6 pt-12 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>
              {data?.plan === "trial" ? "Free trial" : data?.plan || "\u00A0"}
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              {data ? `Welcome back${data.agencyName ? `, ${data.agencyName}` : ""}` : "Loading your dashboard…"}
            </h1>
          </div>
          <Link
            href="/analyse"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-3 rounded-[10px] text-white shrink-0"
            style={{ background: "var(--forest)", boxShadow: "0 8px 20px -8px rgba(11,110,79,0.5)" }}
          >
            New analysis
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </section>

      {error && (
        <section className="max-w-[1100px] mx-auto px-6 pb-4">
          <div role="alert" className="flex items-start gap-2.5 p-3 rounded-[10px]" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
            <p className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>
          </div>
        </section>
      )}

      <section className="max-w-[1100px] mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Analyses used" value={data ? used : "—"} sub={data ? `of ${limit} on your plan` : undefined} />
          <StatCard label="Remaining" value={data ? remaining : "—"} sub={data?.plan === "trial" ? "on your free trial" : undefined} />
          <StatCard label="Plan" value={data ? (data.plan === "trial" ? "Free" : data.plan) : "—"} sub={data?.plan === "trial" ? "Upgrade anytime" : undefined} />
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "#13201b" }}>Recent analyses</h2>
          {data?.recentAnalyses?.length > 0 && (
            <Link href="/analyse/history" className="text-xs font-semibold" style={{ color: "var(--forest)" }}>View all</Link>
          )}
        </div>

        {data && data.recentAnalyses.length > 0 && (
          <AnalysesToolbar
            query={query} setQuery={setQuery}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            sortBy={sortBy} setSortBy={setSortBy}
          />
        )}

        {!data ? (
          <div className="rounded-[16px] p-10 text-center" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "#5a7a6a" }}>Loading…</p>
          </div>
        ) : data.recentAnalyses.length === 0 ? (
          <EmptyAnalyses />
        ) : filteredSorted.length === 0 ? (
          <div className="rounded-[16px] p-10 text-center" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "#5a7a6a" }}>No analyses match your filters.</p>
          </div>
        ) : (
          <AnalysesList items={filteredSorted} onSelect={setSelected} />
        )}
      </section>

      <CandidateDrawer analysis={selected} onClose={() => setSelected(null)} />

      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px]" style={{ color: "#8aaa9a" }}>© {new Date().getFullYear()} Helixon. Screen candidates in seconds.</span>
          <div className="flex gap-4 text-[11px]" style={{ color: "#8aaa9a" }}>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
