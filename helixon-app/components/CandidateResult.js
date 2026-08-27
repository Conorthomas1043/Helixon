"use client";
import { useState, useEffect } from "react";

// ============================================================================
// CandidateResult - the full rich result panel, extracted from app/page.js so
// BOTH single-CV and bulk-upload pages render the exact same UI per
// candidate. This is the single source of truth for "what a scored
// candidate looks like" - if you want to change how results are displayed,
// change it here ONCE and both pages update.
//
// v3 - rebuilt as a tabbed, multi-page view instead of one long scroll,
// mirroring the tab pattern already used in app/page.js so both surfaces
// feel like the same product. Sections are grouped into:
//   Overview · Skills · Experience · Evidence · Prep · Contact · Pipeline
// ============================================================================

const PIPELINE_STAGES = ["Screened", "Shortlisted", "Interview", "Offer", "Placed", "Rejected"];
const PIPELINE_STYLES = {
  Screened:    { bg: "var(--mist)", text: "#5a7a6a" },
  Shortlisted: { bg: "#e8f0fb",     text: "#2563eb" },
  Interview:   { bg: "#fef3e8",     text: "#b45309" },
  Offer:       { bg: "#f3ecfb",     text: "#7c3aed" },
  Placed:      { bg: "var(--mint)", text: "var(--forest)" },
  Rejected:    { bg: "#fef2f2",     text: "#dc2626" },
};

function fmtSalary(n) { return n ? "£" + Math.round(n / 1000) + "k" : ""; }
function fmtYearRange(start, end) {
  if (!start && !end) return "";
  if (start && !end) return `${start} – present`;
  if (start === end) return `${start}`;
  return `${start} – ${end}`;
}
function scoreColour(v) {
  if (v >= 80) return "var(--score-strong)";
  if (v >= 60) return "var(--score-mid)";
  return "var(--score-low)";
}

// ── localStorage helpers - reads happen only inside useEffect below, never
// during render, to avoid SSR/client hydration mismatches. ──────────────────
function ls(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, val) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* silent */ }
}

function SectionLabel({ children }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#8aaa9a", fontFamily: "var(--font-mono)" }}>
      {children}
    </h3>
  );
}

function EmptyTabState({ label }) {
  return <p className="text-xs text-center py-10" style={{ color: "#b0c4ba" }}>No {label} data for this candidate.</p>;
}

const TabIcons = {
  overview: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>),
  skills:   (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2.5a2.1 2.1 0 0 1 3 3L6.5 16.5 2 18l1.5-4.5Z" /><path d="m15.5 5.5 3 3" /></svg>),
  experience: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>),
  evidence: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18" /><path d="M5 8l-3 6a3 3 0 0 0 6 0z" /><path d="M19 8l-3 6a3 3 0 0 0 6 0z" /><path d="M5 8h14" /><path d="M9 3h6" /></svg>),
  prep:     (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 1.7-2.3 3.3" /><line x1="12" y1="16.5" x2="12" y2="16.5" strokeWidth="2.5" /></svg>),
  contact:  (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>),
  pipeline: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>),
};

// ── Score ring - signature element, scan-sweeps once on fresh results ───────
function ScoreRing({ score }) {
  const [animated, setAnimated] = useState(false);
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50);
    const t2 = setTimeout(() => setFresh(false), 1800);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [score]);

  const size = 88, stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = animated ? (score / 100) * circ : 0;
  const colour = scoreColour(score);
  const label = score >= 80 ? "Strong match" : score >= 60 ? "Potential" : "Low match";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center rounded-full overflow-hidden" style={{ width: size, height: size }}>
        {fresh && <div className="scan-sweep" aria-hidden="true" />}
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-soft)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={colour} strokeWidth={stroke}
            strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1)" }} />
        </svg>
        <div className="relative text-center">
          <div style={{ color: colour, fontFamily: "var(--font-display)", fontWeight: 700 }} className="text-xl tabular-nums">{score}</div>
          <div className="text-[9px] leading-tight" style={{ color: "#c8d8ce" }}>/ 100</div>
        </div>
      </div>
      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: colour + "18", color: colour }}>{label}</span>
    </div>
  );
}

