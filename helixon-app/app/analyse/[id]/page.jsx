"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getCandidateById, STAGE_LABELS } from "@/lib/mock-data";

async function fetchAnalysis(id) {
  return new Promise((resolve) => setTimeout(() => resolve(getCandidateById(id)), 150));
}

function scoreColor(score) {
  if (score === null || score === undefined) return "#8aaa9a";
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return "#c9922e";
  return "#c0392b";
}

function InfoRow({ label, value, href }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#8aaa9a" }}>{label}</p>
      {href ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="text-xs font-medium hover:underline" style={{ color: "var(--forest)" }}>{value || "—"}</a>
      ) : (
        <p className="text-xs font-medium" style={{ color: "#13201b" }}>{value || "—"}</p>
      )}
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AnalysisDetailPage() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let cancelled = false;
    fetchAnalysis(id).then((a) => { if (!cancelled) setAnalysis(a); });
    return () => { cancelled = true; };
  }, [id]);

  if (analysis === undefined) {
    return (
      <main className="min-h-screen" style={{ background: "var(--mist)" }}>
        <DashboardNav />
        <p className="max-w-[900px] mx-auto px-6 pt-10 text-xs" style={{ color: "#5a7a6a" }}>Loading…</p>
      </main>
    );
  }

  if (analysis === null) {
    return (
      <main className="min-h-screen" style={{ background: "var(--mist)" }}>
        <DashboardNav />
        <div className="max-w-[900px] mx-auto px-6 pt-10">
          <p className="text-sm font-semibold" style={{ color: "#13201b" }}>Analysis not found</p>
          <Link href="/dashboard/pipeline" className="text-xs font-semibold" style={{ color: "var(--forest)" }}>← Back to pipeline</Link>
        </div>
      </main>
    );
  }

  // The candidate fields live directly on the record returned by
  // getCandidateById (no nested `.candidate` object in the mock data).
  const c = analysis;

  // getCandidateById doesn't compute a per-category score breakdown —
  // only a single overall `score`. Guarded below so the section simply
  // shows the headline score with no bars, rather than crashing.
  const scoreBreakdown = null;

  // Failed candidates don't have a dedicated `errorMessage` field; the
  // detail (if any) is recorded in the activity log instead.
  const failureNote =
    analysis.status === "failed"
      ? analysis.activity?.find((a) => a.meta?.note)?.meta?.note ?? "No further details available."
      : null;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />

      <section className="max-w-[900px] mx-auto px-6 pt-8 pb-24">
        <Link href="/dashboard/pipeline" className="text-xs font-semibold" style={{ color: "var(--forest)" }}>← Back to pipeline</Link>

        <div className="flex items-start justify-between gap-4 mt-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>{c.fullName}</h1>
            <p className="text-xs mt-1" style={{ color: "#5a7a6a" }}>{c.currentTitle}{c.currentCompany ? ` · ${c.currentCompany}` : ""}</p>
          </div>
          {analysis.stage && (
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ background: "var(--mint)", color: "var(--forest)" }}>{STAGE_LABELS[analysis.stage]}</span>
          )}
        </div>

        {analysis.status === "failed" ? (
          <div className="rounded-[10px] p-4" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#b91c1c" }}>Analysis failed</p>
            <p className="text-xs" style={{ color: "#b91c1c" }}>{failureNote}</p>
          </div>
        ) : (
          <>
            <div className="rounded-[14px] p-5 mb-5" style={{ background: "white", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#8aaa9a" }}>Overall match</span>
                <span className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: scoreColor(analysis.score) }}>{analysis.score ?? "—"}</span>
              </div>
              {scoreBreakdown && (
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(scoreBreakdown).map(([k, v]) => (
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
              )}
            </div>

            <div className="rounded-[14px] p-5 mb-5" style={{ background: "white", border: "1px solid var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#8aaa9a" }}>Candidate details</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <InfoRow label="Email" value={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
                <InfoRow label="Phone" value={c.phone} href={c.phone ? `tel:${c.phone}` : undefined} />
                <InfoRow label="Location" value={c.location} />
                <InfoRow label="Experience" value={c.yearsExperience != null ? `${c.yearsExperience} yrs` : "—"} />
                <InfoRow label="Job applied for" value={c.jobTitle} />
                <InfoRow label="Recruiter" value={analysis.recruiterName} />
                <InfoRow label="LinkedIn" value={c.linkedin ? "View profile" : "—"} href={c.linkedin ? `https://${c.linkedin}` : undefined} />
              </div>
            </div>

            {c.skills?.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Skills detected</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.skills.map((s) => <span key={s} className="text-[11px] px-2 py-1 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>{s}</span>)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
              {analysis.strengths?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Standout factors</p>
                  <ul className="space-y-1">
                    {analysis.strengths.map((f, i) => <li key={i} className="text-xs flex gap-1.5" style={{ color: "#13201b" }}><span style={{ color: "var(--forest)" }}>✓</span>{f}</li>)}
                  </ul>
                </div>
              )}
              {analysis.concerns?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Possible gaps</p>
                  <ul className="space-y-1">
                    {analysis.concerns.map((g, i) => <li key={i} className="text-xs flex gap-1.5" style={{ color: "#5a7a6a" }}><span style={{ color: "#c9922e" }}>!</span>{g}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {analysis.job && (
              <div className="rounded-[10px] p-4 mb-5" style={{ background: "white", border: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#8aaa9a" }}>Matched against</p>
                <p className="text-sm font-semibold" style={{ color: "#13201b" }}>{analysis.job.title} · {analysis.job.company}</p>
                <p className="text-xs" style={{ color: "#5a7a6a" }}>{analysis.job.seniority} · {analysis.job.location}</p>
              </div>
            )}

            {c.resume && (
              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Resume on file</p>
                <p className="text-xs font-medium" style={{ color: "#13201b" }}>{c.resume.name} · {c.resume.sizeKb} KB · uploaded {formatDate(c.resume.uploadedAt)}</p>
              </div>
            )}
          </>
        )}

        <p className="text-[10px] mt-6" style={{ color: "#8aaa9a" }}>Analysis ID: {analysis.id} · {formatDate(analysis.createdAt)}</p>
      </section>
    </main>
  );
}