function RecommendBadge({ recommendation }) {
  const map = {
    "Strong match":    { bg: "var(--mint)", text: "var(--forest)" },
    "Worth reviewing": { bg: "#fef3e8",     text: "#b45309" },
  };
  const style = map[recommendation] || { bg: "#fef2f2", text: "#dc2626" };
  return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold" style={{ background: style.bg, color: style.text }}>{recommendation}</span>;
}

function ConfidenceBadge({ confidence }) {
  if (!confidence || confidence === "High") return null;
  const map = {
    Medium: { bg: "#fef3e8", text: "#b45309", label: "Medium confidence" },
    Low:    { bg: "#fef2f2", text: "#dc2626", label: "Low confidence - CV was sparse or ambiguous" },
  };
  const style = map[confidence] || map.Medium;
  return <span className="inline-flex items-center gap-1 mt-1.5 ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: style.bg, color: style.text }}>⚠ {style.label}</span>;
}

function DuplicateWarning({ duplicateOf }) {
  if (!duplicateOf) return null;
  return (
    <div className="px-6 py-3" style={{ background: "#fef3e8", borderBottom: "1px solid #fbdcb4" }}>
      <p className="text-xs flex items-center gap-2" style={{ color: "#92400e" }}>
        <span>⚠</span> Possible duplicate - same contact details as <span className="font-semibold">{duplicateOf}</span> in this batch
      </p>
    </div>
  );
}

function Field({ icon, label, children }) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 mt-0.5 text-sm" style={{ color: "#c8d8ce" }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] uppercase" style={{ color: "#8aaa9a" }}>{label}</p>
        {children}
      </div>
    </div>
  );
}

// ── Pipeline stage ───────────────────────────────────────────────────────────
function PipelineStage({ candidateId, toast }) {
  const key = `pipeline:${candidateId}`;
  const [stage, setStage] = useState("Screened");
  useEffect(() => { setStage(ls(key, "Screened")); }, [key]);
  function update(s) { setStage(s); lsSet(key, s); toast?.(`Moved to ${s}`, "success"); }

  return (
    <div>
      <SectionLabel>Pipeline stage</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {PIPELINE_STAGES.map((s) => {
          const active = stage === s;
          const style = PIPELINE_STYLES[s];
          return (
            <button key={s} type="button" onClick={() => update(s)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all"
              style={active ? { background: style.bg, color: style.text, borderColor: "transparent" } : { background: "white", color: "#8aaa9a", borderColor: "var(--border)" }}>
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Shortlist button ─────────────────────────────────────────────────────────
function ShortlistButton({ result, candidateId, toast }) {
  const [added, setAdded] = useState(false);
  useEffect(() => { setAdded(ls("shortlist", []).some((c) => c.id === candidateId)); }, [candidateId]);

  function toggle() {
    const list = ls("shortlist", []);
    if (added) {
      lsSet("shortlist", list.filter((c) => c.id !== candidateId));
      toast?.("Removed from shortlist");
    } else {
      list.unshift({ id: candidateId, name: result.name || "Unknown", score: result.match_score, recommendation: result.recommendation, email: result.email || null, addedAt: new Date().toISOString() });
      lsSet("shortlist", list);
      toast?.("Added to shortlist ✓");
    }
    setAdded((v) => !v);
  }

  return (
    <button type="button" onClick={toggle}
      className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-xs font-semibold border transition-colors"
      style={added ? { background: "var(--forest)", color: "white", borderColor: "var(--forest)" } : { background: "white", color: "var(--forest)", borderColor: "var(--forest)" }}
      onMouseEnter={e => { if (!added) e.currentTarget.style.background = "var(--mint)"; }}
      onMouseLeave={e => { if (!added) e.currentTarget.style.background = "white"; }}>
      {added ? "✓ Added to shortlist" : "+ Add to shortlist"}
    </button>
  );
}

// ── Recruiter notes ──────────────────────────────────────────────────────────
function RecruiterNotes({ candidateId, toast }) {
  const key = `notes:${candidateId}`;
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setNote(ls(key, "")); }, [key]);

  function save() {
    lsSet(key, note); setSaved(true); setTimeout(() => setSaved(false), 2000); toast?.("Note saved");
  }
  function onKeyDown(e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save(); }

  return (
    <div>
      <SectionLabel>Recruiter notes</SectionLabel>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={onKeyDown}
        placeholder="Add private notes… (Ctrl+Enter to save)" rows={4}
        className="w-full rounded-xl p-3 text-xs resize-none outline-none mb-2 transition-all"
        style={{ border: "1px solid var(--border)", color: "#13201b", fontFamily: "var(--font-body)" }}
        onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)"}
        onBlur={e => e.target.style.boxShadow = "none"} />
      <div className="flex items-center justify-between">
        <span className="text-[10px] transition-opacity duration-300" style={{ color: "var(--forest)", opacity: saved ? 1 : 0 }}>✓ Saved</span>
        <button type="button" onClick={save} className="text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-colors text-white" style={{ background: "#13201b" }}
          onMouseEnter={e => e.currentTarget.style.background = "#0a120e"} onMouseLeave={e => e.currentTarget.style.background = "#13201b"}>
          Save note
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main exported component
// ============================================================================
export default function CandidateResult({
  result,
  candidateId,
  toast,
  defaultExpanded = true,
  showInteractive = true,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState("overview");
  const noop = () => {};
  const safeToast = toast || noop;

  if (!result) return null;

  const matched = result.matched_skills ?? [];
  const missingRequired = result.missing_required ?? [];
  const missingPreferred = result.missing_preferred ?? [];
  const missingCount = missingRequired.length + missingPreferred.length + (!missingRequired.length && !missingPreferred.length ? (result.missing_skills?.length || 0) : 0);
  const redFlagCount = result.red_flags?.length || 0;
  const hasContact = !result.blind_mode && (result.email || result.phone || result.linkedin || result.github || result.portfolio_url || result.location || result.current_title || result.notice_period || result.willing_to_relocate != null);

  const TABS = [
    { key: "overview",   label: "Overview",   icon: TabIcons.overview },
    { key: "skills",     label: "Skills",     icon: TabIcons.skills, badge: missingCount > 0 ? String(missingCount) : null, tone: "warn" },
    { key: "experience", label: "Experience", icon: TabIcons.experience },
    { key: "evidence",   label: "Evidence",   icon: TabIcons.evidence, badge: redFlagCount > 0 ? String(redFlagCount) : null, tone: "alert" },
    ...(result.interview_questions?.length ? [{ key: "prep", label: "Interview prep", icon: TabIcons.prep }] : []),
    ...(hasContact || result.salary_estimate ? [{ key: "contact", label: "Contact", icon: TabIcons.contact }] : []),
    ...(showInteractive ? [{ key: "pipeline", label: "Pipeline", icon: TabIcons.pipeline }] : []),
  ];

  // ← / → tab navigation, ignored while typing
  useEffect(() => {
    if (!expanded) return;
    function onArrowKey(e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const keys = TABS.map((t) => t.key);
      const idx = keys.indexOf(activeTab);
      if (idx === -1) return;
      e.preventDefault();
      const nextIdx = e.key === "ArrowRight" ? Math.min(idx + 1, keys.length - 1) : Math.max(idx - 1, 0);
      setActiveTab(keys[nextIdx]);
    }
    window.addEventListener("keydown", onArrowKey);
    return () => window.removeEventListener("keydown", onArrowKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, expanded, result]);

  const badgeStyle = (tone) => ({
    warn:  { background: "#fef3e8", color: "#b45309" },
    alert: { background: "#fef2f2", color: "#dc2626" },
  }[tone] || { background: "var(--mint)", color: "var(--forest)" });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }}>

      <DuplicateWarning duplicateOf={result.duplicate_of} />

      {/* Score header - always visible, collapses the whole card if defaultExpanded=false */}
      <div className={`p-6 flex items-center gap-5 ${!defaultExpanded ? "cursor-pointer" : ""}`}
        onClick={!defaultExpanded ? () => setExpanded((v) => !v) : undefined}>
        <ScoreRing score={result.match_score} />
        <div className="flex-1 min-w-0">
          {result.blind_mode && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2" style={{ background: "var(--mist)", color: "#5a7a6a" }}>🙈 Blind mode</span>
          )}
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a", fontFamily: "var(--font-mono)" }}>
                {result.name && result.name !== "Candidate" ? result.name : "Recommendation"}
              </div>
              <RecommendBadge recommendation={result.recommendation} />
              {result.seniority_match && result.seniority_match !== "Unknown" && (
                <span className="inline-flex items-center mt-1.5 ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={
                    result.seniority_match === "Exact"          ? { background: "var(--mint)", color: "var(--forest)" } :
                    result.seniority_match === "Close"          ? { background: "#fef3e8", color: "#b45309" } :
                    result.seniority_match === "Over-qualified" ? { background: "#e8f0fb", color: "#2563eb" } :
                                                                    { background: "#fef2f2", color: "#dc2626" }
                  }>
                  {result.seniority_match === "Exact" ? "✓" : "~"} {result.seniority_match}
                </span>
              )}
              <ConfidenceBadge confidence={result.confidence} />
            </div>
            {!defaultExpanded && <span className="text-xs shrink-0" style={{ color: "#c8d8ce" }}>{expanded ? "▲" : "▼"}</span>}
          </div>
          {result.summary && <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: "#8aaa9a" }}>{result.summary}</p>}
        </div>
      </div>

      {expanded && (
        <>
          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <div className="relative" style={{ borderTop: "1px solid var(--border-soft)" }}>
            <div className="flex overflow-x-auto" role="tablist">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={activeTab === t.key}
                  onClick={() => setActiveTab(t.key)}
                  className="flex items-center gap-1.5 px-4 py-3 text-[11px] font-semibold whitespace-nowrap transition-colors shrink-0 relative"
                  style={{ color: activeTab === t.key ? "var(--forest)" : "#8aaa9a" }}>
                  <span style={{ opacity: activeTab === t.key ? 1 : 0.6 }}>{t.icon}</span>
                  {t.label}
                  {t.badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={badgeStyle(t.tone)}>{t.badge}</span>}
                  {activeTab === t.key && <span className="absolute left-0 right-0 bottom-0 h-[2px]" style={{ background: "var(--forest)" }} />}
                </button>
              ))}
            </div>
            <span className="pointer-events-none absolute right-0 top-0 bottom-0 w-6" style={{ background: "linear-gradient(to left, white, transparent)" }} aria-hidden="true" />
          </div>

          {/* ── Tab panel ───────────────────────────────────────────────── */}
          <div className="px-6 py-6" role="tabpanel">

            {/* Overview */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {(result.skill_score != null || result.experience_score != null || result.culture_score != null) && (
                  <div>
                    <SectionLabel>Score breakdown</SectionLabel>
                    <div className="space-y-3">
                      {[
                        { key: "skills",     label: "Skills match", val: result.skill_score },
                        { key: "experience", label: "Experience",   val: result.experience_score },
                        { key: "culture",    label: "Culture & fit", val: result.culture_score },
                      ].filter((r) => r.val != null).map((row) => (
                        <div key={row.key}>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span style={{ color: "#5a7a6a" }}>{row.label}</span>
                            <span className="font-semibold" style={{ color: scoreColour(row.val) }}>{row.val}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }}>
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${row.val}%`, background: scoreColour(row.val) }} />
                          </div>
                          {result.score_rationale?.[row.key] && (
                            <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "#8aaa9a" }}>{result.score_rationale[row.key]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.cv_quality_issues?.length > 0 && (
                  <div className="rounded-xl p-3" style={{ background: "#fef3e8", border: "1px solid #fbdcb4" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#92400e" }}>CV quality notes</p>
                    <ul className="space-y-1">
                      {result.cv_quality_issues.map((issue, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px]" style={{ color: "#92400e" }}><span className="shrink-0 mt-0.5">⚠</span>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.standout_factors?.length > 0 && (
                  <div className="rounded-xl p-3" style={{ background: "var(--mint)", border: "1px solid var(--border-soft)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--forest)" }}>★ Standout factors</p>
                    <ul className="space-y-1.5">
                      {result.standout_factors.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px]" style={{ color: "var(--forest-deep)" }}><span className="shrink-0 mt-0.5">•</span>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!result.skill_score && !result.cv_quality_issues?.length && !result.standout_factors?.length && <EmptyTabState label="overview" />}
              </div>
            )}

            {/* Skills */}
            {activeTab === "skills" && (
              <div className="space-y-5">
                {matched.length > 0 && (
                  <div>
                    <SectionLabel>Matched</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {matched.map((s, i) => <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>✓ {s}</span>)}
                    </div>
                  </div>
                )}
                {missingRequired.length > 0 && (
                  <div>
                    <SectionLabel>Missing - required</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {missingRequired.map((s, i) => <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fbd0d0" }}>✗ {s}</span>)}
                    </div>
                  </div>
                )}
                {missingPreferred.length > 0 && (
                  <div>
                    <SectionLabel>Missing - preferred</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {missingPreferred.map((s, i) => <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#fef3e8", color: "#b45309" }}>~ {s}</span>)}
                    </div>
                  </div>
                )}
                {result.other_skills?.length > 0 && (
                  <div>
                    <SectionLabel>Other skills on CV</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {result.other_skills.map((s, i) => <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--mist)", color: "#8aaa9a" }}>{s}</span>)}
                    </div>
                  </div>
                )}
                {!matched.length && !missingRequired.length && !missingPreferred.length && !result.other_skills?.length && <EmptyTabState label="skills" />}
              </div>
            )}

            {/* Experience */}
            {activeTab === "experience" && (
              <div className="space-y-6">
                {result.experience_breakdown?.length > 0 && (
                  <div>
                    <SectionLabel>Experience breakdown</SectionLabel>
                    <div className="space-y-2.5">
                      {result.experience_breakdown.map((item, i) => {
                        const maxYears = Math.max(...result.experience_breakdown.map((b) => b.years), 1);
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-[11px] mb-1">
                              <span style={{ color: "#5a7a6a" }}>{item.area}</span>
                              <span className="font-semibold" style={{ color: item.years > 0 ? "var(--forest)" : "#c8d8ce" }}>{item.years > 0 ? `${item.years} yr${item.years !== 1 ? "s" : ""}` : "None"}</span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }}>
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round((item.years / maxYears) * 100)}%`, background: "var(--forest)" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {result.education?.length > 0 && (
                  <div>
                    <SectionLabel>Education</SectionLabel>
                    <div className="space-y-3">
                      {result.education.map((e, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs" style={{ background: "var(--mist)", border: "1px solid var(--border-soft)" }}>🎓</div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold" style={{ color: "#13201b" }}>{e.degree}{e.field_of_study ? ` ${e.field_of_study}` : ""}</p>
                            <p className="text-[11px]" style={{ color: "#5a7a6a" }}>{e.institution}{(e.start_year || e.end_year) && <span style={{ color: "#8aaa9a" }}> · {fmtYearRange(e.start_year, e.end_year)}</span>}</p>
                            {e.grade && <p className="text-[10px] font-medium mt-0.5" style={{ color: "var(--forest)" }}>{e.grade}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.certifications?.length > 0 && (
                  <div>
                    <SectionLabel>Certifications</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {result.certifications.map((c, i) => (
                        <span key={i} title={c.issuer ? `Issued by ${c.issuer}${c.year ? ` · ${c.year}` : ""}` : undefined}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#e8f0fb", color: "#2563eb", border: "1px solid #d3e2fa" }}>
                          🏅 {c.name}{c.year ? ` (${c.year})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {!result.experience_breakdown?.length && !result.education?.length && !result.certifications?.length && <EmptyTabState label="experience" />}
              </div>
            )}

            {/* Evidence */}
            {activeTab === "evidence" && (
              <div className="space-y-6">
                {result.red_flags?.length > 0 && (
                  <div className="rounded-xl p-3" style={{ background: "#fef2f2", border: "1px solid #fbd0d0" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#dc2626" }}>⚠ Red flags</p>
                    <ul className="space-y-1.5">{result.red_flags.map((f, i) => <li key={i} className="flex items-start gap-1.5 text-[11px]" style={{ color: "#b91c1c" }}><span className="shrink-0 mt-0.5">•</span>{f}</li>)}</ul>
                  </div>
                )}
                {result.strengths?.length > 0 && (
                  <div>
                    <SectionLabel>Strengths</SectionLabel>
                    <ul className="space-y-2">{result.strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "#5a7a6a" }}><span className="mt-0.5 shrink-0 font-bold" style={{ color: "var(--forest)" }}>✓</span>{s}</li>)}</ul>
                  </div>
                )}
                {result.weaknesses?.length > 0 && (
                  <div>
                    <SectionLabel>Gaps</SectionLabel>
                    <ul className="space-y-2">{result.weaknesses.map((w, i) => <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "#5a7a6a" }}><span className="mt-0.5 shrink-0 font-bold" style={{ color: "#e08080" }}>✗</span>{w}</li>)}</ul>
                  </div>
                )}
                {!result.red_flags?.length && !result.strengths?.length && !result.weaknesses?.length && <EmptyTabState label="evidence" />}
              </div>
            )}

            {/* Interview prep */}
            {activeTab === "prep" && (
              result.interview_questions?.length > 0 ? (
                <ol className="space-y-3">
                  {result.interview_questions.map((q, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs" style={{ color: "#13201b" }}>
                      <span className="shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5" style={{ background: "var(--mint)", color: "var(--forest)" }}>{i + 1}</span>
                      <span className="leading-relaxed pt-0.5">{q}</span>
                    </li>
                  ))}
                </ol>
              ) : <EmptyTabState label="interview question" />
            )}

            {/* Contact & salary */}
            {activeTab === "contact" && (
              <div className="space-y-6">
                {result.blind_mode ? (
                  <p className="text-xs px-3.5 py-3 rounded-[10px]" style={{ color: "#5a7a6a", background: "var(--mist)" }}>Contact details are hidden while blind screening is on.</p>
                ) : hasContact ? (
                  <div className="grid grid-cols-2 gap-4">
                    {result.email && <Field icon="✉" label="Email"><a href={`mailto:${result.email}`} className="text-xs truncate block" style={{ color: "#13201b" }}>{result.email}</a></Field>}
                    {result.phone && <Field icon="☎" label="Phone"><p className="text-xs" style={{ color: "#13201b" }}>{result.phone}</p></Field>}
                    {result.linkedin && <Field icon="in" label="LinkedIn"><a href={result.linkedin.startsWith("http") ? result.linkedin : `https://${result.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: "var(--forest)" }}>View profile</a></Field>}
                    {result.github && <Field icon="⌥" label="GitHub"><a href={result.github.startsWith("http") ? result.github : `https://github.com/${result.github.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: "var(--forest)" }}>View GitHub</a></Field>}
                    {result.portfolio_url && <Field icon="🔗" label="Portfolio"><a href={result.portfolio_url.startsWith("http") ? result.portfolio_url : `https://${result.portfolio_url}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: "var(--forest)" }}>View site</a></Field>}
                    {result.location && <Field icon="📍" label="Location"><p className="text-xs" style={{ color: "#13201b" }}>{result.location}</p></Field>}
                    {result.current_title && <Field icon="💼" label="Current role"><p className="text-xs" style={{ color: "#13201b" }}>{result.current_title}{result.current_employer ? ` @ ${result.current_employer}` : ""}</p></Field>}
                    {result.notice_period && <Field icon="⏱" label="Notice period"><p className="text-xs" style={{ color: "#13201b" }}>{result.notice_period}</p></Field>}
                    {result.willing_to_relocate != null && <Field icon="✈" label="Relocation"><p className="text-xs" style={{ color: "#13201b" }}>{result.willing_to_relocate ? "Open to relocating" : "Not open to relocating"}</p></Field>}
                  </div>
                ) : null}

                {result.salary_estimate && (
                  <div className="pt-5" style={{ borderTop: hasContact ? "1px solid var(--border-soft)" : "none" }}>
                    <SectionLabel>Salary estimate</SectionLabel>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>{fmtSalary(result.salary_estimate.low)} – {fmtSalary(result.salary_estimate.high)}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fef3e8", color: "#b45309" }}>{result.salary_estimate.seniority}</span>
                    </div>
                    {result.salary_estimate.rationale && <p className="text-[11px] leading-relaxed" style={{ color: "#8aaa9a" }}>{result.salary_estimate.rationale}</p>}
                  </div>
                )}
                {!hasContact && !result.salary_estimate && <EmptyTabState label="contact" />}
              </div>
            )}

            {/* Pipeline / shortlist / notes - the "action" tab */}
            {activeTab === "pipeline" && showInteractive && (
              <div className="space-y-6">
                {candidateId && <PipelineStage candidateId={candidateId} toast={safeToast} />}
                <div>
                  <SectionLabel>Shortlist</SectionLabel>
                  <ShortlistButton result={result} candidateId={candidateId} toast={safeToast} />
                </div>
                {candidateId && <RecruiterNotes candidateId={candidateId} toast={safeToast} />}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}