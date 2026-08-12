"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import CandidateResult from "@/components/CandidateResult";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB, matches the "max 10 MB" copy shown to recruiters
const MIN_LOADING_MS = 900; // keeps the stage progress readable even on very fast responses
const SCORING_VERSION = "2026-07-v1"; // stamped on each history entry so old vs re-tuned scores stay distinguishable
const FREE_ANALYSES_LIMIT = 3; // mirrors the upgrade modal's "3 free analyses" copy
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FEEDBACK_DOWN_REASONS = [
  "Missed a key skill",
  "Got seniority wrong",
  "Missed a red flag",
  "Score too high",
  "Score too low",
  "Other",
];

const STAGES = ["Reading CV", "Parsing job description", "Analysing candidate fit", "Generating score"];

// Richer per-stage copy + which "extracted field" chips light up at each
// stage, used only by the full-page ScanningStep for a more transparent,
// accuracy-signaling animation. Keeping this separate from STAGES (a plain
// string array used elsewhere) avoids touching the existing loading UI.
const STAGE_DETAILS = [
  { detail: "Extracting text, contact details, and section structure", reveals: ["contact"] },
  { detail: "Identifying must-haves vs nice-to-haves in the role", reveals: ["skills"] },
  { detail: "Comparing skills, seniority, and experience against the role", reveals: ["experience", "education"] },
  { detail: "Weighing the evidence into a final, explainable score", reveals: ["score"] },
];

const EXTRACTED_FIELDS = [
  { key: "contact",    label: "Contact details" },
  { key: "skills",     label: "Skills" },
  { key: "experience", label: "Experience" },
  { key: "education",  label: "Education" },
  { key: "score",      label: "Match score" },
];

// A CV under ~15KB is unusually small for a real document and is often a
// scanned image, a near-empty template, or a corrupted export — all of
// which reduce scoring accuracy since there's little text to extract from.
// This is a soft, non-blocking warning shown pre-scan, not a hard reject.
const THIN_CV_BYTES = 15 * 1024;

function isLikelyThinCv(file) {
  return !!file && file.size > 0 && file.size < THIN_CV_BYTES;
}

// File types accepted for CV upload
const ACCEPTED_CV_TYPES = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];
const ACCEPTED_CV_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ACCEPTED_CV_INPUT_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// File types accepted for an uploaded job description (adds .txt since job
// specs are often plain text, unlike CVs).
const ACCEPTED_JOB_TYPES = [...ACCEPTED_CV_TYPES, "text/plain"];
const ACCEPTED_JOB_EXTENSIONS = [...ACCEPTED_CV_EXTENSIONS, ".txt"];
const ACCEPTED_JOB_INPUT_ACCEPT = ACCEPTED_CV_INPUT_ACCEPT + ",.txt,text/plain";

// ── Preset job descriptions for the "name → job → upload" onboarding flow ──
// Grouped into categories so the picker reads like a product/coverage
// selector (pick a category, then a specific role) rather than one flat grid.
const PRESET_JOBS = [
  {
    id: "sales-exec",
    title: "Sales Executive",
    tag: "Sales",
    level: "Mid-level",
    highlights: ["2+ yrs B2B sales", "Quota track record", "Outbound prospecting"],
    text: `We're looking for a Sales Executive to join a fast-growing team.

- 2+ years B2B sales experience
- Track record of hitting quota
- Strong communication and negotiation skills
- Comfortable with outbound prospecting`,
  },
  {
    id: "sales-sdr",
    title: "SDR / BDR",
    tag: "Sales",
    level: "Entry-level",
    highlights: ["0-2 yrs experience", "High-volume outreach", "Pipeline generation"],
    text: `We're hiring a Sales/Business Development Representative to generate pipeline.

- 0-2 years in outbound sales or customer-facing work
- Comfortable with high-volume cold outreach (calls, email, LinkedIn)
- Organised, target-driven, coachable
- Strong written and verbal communication`,
  },
  {
    id: "software-eng",
    title: "Software Engineer",
    tag: "Engineering",
    level: "Mid-level",
    highlights: ["3+ yrs experience", "JS/TypeScript", "Ships production code"],
    text: `Seeking a Software Engineer to join our product team.

- 3+ years professional software development experience
- Proficiency in JavaScript/TypeScript
- Experience shipping and maintaining production code
- Comfortable working in an agile team`,
  },
  {
    id: "software-eng-sr",
    title: "Senior Software Engineer",
    tag: "Engineering",
    level: "Senior",
    highlights: ["6+ yrs experience", "System design", "Mentors juniors"],
    text: `Seeking a Senior Software Engineer to help lead our product team.

- 6+ years professional software development experience
- Strong system design and architecture skills
- Experience mentoring junior engineers
- Track record of owning projects end to end`,
  },
  {
    id: "ops-manager",
    title: "Operations Manager",
    tag: "Operations",
    level: "Senior",
    highlights: ["5+ yrs managing teams", "Process improvement", "P&L ownership"],
    text: `Operations Manager needed to run day-to-day operations.

- 5+ years managing operational teams
- Process improvement experience
- Budget and P&L ownership
- Strong stakeholder management`,
  },
  {
    id: "customer-success",
    title: "Customer Success Manager",
    tag: "Customer Success",
    level: "Mid-level",
    highlights: ["2+ yrs in CS/AM", "SaaS preferred", "Owns renewals"],
    text: `Customer Success Manager to own our key accounts.

- 2+ years in a CS or account management role
- SaaS experience preferred
- Excellent stakeholder management
- Comfortable owning renewals and upsell conversations`,
  },
];

const PRESET_CATEGORIES = ["All", ...Array.from(new Set(PRESET_JOBS.map((p) => p.tag)))];

function findDuplicateCv(file) {
  if (!file) return null;
  const history = ls("analysisHistory", []);
  return history.find((h) => h.cvName === file.name) || null;
}

function isAcceptedCvFile(file) {
  if (!file) return false;
  if (ACCEPTED_CV_TYPES.includes(file.type)) return true;
  // Fallback to extension check since some browsers/OSes don't set MIME type reliably for .doc/.docx
  const name = (file.name || "").toLowerCase();
  return ACCEPTED_CV_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function isAcceptedJobFile(file) {
  if (!file) return false;
  if (ACCEPTED_JOB_TYPES.includes(file.type)) return true;
  const name = (file.name || "").toLowerCase();
  return ACCEPTED_JOB_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ── localStorage helpers ─────────────────────────────────────────────────────
// NOTE: these must only ever be called from inside useEffect/event handlers,
// never directly in JSX during render — calling them in render caused a
// server/client hydration mismatch (server always sees the `fallback` since
// there's no localStorage in Node; client may see real data on first paint).
function ls(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, val) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { }
}

function exportRecruiterData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    analysisHistory: ls("analysisHistory", []),
    shortlist: ls("shortlist", []),
    jobTemplates: ls("jobTemplates", []),
    feedbackCount: ls("feedbackCount", 0),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `helixon-data-export-${Date.now()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearAllRecruiterData() {
  ["analysisHistory", "shortlist", "jobTemplates", "feedbackCount"].forEach((k) => {
    try { localStorage.removeItem(k); } catch { }
  });
}

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id}
          className={`px-4 py-2.5 rounded-[10px] text-xs font-semibold shadow-lg transition-all ${
            t.type === "success" ? "bg-[#0b6e4f] text-white"
              : t.type === "error" ? "bg-red-600 text-white"
              : "bg-[#13201b] text-white"
          }`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  function toast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  }
  return { toasts, toast };
}

// ── Compare panel ────────────────────────────────────────────────────────────
function ComparePanel({ result, compareResult, onClose }) {
  const rows = [
    { label: "Overall",    a: result.match_score,           b: compareResult.match_score },
    { label: "Skills",     a: result.skill_score      ?? 0, b: compareResult.skill_score      ?? 0 },
    { label: "Experience", a: result.experience_score  ?? 0, b: compareResult.experience_score ?? 0 },
  ];
  return (
    <div className="card px-6 py-5 mt-3">
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ fontFamily: "var(--font-display)" }}
          className="text-xs font-semibold text-[#13201b] tracking-tight">
          Comparing candidates
        </h3>
        <button type="button" onClick={onClose} aria-label="Close comparison"
          className="text-[10px] text-[#5a7a6a] hover:text-[#13201b] transition-colors px-2 py-1 rounded-lg hover:bg-[#f3f6f4]">
          ✕ Close
        </button>
      </div>
      <div className="flex gap-4 mb-4 text-[10px]">
        <span className="flex items-center gap-1.5 text-[#5a7a6a]">
          <span className="w-2 h-2 rounded-full bg-[#0b6e4f] inline-block" />
          {result.blind_mode ? "Candidate A" : (result.name || "Candidate A")}
        </span>
        <span className="flex items-center gap-1.5 text-[#5a7a6a]">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          {compareResult.blind_mode ? "Candidate B" : (compareResult.name || "Candidate B")}
        </span>
      </div>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-[10px] text-[#5a7a6a] mb-1.5">
              <span>{row.label}</span>
              <span className="flex gap-3">
                <span className="text-[#0b6e4f] font-semibold">{row.a}</span>
                <span className="text-blue-500 font-semibold">{row.b}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#e8f3ee] overflow-hidden">
              <div className="h-full rounded-full bg-[#0b6e4f] transition-all duration-700" style={{ width: `${row.a}%` }} />
            </div>
            <div className="h-1.5 rounded-full bg-blue-50 overflow-hidden mt-1">
              <div className="h-full rounded-full bg-blue-400 transition-all duration-700" style={{ width: `${row.b}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard strip ──────────────────────────────────────────────────────────
// Accepts a `version` prop so it can be forced to re-read localStorage whenever
// a new analysis lands, instead of going stale after the initial mount.
function DashboardPanel({ version, onCleared }) {
  const [data, setData] = useState(undefined); // undefined = not yet read (shows skeleton)
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    const history = ls("analysisHistory", []);
    const total   = history.length;
    if (total === 0) { setData({ empty: true }); return; }

    let scoreSum = 0, strong = 0;
    const bandCounts = [0, 0, 0, 0];
    for (const h of history) {
      const s = h.matchScore || 0;
      scoreSum += s;
      if (h.recommendation === "Strong match") strong++;
      if (s < 40) bandCounts[0]++;
      else if (s < 60) bandCounts[1]++;
      else if (s < 80) bandCounts[2]++;
      else bandCounts[3]++;
    }
    const avgScore  = Math.round(scoreSum / total);
    const shortlist = ls("shortlist", []).length;
    const bands = [
      { label: "0–40",   count: bandCounts[0] },
      { label: "40–60",  count: bandCounts[1] },
      { label: "60–80",  count: bandCounts[2] },
      { label: "80–100", count: bandCounts[3] },
    ];
    setData({ total, avgScore, strong, shortlist, bands });
  }, [version]);

  if (data === undefined) {
    return (
      <div className="card p-7 mb-6 animate-pulse" aria-hidden="true">
        <div className="h-4 w-28 rounded bg-[#e8ede9] mb-5" />
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-[#f3f6f4] rounded-[10px] p-4 h-16" />
          ))}
        </div>
        <div className="h-14 rounded bg-[#f3f6f4]" />
      </div>
    );
  }

  if (data.empty) return null;

  const { total, avgScore, strong, shortlist, bands } = data;
  const maxBand = Math.max(...bands.map((b) => b.count), 1);

  return (
    <div className="card p-7 mb-6">
      <div className="flex items-start justify-between mb-5">
        <h2 style={{ fontFamily: "var(--font-display)" }}
          className="text-sm font-semibold text-[#13201b] tracking-tight">
          Your activity
        </h2>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={exportRecruiterData}
            className="text-[10px] font-medium transition-colors" style={{ color: "#5a7a6a" }}>
            Export my data
          </button>
          {!confirmingClear ? (
            <button type="button" onClick={() => setConfirmingClear(true)}
              className="text-[10px] font-medium transition-colors" style={{ color: "#b0c4ba" }}>
              Delete my data
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px]">
              <span style={{ color: "#5a7a6a" }}>Delete everything?</span>
              <button type="button" onClick={() => { clearAllRecruiterData(); setConfirmingClear(false); onCleared?.(); }}
                className="font-semibold" style={{ color: "#dc2626" }}>Yes</button>
              <button type="button" onClick={() => setConfirmingClear(false)}
                style={{ color: "#5a7a6a" }}>Cancel</button>
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Analyses",      val: total },
          { label: "Avg score",     val: avgScore },
          { label: "Strong match",  val: strong },
          { label: "Shortlisted",   val: shortlist },
        ].map((m) => (
          <div key={m.label} className="bg-[#f3f6f4] rounded-[10px] p-4">
            <p className="text-[10px] text-[#5a7a6a] mb-1 uppercase tracking-wide font-medium">{m.label}</p>
            <p style={{ fontFamily: "var(--font-mono)" }}
              className="text-2xl font-semibold text-[#13201b]">{m.val}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-semibold text-[#5a7a6a] uppercase tracking-widest mb-3">Score distribution</p>
      <div className="flex gap-2 items-end h-14">
        {bands.map((b) => (
          <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full rounded-t-md transition-all duration-500"
              style={{
                height:     `${Math.round((b.count / maxBand) * 48)}px`,
                minHeight:  b.count ? 4 : 0,
                background: b.label === "80–100" || b.label === "60–80" ? "#0b6e4f" : "#e3e8e5",
              }} />
            <span className="text-[9px] text-[#5a7a6a]">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stale candidates banner ──────────────────────────────────────────────────
function StaleCandidatesBanner({ version }) {
  const [stale, setStale] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const history = ls("analysisHistory", []);
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const staleOnes = history.filter((h) => {
      if (!h.timestamp) return false;
      const age = now - new Date(h.timestamp).getTime();
      const isStrong = h.recommendation === "Strong match" || (h.matchScore || 0) >= 75;
      return isStrong && age > SEVEN_DAYS;
    });
    setStale(staleOnes);
  }, [version]);

  if (dismissed || !stale || stale.length === 0) return null;

  return (
    <div className="card px-5 py-3.5 mb-6 flex items-center gap-3"
      style={{ background: "#fef3e8", border: "1px solid #fbdcb4" }}>
      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs"
        style={{ background: "#fde3bd", color: "#b45309" }} aria-hidden="true">⏰</span>
      <p className="flex-1 text-xs" style={{ color: "#92400e" }}>
        <span className="font-semibold">{stale.length} strong {stale.length === 1 ? "match hasn't" : "matches haven't"}</span> been
        followed up on in over a week{stale[0]?.cvName ? ` — including ${stale[0].cvName}` : ""}. Worth a nudge before they go cold.
      </p>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss stale candidates notice"
        className="shrink-0 text-[11px] px-2 py-1 rounded-md transition-colors"
        style={{ color: "#b45309" }}>
        Dismiss
      </button>
    </div>
  );
}

// ── Feedback trust strip ─────────────────────────────────────────────────────
function FeedbackTrustNote({ version }) {
  const [count, setCount] = useState(0);
  useEffect(() => { setCount(ls("feedbackCount", 0)); }, [version]);
  if (!count) return null;
  return (
    <p className="text-[10px] mt-2" style={{ color: "#8aaa9a" }}>
      You&apos;ve rated {count} analys{count === 1 ? "is" : "es"} — thanks, this tunes future scoring for your agency.
    </p>
  );
}

// ── Score ring — empty state illustration, now with the scan-sweep signature
// element from globals.css so it doesn't read as a dead/static placeholder. ──
function EmptyScoreRing() {
  return (
    <div className="relative w-[72px] h-[72px] rounded-full overflow-hidden">
      <div className="scan-sweep" aria-hidden="true" />
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <circle cx="36" cy="36" r="28" stroke="#e3e8e5" strokeWidth="7" fill="none" />
        <circle cx="36" cy="36" r="28"
          stroke="#0b6e4f" strokeWidth="7" fill="none"
          strokeDasharray="176" strokeDashoffset="132"
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          opacity="0.25" />
        <text x="36" y="41" textAnchor="middle"
          style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, fill: "#c8d8ce" }}>
          —
        </text>
      </svg>
    </div>
  );
}

// ── Upload icon ──────────────────────────────────────────────────────────────
function UploadIcon({ className }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Onboarding wizard — full-page steps: Name → Job → Upload → Scanning ──
// Each step is a full viewport screen that clears and is replaced by the
// next. Step index and progress dots live here; the actual analyse call
// and its loading state are owned by AnalyzePage and passed down as props so
// the Scanning step can react to real progress instead of a fake timer.
// ═══════════════════════════════════════════════════════════════════════════
const WIZARD_STEPS = ["Name", "Job", "Upload", "Scan"];

function WizardProgress({ step }) {
  return (
    <div className="flex items-center gap-2 mb-8 w-full max-w-xs mx-auto">
      {WIZARD_STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 flex-1">
          <div
            className="h-1.5 flex-1 rounded-full overflow-hidden transition-colors duration-300"
            style={{ background: i <= step ? "var(--forest)" : "var(--border)" }}
          />
        </div>
      ))}
    </div>
  );
}

function AnalysisFlow({
  analysisName, setAnalysisName,
  jobText, setJobText,
  jobFile, onJobFileChange, onJobFileDrop,
  jobClientEmail, setJobClientEmail,
  file, onFileChange, onDrop,
  dragOver, setDragOver,
  duplicateWarning, setDuplicateWarning,
  error, setError,
  loading, stage,
  onStartScan,
  onFinish,
}) {
  const [step, setStep] = useState(0); // 0 name, 1 job, 2 upload, 3 scanning
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [jobMode, setJobMode] = useState(null); // "preset" | "upload" | "custom" — the coverage-style path picker
  const [activeCategory, setActiveCategory] = useState("All");
  const [jobDragOver, setJobDragOver] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  function goTo(next) {
    setTransitioning(true);
    setTimeout(() => {
      setStep(next);
      setTransitioning(false);
    }, 200);
  }

  function pickPreset(preset) {
    setSelectedPreset(preset.id);
    setJobText(preset.text);
    onJobFileChange(null);
  }

  function chooseMode(mode) {
    setJobMode(mode);
    if (mode !== "preset") setSelectedPreset(null);
    if (mode !== "upload") onJobFileChange(null);
  }

  const canContinueFromJob = jobMode === "upload" ? !!jobFile : jobText.trim().length > 0;

  // Entering the scanning step kicks off the real analysis; once
  // AnalyzePage's `loading` flips back to false with a result in hand,
  // onFinish() swaps the whole page over to the results screen.
  function enterScanning() {
    goTo(3);
    setTimeout(() => onStartScan(), 220);
  }

  const filteredPresets = activeCategory === "All"
    ? PRESET_JOBS
    : PRESET_JOBS.filter((p) => p.tag === activeCategory);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 transition-all duration-200"
      style={{
        background: "var(--mist)",
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? "translateY(8px)" : "translateY(0)",
      }}
    >
      {step < 3 && <div className="fixed top-8 left-0 right-0"><WizardProgress step={step} /></div>}

      {/* ── Step 0: Name ─────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="w-full max-w-md text-center">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center mx-auto mb-8"
            style={{ background: "var(--forest)" }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55"/>
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white"/>
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)"/>
            </svg>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#8aaa9a" }}>
            Step 1 of 4
          </p>
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3"
            style={{ color: "#13201b", fontFamily: "var(--font-display)" }}
          >
            Name this analysis
          </h1>
          <p className="text-xs mb-9 leading-relaxed" style={{ color: "#5a7a6a" }}>
            e.g. the role or client it&apos;s for — this helps you find it later in your History.
          </p>

          <input
            autoFocus
            value={analysisName}
            onChange={(e) => setAnalysisName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && analysisName.trim()) goTo(1); }}
            placeholder="e.g. Senior Sales Exec — Acme Ltd"
            className="w-full text-sm text-center px-4 py-3.5 rounded-[10px] outline-none transition-all mb-6"
            style={{
              border: "1px solid var(--border)",
              background: "white",
              color: "#13201b",
              fontFamily: "var(--font-body)",
            }}
            onFocus={(e) => (e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)")}
            onBlur={(e) => (e.target.style.boxShadow = "none")}
          />

          <button
            type="button"
            onClick={() => analysisName.trim() && goTo(1)}
            disabled={!analysisName.trim()}
            className="w-full font-semibold py-3.5 rounded-[10px] text-xs transition-all text-white"
            style={{
              background: analysisName.trim() ? "var(--forest)" : "var(--border)",
              color: analysisName.trim() ? "white" : "#8aaa9a",
              cursor: analysisName.trim() ? "pointer" : "not-allowed",
              boxShadow: analysisName.trim() ? "0 4px 14px -4px rgba(11,110,79,0.4)" : "none",
            }}
          >
            Continue →
          </button>
        </div>
      )}

      {/* ── Step 1: Job — insurance-style "pick your path" selector ────── */}
      {step === 1 && (
        <div className="w-full max-w-2xl">
          <button
            type="button"
            onClick={() => goTo(0)}
            className="text-[11px] font-medium mb-6 flex items-center gap-1 transition-colors"
            style={{ color: "#5a7a6a" }}
          >
            ← Back
          </button>

          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>
            Step 2 of 4 · {analysisName}
          </p>
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2"
            style={{ color: "#13201b", fontFamily: "var(--font-display)" }}
          >
            How do you want to add the role?
          </h1>
          <p className="text-xs mb-7" style={{ color: "#5a7a6a" }}>
            Pick a preset role, upload the job spec you already have, or write your own — like choosing a plan
            before you get a quote.
          </p>

          {/* Path picker — three big selectable "coverage" cards */}
          <div className="grid grid-cols-3 gap-3 mb-7">
            {[
              { id: "preset", label: "Preset role", sub: `${PRESET_JOBS.length} templates`, icon: "📋" },
              { id: "upload", label: "Upload spec", sub: "PDF, Word or .txt", icon: "📤" },
              { id: "custom", label: "Write my own", sub: "Paste or type", icon: "✎" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => chooseMode(opt.id)}
                className="text-center p-4 rounded-[12px] transition-all"
                style={{
                  border: `1.5px solid ${jobMode === opt.id ? "var(--forest)" : "var(--border)"}`,
                  background: jobMode === opt.id ? "#f0f9f4" : "white",
                }}
              >
                <span className="text-lg block mb-1.5" aria-hidden="true">{opt.icon}</span>
                <p className="text-xs font-semibold" style={{ color: "#13201b" }}>{opt.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#8aaa9a" }}>{opt.sub}</p>
              </button>
            ))}
          </div>

          {/* ── Preset path: category chips + role cards ────────────── */}
          {jobMode === "preset" && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-1.5 mb-4">
                {PRESET_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className="text-[10px] font-semibold px-3 py-1.5 rounded-full transition-all"
                    style={{
                      background: activeCategory === cat ? "var(--forest)" : "var(--mint)",
                      color: activeCategory === cat ? "white" : "var(--forest)",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {filteredPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => pickPreset(preset)}
                    className="text-left p-4 rounded-[12px] transition-all"
                    style={{
                      border: `1.5px solid ${selectedPreset === preset.id ? "var(--forest)" : "var(--border)"}`,
                      background: selectedPreset === preset.id ? "#f0f9f4" : "white",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "var(--mint)", color: "var(--forest)" }}
                      >
                        {preset.tag}
                      </span>
                      <span className="text-[9px]" style={{ color: "#8aaa9a" }}>{preset.level}</span>
                    </div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "#13201b" }}>
                      {preset.title}
                    </p>
                    <ul className="space-y-1">
                      {preset.highlights.map((h) => (
                        <li key={h} className="text-[10px] flex items-start gap-1.5" style={{ color: "#5a7a6a" }}>
                          <span style={{ color: "var(--forest)" }}>✓</span>{h}
                        </li>
                      ))}
                    </ul>
                    {selectedPreset === preset.id && (
                      <p className="text-[10px] mt-2 font-medium" style={{ color: "var(--forest)" }}>✓ Selected — you can still edit it below</p>
                    )}
                  </button>
                ))}
              </div>

              {selectedPreset && (
                <textarea
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  rows={6}
                  placeholder="Edit the preset job description here…"
                  className="w-full p-3.5 text-xs mt-4 resize-none outline-none rounded-[10px] transition-all"
                  style={{ border: "1px solid var(--border)", background: "white", color: "#13201b", fontFamily: "var(--font-body)" }}
                  onFocus={(e) => (e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)")}
                  onBlur={(e) => (e.target.style.boxShadow = "none")}
                />
              )}
            </div>
          )}

          {/* ── Upload path: dropzone for an existing job spec file ─── */}
          {jobMode === "upload" && (
            <div className="mb-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setJobDragOver(true); }}
                onDragLeave={() => setJobDragOver(false)}
                onDrop={(e) => { setJobDragOver(false); onJobFileDrop(e); }}
                onClick={() => !jobFile && document.getElementById("job-input-wizard").click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (!jobFile && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); document.getElementById("job-input-wizard").click(); } }}
                aria-label="Upload job description file"
                className="rounded-[14px] p-8 text-center select-none transition-all"
                style={{
                  cursor: jobFile ? "default" : "pointer",
                  border: `2px dashed ${jobDragOver ? "var(--forest)" : jobFile ? "var(--forest)" : "var(--border)"}`,
                  background: jobDragOver ? "var(--mint)" : jobFile ? "#f0f9f4" : "white",
                  transform: jobDragOver ? "scale(1.015)" : "scale(1)",
                }}
              >
                <input id="job-input-wizard" type="file" accept={ACCEPTED_JOB_INPUT_ACCEPT} className="hidden"
                  onChange={onJobFileChange} />
                {jobFile ? (
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
                      style={{ background: "white", border: "1px solid var(--border)" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <polyline points="9 15 11 17 15 13"/>
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: "#13201b" }}>{jobFile.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "#5a7a6a" }}>
                        {formatBytes(jobFile.size)} · {(jobFile.type.split("/")[1] || jobFile.name.split(".").pop() || "file").toUpperCase()}
                      </p>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onJobFileChange(null); }}
                      className="text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors shrink-0"
                      style={{ color: "#dc2626" }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <UploadIcon className="text-[#b0c4ba]" />
                    <p className="text-sm font-semibold" style={{ color: "#13201b" }}>Drop the job spec here or click to upload</p>
                    <p className="text-[11px]" style={{ color: "#5a7a6a" }}>PDF, Word or .txt · max 10 MB</p>
                  </div>
                )}
              </div>
              <p className="text-[10px] mt-3" style={{ color: "#8aaa9a" }}>
                We&apos;ll extract the text from your file automatically — no need to retype it.
              </p>
            </div>
          )}

          {/* ── Custom path: free-text job description ──────────────── */}
          {jobMode === "custom" && (
            <textarea
              autoFocus
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              rows={8}
              placeholder="Paste or write the job description here…"
              className="w-full p-3.5 text-xs mb-2 resize-none outline-none rounded-[10px] transition-all"
              style={{ border: "1px solid var(--border)", background: "white", color: "#13201b", fontFamily: "var(--font-body)" }}
              onFocus={(e) => (e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)")}
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
          )}

          {/* ── Optional client email — used later to send client-facing
              emails (shortlist updates, chasing feedback) without having
              to retype the address each time. ─────────────────────────── */}
          {jobMode && (
            <div className="mb-6">
              <label htmlFor="job-client-email" className="text-xs font-semibold block mb-1.5" style={{ color: "#13201b" }}>
                Client contact email <span className="font-normal" style={{ color: "#8aaa9a" }}>(optional)</span>
              </label>
              <input
                id="job-client-email"
                type="email"
                value={jobClientEmail}
                onChange={(e) => setJobClientEmail(e.target.value)}
                placeholder="client@company.com"
                className="w-full text-xs px-3.5 py-3 rounded-[10px] outline-none transition-all"
                style={{ border: "1px solid var(--border)", background: "white", color: "#13201b", fontFamily: "var(--font-body)" }}
                onFocus={(e) => (e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)")}
                onBlur={(e) => (e.target.style.boxShadow = "none")}
              />
              <p className="text-[10px] mt-1.5" style={{ color: "#8aaa9a" }}>
                Lets you send shortlist updates and feedback chasers straight from a scored candidate.
              </p>
            </div>
          )}

          {jobMode && (
            <button
              type="button"
              onClick={() => canContinueFromJob && goTo(2)}
              disabled={!canContinueFromJob}
              className="w-full font-semibold py-3.5 rounded-[10px] text-xs transition-all text-white mt-2"
              style={{
                background: canContinueFromJob ? "var(--forest)" : "var(--border)",
                color: canContinueFromJob ? "white" : "#8aaa9a",
                cursor: canContinueFromJob ? "pointer" : "not-allowed",
                boxShadow: canContinueFromJob ? "0 4px 14px -4px rgba(11,110,79,0.4)" : "none",
              }}
            >
              Continue to upload →
            </button>
          )}
        </div>
      )}

      {/* ── Step 2: Upload CV ────────────────────────────────────────── */}
      {step === 2 && (
        <div className="w-full max-w-lg">
          <button
            type="button"
            onClick={() => goTo(1)}
            className="text-[11px] font-medium mb-6 flex items-center gap-1 transition-colors"
            style={{ color: "#5a7a6a" }}
          >
            ← Back
          </button>

          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 text-center" style={{ color: "#8aaa9a" }}>
            Step 3 of 4 · {analysisName}
          </p>
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2 text-center"
            style={{ color: "#13201b", fontFamily: "var(--font-display)" }}
          >
            Upload the CV
          </h1>
          <p className="text-xs mb-6 text-center" style={{ color: "#5a7a6a" }}>
            Drop it in or click to browse — PDF or Word, max 10 MB.
          </p>

          {/* Format chips — sets accuracy expectations up front: text-based
              files score best, scanned/flattened PDFs have less to extract. */}
          <div className="flex items-center justify-center gap-1.5 mb-6 flex-wrap">
            {[".pdf", ".doc", ".docx"].map((ext) => (
              <span key={ext} className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "var(--mint)", color: "var(--forest)" }}>
                {ext}
              </span>
            ))}
            <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: "var(--border-soft, var(--border))", color: "#5a7a6a" }}>
              max 10 MB
            </span>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !file && document.getElementById("cv-input-wizard").click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (!file && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); document.getElementById("cv-input-wizard").click(); } }}
            aria-label="Upload CV file"
            className="rounded-[14px] p-8 text-center mb-4 select-none transition-all"
            style={{
              cursor: file ? "default" : "pointer",
              border: `2px dashed ${dragOver ? "var(--forest)" : file ? "var(--forest)" : "var(--border)"}`,
              background: dragOver ? "var(--mint)" : file ? "#f0f9f4" : "white",
              transform: dragOver ? "scale(1.015)" : "scale(1)",
            }}
          >
            <input id="cv-input-wizard" type="file" accept={ACCEPTED_CV_INPUT_ACCEPT} className="hidden"
              onChange={onFileChange} />
            {file ? (
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
                  style={{ background: "white", border: "1px solid var(--border)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <polyline points="9 15 11 17 15 13"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: "#13201b" }}>{file.name}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#5a7a6a" }}>
                    {formatBytes(file.size)} · {(file.type.split("/")[1] || file.name.split(".").pop() || "file").toUpperCase()}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button type="button" onClick={(e) => { e.stopPropagation(); document.getElementById("cv-input-wizard").click(); }}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors"
                    style={{ border: "1px solid var(--border)", color: "#5a7a6a", background: "white" }}>
                    Replace
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onFileChange({ target: { files: [] } }); }}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors"
                    style={{ color: "#dc2626" }}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <UploadIcon className="text-[#b0c4ba]" />
                <p className="text-sm font-semibold" style={{ color: "#13201b" }}>Drop CV here or click to upload</p>
                <p className="text-[11px]" style={{ color: "#5a7a6a" }}>Text-based PDFs and Word docs score most accurately</p>
              </div>
            )}
          </div>

          {file && isLikelyThinCv(file) && (
            <div className="mb-4 flex items-start gap-2 px-3.5 py-3 rounded-[10px] text-[11px]"
              style={{ background: "#fef3e8", border: "1px solid #fbdcb4", color: "#92400e" }}>
              <span className="shrink-0 mt-0.5">ⓘ</span>
              <span className="flex-1">
                This file is unusually small ({formatBytes(file.size)}) for a CV — it may be a scanned image or
                mostly-empty document. Scanned pages with no text layer can reduce scoring accuracy since there's
                little to extract. Worth double-checking it's the right file.
              </span>
            </div>
          )}

          {duplicateWarning && (
            <div className="mb-4 flex items-start gap-2 px-3.5 py-3 rounded-[10px] text-[11px]"
              style={{ background: "#fef3e8", border: "1px solid #fbdcb4", color: "#92400e" }}>
              <span className="shrink-0 mt-0.5">↻</span>
              <span className="flex-1">{duplicateWarning}</span>
              <button type="button" onClick={() => setDuplicateWarning(null)}
                aria-label="Dismiss duplicate warning" className="shrink-0" style={{ color: "#b45309" }}>✕</button>
            </div>
          )}

          {error && (
            <div role="alert" className="mb-4 p-3.5 rounded-[10px] text-xs flex items-start gap-2"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              <span className="shrink-0 mt-0.5">⚠</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          <p className="text-[10px] mb-6 flex items-center gap-1.5 justify-center" style={{ color: "#8aaa9a" }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            CV data is processed securely, held in the EU, and never used to train AI.
          </p>

          <button
            type="button"
            onClick={() => file && enterScanning()}
            disabled={!file}
            className="w-full font-semibold py-3.5 rounded-[10px] text-xs transition-all text-white"
            style={{
              background: file ? "var(--forest)" : "var(--border)",
              color: file ? "white" : "#8aaa9a",
              cursor: file ? "pointer" : "not-allowed",
              boxShadow: file ? "0 4px 14px -4px rgba(11,110,79,0.4)" : "none",
            }}
          >
            Scan candidate →
          </button>
        </div>
      )}

      {/* ── Step 3: Scanning ─────────────────────────────────────────── */}
      {step === 3 && (
        <ScanningStep
          analysisName={analysisName}
          fileName={file?.name}
          fileSize={file?.size}
          loading={loading}
          stage={stage}
          error={error}
          onRetry={() => onStartScan()}
          onChangeFile={() => goTo(2)}
          onViewResult={onFinish}
        />
      )}
    </main>
  );
}

// ── Step 3 content: animated full-page scan ─────────────────────────────
// Signature visual: a scan-line sweeps down a stylised CV document while
// "extracted field" chips light up in sync with the real stage the app is
// on. This does two jobs at once — it looks polished, and it makes the
// scan's accuracy legible (recruiters can see *what* was read, not just a
// spinner), which builds trust in the eventual score.
function ScanningStep({ analysisName, fileName, fileSize, loading, stage, error, onRetry, onChangeFile, onViewResult }) {
  const done = !loading && !error;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const iv = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  // Fields "revealed" so far, derived from how far the real stage has
  // progressed — not a fixed timer, so it always matches actual progress.
  const revealedFields = new Set();
  for (let i = 0; i <= stage && i < STAGE_DETAILS.length; i++) {
    if (i < stage || done) STAGE_DETAILS[i].reveals.forEach((f) => revealedFields.add(f));
  }
  if (done) EXTRACTED_FIELDS.forEach((f) => revealedFields.add(f.key));
  const confidence = done ? 100 : Math.round(((stage + 0.5) / STAGE_DETAILS.length) * 92);

  // Specific, actionable guidance instead of a generic failure message —
  // recruiters can act on this immediately rather than guessing why a scan
  // failed.
  function errorGuidance(message) {
    const m = (message || "").toLowerCase();
    if (m.includes("network")) return "Check your connection and try again — the file wasn't sent.";
    if (m.includes("cv") && m.includes("job")) return "Make sure both a CV and a job description were provided before scanning.";
    if (m.includes("trial session")) return "Your trial session couldn't be found — head back to the homepage and start a new free trial.";
    return "This can happen with scanned/image-only PDFs, password-protected files, or a corrupted export. Try a different file, or re-export the CV as text-based PDF.";
  }

  return (
    <div className="w-full max-w-md text-center">
      <style>{`
        @keyframes helixon-scanline { 0% { top: 6%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 94%; opacity: 0; } }
        @keyframes helixon-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>

      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#8aaa9a" }}>
        Step 4 of 4 · {analysisName}
      </p>
      {loading && (
        <p className="text-[10px] mb-5" style={{ color: "#b0c4ba" }}>
          {elapsed}s elapsed
        </p>
      )}
      {!loading && <div className="mb-5" />}

      {/* Document silhouette with scanning sweep */}
      <div className="relative w-24 h-28 mx-auto mb-7 rounded-[8px] overflow-hidden"
        style={{ background: "white", border: `1.5px solid ${error ? "#dc2626" : done ? "var(--forest)" : "var(--border)"}` }}>
        <div className="p-3 pt-4 space-y-1.5">
          <div className="h-1.5 rounded-full" style={{ width: "60%", background: "var(--border)" }} />
          <div className="h-1 rounded-full" style={{ width: "40%", background: "var(--border-soft, var(--border))" }} />
          <div className="h-1 rounded-full mt-2.5" style={{ width: "80%", background: "var(--border-soft, var(--border))" }} />
          <div className="h-1 rounded-full" style={{ width: "70%", background: "var(--border-soft, var(--border))" }} />
          <div className="h-1 rounded-full" style={{ width: "75%", background: "var(--border-soft, var(--border))" }} />
          <div className="h-1 rounded-full mt-2.5" style={{ width: "50%", background: "var(--border-soft, var(--border))" }} />
          <div className="h-1 rounded-full" style={{ width: "65%", background: "var(--border-soft, var(--border))" }} />
        </div>
        {loading && (
          <div
            className="absolute left-0 right-0 h-6 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(11,110,79,0) 0%, rgba(11,110,79,0.22) 50%, rgba(11,110,79,0) 100%)",
              animation: "helixon-scanline 1.6s ease-in-out infinite",
            }}
          />
        )}
        {done && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(240,249,244,0.9)" }}>
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--forest)" }}>✓</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(254,242,242,0.92)" }}>
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "#dc2626" }}>⚠</span>
          </div>
        )}
      </div>

      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
        {error ? "Scan failed" : done ? "Scan complete" : "Scanning candidate…"}
      </h1>
      <p className="text-xs mb-7 leading-relaxed" style={{ color: "#5a7a6a" }}>
        {error ? errorGuidance(error) : fileName ? `Analysing ${fileName}${fileSize ? ` (${formatBytes(fileSize)})` : ""} against your job spec.` : "Running the analysis…"}
      </p>

      {!error && (
        <>
          {/* Stage checklist with live sub-detail copy */}
          <div className="rounded-[12px] p-5 mb-4 space-y-1 text-left"
            style={{ background: "white", border: "1px solid var(--border-soft)" }}>
            {STAGES.map((s, i) => {
              const active = i === stage && loading;
              const complete = i < stage || done;
              return (
                <div key={i} className={`py-1.5 transition-opacity duration-300 ${!complete && !active ? "opacity-30" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors"
                      style={{
                        background: complete ? "var(--forest)" : active ? "var(--mint)" : "var(--border)",
                        color: complete ? "white" : active ? "var(--forest)" : "#b0c4ba",
                      }}>
                      {complete ? "✓" : ""}
                    </div>
                    <span className={`text-xs ${active ? "font-semibold" : ""}`} style={{ color: active ? "#13201b" : "#5a7a6a" }}>
                      {s}{active ? "…" : ""}
                    </span>
                  </div>
                  {active && STAGE_DETAILS[i] && (
                    <p className="text-[10px] mt-1 ml-8" style={{ color: "#8aaa9a", animation: "helixon-pulse 1.6s ease-in-out infinite" }}>
                      {STAGE_DETAILS[i].detail}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Live "what we found" chips — extraction transparency */}
          <div className="flex flex-wrap gap-1.5 justify-center mb-5">
            {EXTRACTED_FIELDS.map((f) => {
              const found = revealedFields.has(f.key);
              return (
                <span key={f.key}
                  className="text-[10px] font-medium px-2.5 py-1 rounded-full transition-all duration-300 flex items-center gap-1"
                  style={{
                    background: found ? "var(--mint)" : "var(--mist)",
                    color: found ? "var(--forest)" : "#b0c4ba",
                    border: `1px solid ${found ? "var(--mint)" : "var(--border-soft, var(--border))"}`,
                    transform: found ? "scale(1)" : "scale(0.96)",
                  }}>
                  {found && "✓ "}{f.label}
                </span>
              );
            })}
          </div>

          {/* Confidence meter — builds as the scan progresses */}
          <div className="mb-7">
            <div className="flex items-center justify-between text-[10px] mb-1.5" style={{ color: "#8aaa9a" }}>
              <span>Extraction confidence</span>
              <span className="font-semibold" style={{ color: done ? "var(--forest)" : "#5a7a6a" }}>{confidence}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-soft, var(--border))" }}>
              <div className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${confidence}%`, background: "var(--forest)" }} />
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="space-y-2.5 mb-3">
          <button type="button" onClick={onRetry}
            className="w-full font-semibold py-3.5 rounded-[10px] text-xs transition-all text-white"
            style={{ background: "var(--forest)", boxShadow: "0 4px 14px -4px rgba(11,110,79,0.4)" }}>
            Retry scan
          </button>
          <button type="button" onClick={onChangeFile}
            className="w-full font-semibold py-3 rounded-[10px] text-xs transition-all"
            style={{ border: "1px solid var(--border)", color: "#5a7a6a" }}>
            ← Try a different file
          </button>
        </div>
      )}

      {done && (
        <button type="button" onClick={onViewResult}
          className="w-full font-semibold py-3.5 rounded-[10px] text-xs transition-all text-white"
          style={{ background: "var(--forest)", boxShadow: "0 4px 14px -4px rgba(11,110,79,0.4)" }}>
          View results →
        </button>
      )}

      {!done && !error && (
        <p className="text-[10px]" style={{ color: "#b0c4ba" }}>This usually takes a few seconds…</p>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AnalyzePage() {
  const { toasts, toast } = useToast();

  // Onboarding wizard state — `flowDone` gates the full-page Name→Job wizard
  // vs. the main upload/score screen. `analysisName` is carried through into
  // history entries so it's identifiable later.
  const [flowDone,      setFlowDone]      = useState(false);
  const [analysisName,  setAnalysisName]  = useState("");

  const [file,          setFile]          = useState(null);
  const [jobText,       setJobText]       = useState("");
  const [jobFile,       setJobFile]       = useState(null); // uploaded job-description file, sent alongside/instead of jobText
  const [jobClientEmail, setJobClientEmail] = useState(""); // optional client contact, saved to jobs.client_email
  const [loading,       setLoading]       = useState(false);
  const [stage,         setStage]         = useState(0);
  const [result,        setResult]        = useState(null);
  const [candidateId,   setCandidateId]   = useState(null);
  const [jobId,         setJobId]         = useState(null);
  const [error,         setError]         = useState(null);
  const [feedback,      setFeedback]      = useState(null);
  const [feedbackSent,  setFeedbackSent]  = useState(false);
  const [showUpgrade,   setShowUpgrade]   = useState(false);
  const [dragOver,      setDragOver]      = useState(false);
  const [emailDraft,    setEmailDraft]    = useState(null);
  const [emailLoading,  setEmailLoading]  = useState(false);
  const [emailPurpose,  setEmailPurpose]  = useState("invite_to_interview");
  const [emailEdited,   setEmailEdited]   = useState("");
  const [emailCopied,   setEmailCopied]   = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sending,        setSending]        = useState(false);
  const [sent,           setSent]           = useState(false);
  const [compareMode,   setCompareMode]   = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [blindMode,     setBlindMode]     = useState(false);
  const [templates,     setTemplates]     = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [requirements,  setRequirements]  = useState([]);
  const [reqDraft,      setReqDraft]      = useState("");
  const [isRerun,       setIsRerun]       = useState(false);
  const [rerunBanner,   setRerunBanner]   = useState(false);
  const [historyVersion,  setHistoryVersion]  = useState(0);
  const [feedbackVersion, setFeedbackVersion] = useState(0);
  const [mobileNavOpen,   setMobileNavOpen]   = useState(false);
  const [uploadAnnounce,  setUploadAnnounce]  = useState("");
  const [consentGiven,    setConsentGiven]    = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [feedbackReason,  setFeedbackReason]  = useState(null);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [analysesUsed,    setAnalysesUsed]    = useState(0);
  // Was `ls("analysisHistory", []).length === 0` called directly in JSX —
  // caused a hydration mismatch since SSR always sees an empty fallback.
  // Now read only inside useEffect below, default false so SSR and first
  // client paint agree.
  const [showOnboarding,  setShowOnboarding]  = useState(false);

  const emailArtifactIdRef = useRef(null);
  const jobTextRef = useRef(null);
  const upgradeModalRef = useRef(null);
  const upgradeTriggerRef = useRef(null);
  const lastAnalyseOptsRef = useRef({});

  useEffect(() => {
    setTemplates(ls("jobTemplates", []));
    setAnalysesUsed(ls("analysisHistory", []).length);
    setShowOnboarding(ls("analysisHistory", []).length === 0);
  }, []);

  // Re-check onboarding visibility whenever a new analysis lands or history
  // is cleared, same as DashboardPanel/StaleCandidatesBanner already do.
  useEffect(() => {
    setShowOnboarding(ls("analysisHistory", []).length === 0);
  }, [historyVersion]);

  useEffect(() => {
    if (!loading) { setStage(0); return; }
    const iv = setInterval(() => setStage((p) => p < STAGES.length - 1 ? p + 1 : p), 4000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !loading && file && jobText.trim()) handleAnalyse();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, file, jobText]);

  useEffect(() => {
    if (result && !isRerun) { /* new (non-rerun) result — nothing extra to reset now that CandidateResult owns its own tab state */ }
    if (result) setIsRerun(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Reset the "send" state whenever a fresh draft is generated so the button
  // doesn't show a stale "Sent ✓" from a previous purpose/candidate.
  useEffect(() => {
    setSent(false);
  }, [emailDraft]);

  // Prefill the recipient field once a draft exists: candidate's own email
  // for candidate-facing purposes, the job's saved client email for
  // client-facing purposes. Recruiter can still overwrite it by hand.
  useEffect(() => {
    if (!emailDraft) return;
    if (emailPurpose === "client_shortlist_update" || emailPurpose === "chase_feedback") {
      setRecipientEmail(jobClientEmail || "");
    } else {
      setRecipientEmail(result?.email || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailDraft]);

  // Modal a11y: trap focus inside while open, close on Escape, and return
  // focus to whatever triggered it once closed.
  useEffect(() => {
    if (!showUpgrade) return;
    upgradeTriggerRef.current = document.activeElement;
    const node = upgradeModalRef.current;
    const focusable = node?.querySelectorAll('a[href], button:not([disabled])');
    focusable?.[0]?.focus();

    function onKey(e) {
      if (e.key === "Escape") { setShowUpgrade(false); return; }
      if (e.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      upgradeTriggerRef.current?.focus?.();
    };
  }, [showUpgrade]);

  function saveCurrentJobSpec() {
    if (!jobText.trim()) return;
    const name = jobText.slice(0, 60).trim() + (jobText.length > 60 ? "…" : "");
    const next = [{ id: crypto.randomUUID(), name, text: jobText, savedAt: new Date().toISOString(), uses: 0 }, ...templates].slice(0, 20);
    setTemplates(next); lsSet("jobTemplates", next); toast("Job spec saved");
  }

  function loadTemplate(t) {
    const key = t.id || t.savedAt;
    const next = templates.map((tmpl) =>
      (tmpl.id || tmpl.savedAt) === key ? { ...tmpl, uses: (tmpl.uses || 0) + 1 } : tmpl
    );
    setTemplates(next); lsSet("jobTemplates", next);
    setJobText(t.text); setShowTemplates(false); toast("Template loaded");
  }

  function deleteTemplate(t) {
    const key = t.id || t.savedAt;
    const next = templates.filter((tmpl) => (tmpl.id || tmpl.savedAt) !== key);
    setTemplates(next); lsSet("jobTemplates", next);
  }

  // Handles the job-description file input from the wizard's "Upload spec"
  // path. Accepts .txt (read directly into jobText, no backend needed) or
  // PDF/Word (kept as a File and sent to the backend, mirroring how the CV
  // itself is uploaded — the /api/run endpoint needs a matching `jobFile`
  // field alongside `jobText` to extract text server-side).
  function handleJobFileChange(eOrNull) {
    const chosen = eOrNull === null ? null : (eOrNull.target?.files?.[0] || null);
    if (!chosen) { setJobFile(null); return; }
    if (!isAcceptedJobFile(chosen)) { setError("Please upload a PDF, Word (.doc/.docx) or .txt file."); return; }
    if (chosen.size > MAX_FILE_BYTES) { setError(`That file is ${formatBytes(chosen.size)} — please choose a file under 10MB.`); return; }
    setError(null);
    if (chosen.type === "text/plain" || chosen.name.toLowerCase().endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (ev) => setJobText(String(ev.target?.result || ""));
      reader.readAsText(chosen);
      setJobFile(null); // plain text is read straight into jobText, no file needs sending
    } else {
      setJobFile(chosen);
      setJobText(""); // the server will extract text from the file itself
    }
  }

  function handleJobFileDrop(e) {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    handleJobFileChange({ target: { files: [dropped] } });
  }

  async function handleAnalyse(opts = {}) {
    const { rerun = false } = opts;
    if (!file || (!jobText.trim() && !jobFile)) { setError("Please add a CV and a job description (paste, choose a preset, or upload a file)."); return; }
    lastAnalyseOptsRef.current = opts;
    const startedAt = Date.now();
    setLoading(true); setError(null); setFeedback(null);
    setFeedbackSent(false); setShowUpgrade(false); setEmailDraft(null);
    setIsRerun(rerun);
    if (!compareMode) { setResult(null); setCandidateId(null); setCompareResult(null); setJobId(null); }

    const fd = new FormData();
    fd.append("cv", file);
    fd.append("jobText", jobText);
    if (jobFile) fd.append("jobFile", jobFile);
    // NOTE: agencyId is intentionally NOT sent from the client anymore.
    // The server resolves it from the httpOnly `helixon_trial` cookie (or
    // the authenticated user's own agency) so it can't be spoofed.
    if (jobClientEmail.trim()) fd.append("clientEmail", jobClientEmail.trim());
    fd.append("blind", blindMode ? "true" : "false");
    fd.append("requirements", JSON.stringify(requirements));

    try {
      const res  = await fetch("/api/run", { method: "POST", body: fd });
      const data = await res.json();

      if (data.ok) {
        if (compareMode && result) {
          setCompareResult(data.result);
          toast("Second candidate analysed");
        } else {
          setResult(data.result);
          setCandidateId(data.candidateId);
          setJobId(data.jobId);
          toast(rerun
            ? `Re-scored: ${data.result.match_score} · ${data.result.recommendation}`
            : `Score: ${data.result.match_score} · ${data.result.recommendation}`);
        }
        const entry = {
          id: Date.now(), timestamp: new Date().toISOString(),
          analysisName: analysisName || null,
          cvName: file.name, matchScore: data.result.match_score,
          recommendation: data.result.recommendation,
          summary: data.result.summary,
          email: data.result.email || null,
          phone: data.result.phone || null,
          linkedin: data.result.linkedin || null,
          rerun,
          scoringVersion: SCORING_VERSION,
        };
        const history = ls("analysisHistory", []);
        history.unshift(entry);
        lsSet("analysisHistory", history.slice(0, 50));
        setAnalysesUsed((n) => n + 1);
        setHistoryVersion((v) => v + 1);
      } else if (data.upgrade) {
        setShowUpgrade(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      const elapsed = Date.now() - startedAt;
      const remaining = MIN_LOADING_MS - elapsed;
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setLoading(false);
      setRerunBanner(false);
    }
  }

  function handleRetryAnalyse() {
    handleAnalyse(lastAnalyseOptsRef.current);
  }

  function handleRerunWithTweaks() {
    setRerunBanner(true);
    toast("Adjust the job spec or requirements, then hit Analyse again", "info");
    jobTextRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    jobTextRef.current?.focus();
  }

  async function submitFeedback(rating, reason = null) {
    setFeedback(rating); setFeedbackSent(true); setFeedbackReason(reason);
    const count = ls("feedbackCount", 0) + 1;
    lsSet("feedbackCount", count);
    setFeedbackVersion((v) => v + 1);
    toast(rating === "up" ? "Thanks for the feedback 👍" : "Thanks — we'll use this to improve");
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, reason }),
      });
    } catch { }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!isAcceptedCvFile(dropped)) { setError("Please drop a PDF or Word (.doc/.docx) file."); return; }
    if (dropped.size > MAX_FILE_BYTES) { setError(`That file is ${formatBytes(dropped.size)} — please drop a file under 10MB.`); return; }
    setFile(dropped); setError(null);
    setUploadAnnounce(`CV uploaded: ${dropped.name}`);
    const dupe = findDuplicateCv(dropped);
    setDuplicateWarning(dupe ? `You already analysed a file named "${dropped.name}" ${dupe.timestamp ? "on " + new Date(dupe.timestamp).toLocaleDateString() : "previously"} — scored ${dupe.matchScore}. This looks like a re-upload rather than a new candidate.` : null);
  }

  const generateEmail = useCallback(async () => {
    if (!candidateId || !jobId) return;
    setEmailLoading(true); setEmailDraft(null); setEmailCopied(false); setSent(false);
    try {
      const res  = await fetch("/api/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // agencyId no longer sent — the server resolves it from the trial
        // cookie / session, same as /api/run.
        body: JSON.stringify({ candidateId, jobId, purpose: emailPurpose }),
      });
      const data = await res.json();
      if (data.ok) {
        emailArtifactIdRef.current = data.artifact.id;
        setEmailDraft(data.artifact.content.original_text);
        setEmailEdited(data.artifact.content.original_text);
      } else {
        toast(data.error || "Couldn't draft that email — try again", "error");
      }
    } catch {
      toast("Network error while drafting the email — try again", "error");
    } finally {
      setEmailLoading(false);
    }
  }, [candidateId, jobId, emailPurpose]);

  async function handleSendEmail() {
    if (!recipientEmail.trim()) { toast("Enter a recipient email first", "error"); return; }
    if (!EMAIL_RE.test(recipientEmail.trim())) { toast("That doesn't look like a valid email address", "error"); return; }
    if (!emailArtifactIdRef.current) { toast("Draft the email first", "error"); return; }

    setSending(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactId: emailArtifactIdRef.current,
          to: recipientEmail.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
        toast(`Email sent to ${recipientEmail.trim()}`);
      } else {
        toast(data.error || "Failed to send email — try again", "error");
      }
    } catch {
      toast("Network error while sending — try again", "error");
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    setResult(null); setCandidateId(null); setJobId(null);
    setFile(null); setJobText(""); setJobFile(null); setFeedback(null);
    setFeedbackSent(false); setEmailDraft(null); setError(null);
    setCompareMode(false); setCompareResult(null); setRerunBanner(false);
    setRequirements([]); setReqDraft("");
    setBlindMode(false); setConsentGiven(false); setDuplicateWarning(null);
    setFeedbackReason(null); setShowReasonPicker(false);
    setRecipientEmail(""); setSent(false);
    // Also reset the onboarding wizard so a fresh "Start a new candidate"
    // takes the recruiter back through Name → Job rather than dropping
    // straight into the upload screen with stale context.
    setAnalysisName(""); setFlowDone(false); setJobClientEmail("");
  }

  async function handleCopyEmail() {
    await navigator.clipboard.writeText(emailEdited);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
    toast("Email copied to clipboard");
    const artifactId = emailArtifactIdRef.current;
    if (artifactId) {
      fetch("/api/update-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId, finalText: emailEdited }),
      });
    }
  }

  async function handleCopyClientSummary() {
    if (!result) return;
    const lines = [
      `Candidate: ${result.blind_mode ? "Candidate (blind screened)" : (result.name || "Candidate")}`,
      `Match score: ${result.match_score} — ${result.recommendation}`,
      result.summary ? `\nSummary: ${result.summary}` : "",
      result.standout_factors?.length ? `\nStandout factors:\n${result.standout_factors.map((s) => `• ${s}`).join("\n")}` : "",
      result.missing_required?.length ? `\nMissing (required):\n${result.missing_required.map((s) => `• ${s}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(lines);
    toast("Client-ready summary copied to clipboard");
  }

  function handleFileChange(e) {
    const chosen = e.target.files?.[0] || null;
    if (chosen && !isAcceptedCvFile(chosen)) {
      setError("Please upload a PDF or Word (.doc/.docx) file.");
      setFile(null);
      return;
    }
    if (chosen && chosen.size > MAX_FILE_BYTES) {
      setError(`That file is ${formatBytes(chosen.size)} — please choose a file under 10MB.`);
      setFile(null);
      return;
    }
    setFile(chosen);
    setError(null);
    if (chosen) {
      setUploadAnnounce(`CV uploaded: ${chosen.name}`);
      const dupe = findDuplicateCv(chosen);
      setDuplicateWarning(dupe ? `You already analysed a file named "${chosen.name}" ${dupe.timestamp ? "on " + new Date(dupe.timestamp).toLocaleDateString() : "previously"} — scored ${dupe.matchScore}. This looks like a re-upload rather than a new candidate.` : null);
    } else {
      setDuplicateWarning(null);
    }
  }

  const floorCapped = result?.score_rationale?.capped || result?.floor_capped ||
    (result?.score_rationale?.cap_reason ? true : false);
  const capReason = result?.score_rationale?.cap_reason || result?.cap_reason || null;
  const metCount  = result?.requirements_met?.filter((r) => r.met).length || 0;
  const reqTotal  = result?.requirements_met?.length || 0;
  const isClientFacingEmail = emailPurpose === "client_shortlist_update" || emailPurpose === "chase_feedback";

  // ── Render ────────────────────────────────────────────────────────────────

  // Full-page onboarding wizard: Name → Job. Renders in place of the whole
  // page (nav included) so each step feels like its own screen that clears
  // and is replaced by the next, rather than living in a shared card.
  if (!flowDone) {
    return (
      <>
        <Toast toasts={toasts} />
        <AnalysisFlow
          analysisName={analysisName}
          setAnalysisName={setAnalysisName}
          jobText={jobText}
          setJobText={setJobText}
          jobFile={jobFile}
          onJobFileChange={handleJobFileChange}
          onJobFileDrop={handleJobFileDrop}
          jobClientEmail={jobClientEmail}
          setJobClientEmail={setJobClientEmail}
          file={file}
          onFileChange={handleFileChange}
          onDrop={handleDrop}
          dragOver={dragOver}
          setDragOver={setDragOver}
          duplicateWarning={duplicateWarning}
          setDuplicateWarning={setDuplicateWarning}
          error={error}
          setError={setError}
          loading={loading}
          stage={stage}
          onStartScan={() => handleAnalyse()}
          onFinish={() => { setFlowDone(true); toast(`Score: ${result?.match_score} · ${result?.recommendation}`); }}
        />
      </>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <Toast toasts={toasts} />
      <span className="sr-only" role="status" aria-live="polite">{uploadAnnounce}</span>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b"
        style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">

          <a href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105"
              style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55"/>
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white"/>
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)"/>
              </svg>
            </div>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight"
                style={{ color: "var(--ink, #13201b)", fontFamily: "var(--font-display)" }}>
                Helixon
              </span>
              <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "#8aaa9a" }}>
                Screen candidates in seconds
              </span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-medium"
            style={{ color: "#5a7a6a" }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            GDPR-ready · Data held in the EU
          </div>

          <div className="flex items-center gap-0.5">
            {["History", "Shortlists", "Bulk Upload", "Pricing"].map((label) => (
              <a key={label} href={`/${label.toLowerCase().replace(" ", "")}`}
                className="text-xs px-2.5 py-1.5 rounded-[8px] transition-colors hidden sm:block"
                style={{ color: "#5a7a6a" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {label}
              </a>
            ))}
            <a href="/login"
              className="text-xs px-2.5 py-1.5 rounded-[8px] transition-colors hidden sm:block"
              style={{ color: "#5a7a6a" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              Login
            </a>
            <a href="/signup"
              className="text-xs font-semibold px-4 py-1.5 rounded-[10px] ml-1 transition-colors text-white hidden sm:block"
              style={{ background: "var(--forest)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--forest-deep)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--forest)"}>
              Start free
            </a>
            <button type="button" onClick={() => setMobileNavOpen((v) => !v)}
              aria-expanded={mobileNavOpen} aria-label="Open menu"
              className="sm:hidden w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors"
              style={{ color: "#13201b" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
              </svg>
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="sm:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
            {["History", "Shortlists", "Bulk Upload", "Pricing", "Login"].map((label) => (
              <a key={label} href={`/${label.toLowerCase().replace(" ", "")}`}
                onClick={() => setMobileNavOpen(false)}
                className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>
                {label}
              </a>
            ))}
            <a href="/signup" onClick={() => setMobileNavOpen(false)}
              className="text-xs font-semibold px-2.5 py-2.5 rounded-[10px] mt-1 text-white text-center"
              style={{ background: "var(--forest)" }}>
              Start free
            </a>
          </div>
        )}
      </nav>

      {/* ── Page body ───────────────────────────────────────────────────── */}
      <div className="max-w-[1100px] mx-auto px-4 py-10">
        <StaleCandidatesBanner version={historyVersion} />
        <DashboardPanel version={historyVersion} onCleared={() => { setHistoryVersion((v) => v + 1); setAnalysesUsed(0); setTemplates([]); toast("Your data has been deleted"); }} />

        {/* Current analysis name — shows what was set in the wizard, with a
            way to jump back into it without losing the job text already
            chosen. */}
        {analysisName && !result && !loading && (
          <div className="card px-5 py-3 mb-6 flex items-center justify-between gap-3">
            <p className="text-xs" style={{ color: "#5a7a6a" }}>
              Analysing as <span className="font-semibold" style={{ color: "#13201b" }}>{analysisName}</span>
            </p>
            <button type="button" onClick={() => setFlowDone(false)}
              className="text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors shrink-0"
              style={{ border: "1px solid var(--border)", color: "#5a7a6a" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--mist)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              Edit name / job
            </button>
          </div>
        )}

        {!result && !loading && showOnboarding && (
          <div className="card px-6 py-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
            {[
              { n: "1", label: "Upload a CV" },
              { n: "2", label: "Paste the job description" },
              { n: "3", label: "Get a match score in seconds" },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2.5">
                <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: "var(--mint)", color: "var(--forest)" }}>{s.n}</span>
                <span className="text-xs" style={{ color: "#5a7a6a" }}>{s.label}</span>
                {i < 2 && <span className="hidden sm:block text-[#c8d8ce]">→</span>}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── LEFT: Input card ─────────────────────────────────────────── */}
          <div className="card p-8">

            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-lg font-semibold text-[#13201b] tracking-tight leading-tight"
                  style={{ fontFamily: "var(--font-display)" }}>
                  {compareMode ? "Compare a second candidate" : "Score a candidate"}
                </h1>
                <p className="text-[#5a7a6a] text-xs mt-1">
                  {compareMode
                    ? "Drop a second CV to compare against the same role."
                    : "Upload a CV and job spec — get a match score in seconds."}
                </p>
              </div>
              <a href="/bulk"
                className="shrink-0 ml-3 text-[11px] px-3 py-1.5 rounded-[10px] transition-colors font-medium"
                style={{ border: "1px solid var(--border)", color: "#5a7a6a" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                Bulk upload
              </a>
            </div>

            {rerunBanner && (
              <div className="mb-5 flex items-start gap-2 px-3.5 py-3 rounded-[10px] text-xs"
                style={{ background: "#eef6f1", border: "1px solid var(--border-soft)", color: "#0b6e4f" }}>
                <span className="shrink-0 mt-0.5">✎</span>
                <span>
                  Re-scoring the same CV (<span className="font-semibold">{file?.name}</span>). Adjust the job
                  spec or requirements below, then hit Analyse — no need to re-upload.
                </span>
              </div>
            )}

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("cv-input").click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById("cv-input").click(); } }}
              aria-label="Upload CV file"
              className="rounded-[10px] p-7 text-center mb-5 cursor-pointer select-none transition-all"
              style={{
                border: `2px dashed ${dragOver ? "var(--forest)" : file ? "var(--forest)" : "var(--border)"}`,
                background: dragOver ? "var(--mint)" : file ? "#f0f9f4" : "var(--mist)",
              }}>
              <input id="cv-input" type="file" accept={ACCEPTED_CV_INPUT_ACCEPT} className="hidden"
                onChange={handleFileChange} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                    style={{ background: "var(--mint)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <polyline points="9 15 11 17 15 13"/>
                    </svg>
                  </div>
                  <p className="text-xs font-semibold truncate px-4 max-w-full" style={{ color: "var(--forest)" }}>{file.name}</p>
                  <p className="text-[10px]" style={{ color: "#5a7a6a" }}>Click to change</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <UploadIcon className="text-[#b0c4ba] mb-1" />
                  <p className="text-xs font-semibold" style={{ color: "#13201b" }}>Drop CV here or click to upload</p>
                  <p className="text-[10px]" style={{ color: "#5a7a6a" }}>PDF or Word (.doc, .docx) · max 10 MB</p>
                </div>
              )}
            </div>

            <p className="text-[10px] mb-5 flex items-center gap-1.5" style={{ color: "#8aaa9a" }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              CV data is processed securely, held in the EU, and never used to train AI. Delete anytime.
            </p>

            {duplicateWarning && (
              <div className="mb-5 flex items-start gap-2 px-3.5 py-3 rounded-[10px] text-[11px]"
                style={{ background: "#fef3e8", border: "1px solid #fbdcb4", color: "#92400e" }}>
                <span className="shrink-0 mt-0.5">↻</span>
                <span className="flex-1">{duplicateWarning}</span>
                <button type="button" onClick={() => setDuplicateWarning(null)}
                  aria-label="Dismiss duplicate warning" className="shrink-0" style={{ color: "#b45309" }}>✕</button>
              </div>
            )}

            {!compareMode && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="job-desc" className="text-xs font-semibold" style={{ color: "#13201b" }}>
                    Job description
                  </label>
                  <div className="flex items-center gap-2">
                    {templates.length > 0 && (
                      <button type="button" onClick={() => setShowTemplates((v) => !v)}
                        aria-expanded={showTemplates}
                        className="text-[10px] transition-colors font-medium"
                        style={{ color: "var(--forest)" }}>
                        {showTemplates ? "Hide" : `Templates (${templates.length})`}
                      </button>
                    )}
                    {jobText.trim() && (
                      <button type="button" onClick={saveCurrentJobSpec}
                        className="text-[10px] px-2 py-0.5 rounded-[6px] transition-colors"
                        style={{ color: "#5a7a6a", border: "1px solid var(--border)" }}>
                        + Save spec
                      </button>
                    )}
                  </div>
                </div>

                {showTemplates && templates.length > 0 && (
                  <div className="mb-3 rounded-[10px] overflow-hidden"
                    style={{ border: "1px solid var(--border-soft)" }}>
                    {templates.map((t) => (
                      <div key={t.id || t.savedAt}
                        className="flex items-center gap-2 px-3 py-2 border-b last:border-0 transition-colors"
                        style={{ borderColor: "var(--border-soft)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--mist)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <button type="button" onClick={() => loadTemplate(t)} className="flex-1 text-left text-xs truncate" style={{ color: "#13201b" }}>
                          {t.name}
                        </button>
                        <span className="text-[10px] shrink-0" style={{ color: "#b0c4ba" }}>{t.uses}×</span>
                        <button type="button" onClick={() => deleteTemplate(t)} aria-label={`Delete template ${t.name}`}
                          className="text-[10px] shrink-0 px-1 hover:text-red-500 transition-colors" style={{ color: "#b0c4ba" }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <textarea id="job-desc" ref={jobTextRef} value={jobText} onChange={(e) => setJobText(e.target.value)}
                  placeholder="Paste the full job description here… (Ctrl+Enter to analyse)"
                  rows={6}
                  className="w-full p-3.5 text-xs mb-5 resize-none outline-none transition-all"
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-input)",
                    color: "#13201b",
                    background: "var(--bg)",
                    fontFamily: "var(--font-body)",
                  }}
                  onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)"}
                  onBlur={e => e.target.style.boxShadow = "none"} />

                <div className="mb-5">
                  <label htmlFor="client-email" className="text-xs font-semibold block mb-1.5" style={{ color: "#13201b" }}>
                    Client contact email <span className="font-normal" style={{ color: "#8aaa9a" }}>(optional)</span>
                  </label>
                  <input id="client-email" type="email" value={jobClientEmail}
                    onChange={(e) => setJobClientEmail(e.target.value)}
                    placeholder="client@company.com"
                    className="w-full p-3 text-xs outline-none transition-all"
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-input)",
                      color: "#13201b",
                      background: "var(--bg)",
                      fontFamily: "var(--font-body)",
                    }}
                    onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)"}
                    onBlur={e => e.target.style.boxShadow = "none"} />
                  <p className="text-[10px] mt-1.5" style={{ color: "#8aaa9a" }}>
                    Lets you send shortlist updates and feedback chasers straight from a scored candidate.
                  </p>
                </div>
              </>
            )}

            {compareMode && (
              <p className="text-xs mb-5 px-3.5 py-3 rounded-[10px]"
                style={{ color: "#5a7a6a", background: "var(--mist)", border: "1px solid var(--border-soft)" }}>
                Reusing the same job description — drop a second CV and hit Analyse.
              </p>
            )}

            {!compareMode && (
              <label className="flex items-center gap-3 mb-5 cursor-pointer group">
                <button type="button" role="switch" aria-checked={blindMode}
                  onClick={() => setBlindMode((v) => !v)}
                  className="w-9 h-5 rounded-full transition-colors relative flex-shrink-0"
                  style={{ background: blindMode ? "var(--forest)" : "var(--border)" }}>
                  <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm"
                    style={{ transform: blindMode ? "translateX(18px)" : "translateX(2px)" }} />
                </button>
                <span className="text-xs transition-colors" style={{ color: "#5a7a6a" }}>
                  Blind screening — hide name, location &amp; university
                </span>
              </label>
            )}

            {!compareMode && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="req-input" className="text-xs font-semibold" style={{ color: "#13201b" }}>
                    Must-have requirements
                  </label>
                  {requirements.length > 0 && (
                    <button type="button" onClick={() => setRequirements([])}
                      className="text-[10px] transition-colors"
                      style={{ color: "#b0c4ba" }}>
                      Clear all
                    </button>
                  )}
                </div>
                <p className="text-[10px] mb-2" style={{ color: "#8aaa9a" }}>
                  Plain English. e.g. "has managed a team", "worked somewhere regulated". Press Enter to add.
                </p>
                <input
                  id="req-input"
                  value={reqDraft}
                  onChange={(e) => setReqDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && reqDraft.trim()) {
                      setRequirements([...requirements, reqDraft.trim()]);
                      setReqDraft("");
                    }
                  }}
                  placeholder="Type a requirement and press Enter…"
                  className="w-full text-xs outline-none transition-all mb-2"
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-input)",
                    padding: "10px 14px",
                    color: "#13201b",
                    background: "var(--bg)",
                    fontFamily: "var(--font-body)",
                  }}
                  onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)"}
                  onBlur={e => e.target.style.boxShadow = "none"}
                />
                {requirements.length > 0 && (
                  <ul className="space-y-1.5">
                    {requirements.map((r, i) => (
                      <li key={i}
                        className="flex items-center justify-between text-xs rounded-[8px] px-3 py-1.5"
                        style={{ background: "var(--mint)", border: "1px solid var(--border-soft)" }}>
                        <span style={{ color: "#13201b" }}>{r}</span>
                        <button
                          type="button"
                          onClick={() => setRequirements(requirements.filter((_, j) => j !== i))}
                          aria-label={`Remove requirement: ${r}`}
                          className="ml-3 shrink-0 text-[10px] transition-colors"
                          style={{ color: "#8aaa9a" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#dc2626"}
                          onMouseLeave={e => e.currentTarget.style.color = "#8aaa9a"}>
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {loading && (
              <div className="mb-5 rounded-[10px] p-4 space-y-1"
                style={{ background: "var(--mist)", border: "1px solid var(--border-soft)" }}>
                {STAGES.map((s, i) => (
                  <div key={i}
                    className={`flex items-center gap-3 py-1 transition-opacity duration-300 ${i > stage ? "opacity-20" : ""}`}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors"
                      style={{
                        background: i < stage ? "var(--forest)" : i === stage ? "var(--mint)" : "var(--border)",
                        color: i < stage ? "white" : i === stage ? "var(--forest)" : "#b0c4ba",
                      }}>
                      {i < stage ? "✓" : ""}
                    </div>
                    <span className={`text-xs ${i === stage ? "font-semibold" : ""}`}
                      style={{ color: i === stage ? "#13201b" : "#5a7a6a" }}>
                      {s}{i === stage ? "…" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!compareMode && (
              <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
                <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 shrink-0" />
                <span className="text-[10px] leading-relaxed" style={{ color: "#8aaa9a" }}>
                  I have a lawful basis (e.g. candidate consent or legitimate interest under GDPR) to screen this
                  CV with AI.
                </span>
              </label>
            )}

            {!showUpgrade && analysesUsed < FREE_ANALYSES_LIMIT && (
              <p className="text-[10px] mb-2 text-center" style={{ color: "#8aaa9a" }}>
                {FREE_ANALYSES_LIMIT - analysesUsed} of {FREE_ANALYSES_LIMIT} free analyses left
              </p>
            )}

            <button type="button" onClick={() => handleAnalyse({ rerun: rerunBanner })} disabled={loading}
              className="w-full font-semibold py-3.5 rounded-[10px] transition-all text-xs"
              style={{
                background: loading ? "var(--border)" : compareMode ? "#2563eb" : "var(--forest)",
                color: loading ? "#8aaa9a" : "white",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 14px -4px rgba(11,110,79,0.4)",
                fontFamily: "var(--font-body)",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = compareMode ? "#1d4ed8" : "var(--forest-deep)"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = compareMode ? "#2563eb" : "var(--forest)"; }}>
              {loading ? "Analysing…" : compareMode ? "Analyse second candidate" : rerunBanner ? "Re-analyse with tweaks" : "Analyse candidate"}
            </button>

            {error && (
              <div role="alert"
                className="mt-3 p-3.5 rounded-[10px] text-xs flex items-start gap-2"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                <span className="shrink-0 mt-0.5">⚠</span>
                <span className="flex-1">{error}</span>
                {file && jobText.trim() && (
                  <button type="button" onClick={handleRetryAnalyse}
                    className="shrink-0 text-[11px] font-semibold underline underline-offset-2">
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Results ────────────────────────────────────────────── */}
          <div>

            {!result && !loading && (
              <div className="card p-10 flex flex-col items-center justify-center text-center min-h-72">
                <EmptyScoreRing />
                <p className="mt-5 text-sm font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
                  Your score will appear here
                </p>
                <p className="text-[11px] mt-2 max-w-[200px] leading-relaxed" style={{ color: "#5a7a6a" }}>
                  Upload a CV and paste a role description to see the score, strengths, and evidence behind it.
                </p>
                <p className="text-[10px] mt-4" style={{ color: "#b0c4ba" }}>Tip: Ctrl+Enter to analyse · ←/→ to switch tabs once scored</p>
              </div>
            )}

            {loading && (
              <div className="card p-10 flex flex-col items-center justify-center text-center min-h-72">
                <div className="w-9 h-9 rounded-full border-[3px] animate-spin mb-5"
                  style={{ borderColor: "var(--border)", borderTopColor: "var(--forest)" }} />
                <p className="text-xs" style={{ color: "#5a7a6a" }}>
                  {compareMode ? "Analysing second candidate…" : isRerun ? "Re-scoring with your tweaks…" : "Running analysis…"}
                </p>
              </div>
            )}

            {/* Results — delegates the candidate-detail tabs entirely to
                CandidateResult (single source of truth, shared with bulk
                upload). Only page-specific extras live here. */}
            {result && !loading && (
              <div className="space-y-4">

                {/* Page-specific action row — confidence flag, client summary
                    copy, and re-run — sits above the shared component instead
                    of duplicating its score header. */}
                <div className="card px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    {result.confidence && result.confidence !== "High" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "#fef3e8", color: "#b45309" }}>
                        {result.confidence} confidence
                      </span>
                    )}
                    <button type="button" onClick={handleCopyClientSummary}
                      className="text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors"
                      style={{ border: "1px solid var(--border)", color: "#5a7a6a" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--mist)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      Copy client-ready summary
                    </button>
                  </div>
                  <button type="button" onClick={handleRerunWithTweaks}
                    className="shrink-0 text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors"
                    style={{ background: "var(--mint)", color: "var(--forest)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#d5ebe0"}
                    onMouseLeave={e => e.currentTarget.style.background = "var(--mint)"}>
                    ✎ Re-run with tweaks
                  </button>
                </div>

                {floorCapped && (
                  <div className="card px-5 py-3 text-[11px] flex items-start gap-2"
                    style={{ background: "#fef3e8", color: "#92400e", border: "1px solid #fbdcb4" }}>
                    <span className="shrink-0 mt-0.5">ⓘ</span>
                    <span>
                      This score was capped by our floor check{capReason ? ` — ${capReason}` : ""}. If the CV looks
                      stronger than the number suggests, check the Evidence tab for what was discounted.
                    </span>
                  </div>
                )}

                {/* Shared candidate view — score ring, tabs (Overview, Skills,
                    Experience, Evidence, Prep, Contact, Pipeline) */}
                <CandidateResult result={result} candidateId={candidateId} toast={toast} />

                {/* Must-have requirements — page-specific, since it's tied to
                    the requirements the recruiter typed on the left. Not part
                    of CandidateResult because bulk upload doesn't collect
                    per-CV custom requirements the same way today. */}
                {reqTotal > 0 && (
                  <div className="card px-6 py-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#5a7a6a" }}>Must-have requirements</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{
                          background: metCount === reqTotal ? "var(--mint)" : metCount === 0 ? "#fef2f2" : "#fef3e8",
                          color: metCount === reqTotal ? "var(--forest)" : metCount === 0 ? "#dc2626" : "#b45309",
                        }}>
                        {metCount}/{reqTotal}
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {result.requirements_met.map((r, i) => (
                        <li key={i} className="text-xs">
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 mt-0.5 font-semibold"
                              style={{ color: r.met ? "var(--forest)" : "#b0c4ba" }}>
                              {r.met ? "✓" : "✗"}
                            </span>
                            <div>
                              <span className="font-semibold" style={{ color: "#13201b" }}>{r.requirement}</span>
                              {r.evidence && (
                                <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "#8aaa9a" }}>
                                  {r.evidence}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Email drafting + sending — page-specific, tied to
                    candidateId + jobId. Drafting calls /api/draft-email;
                    sending calls the new /api/send-email endpoint using the
                    saved artifact so the copy that gets emailed always
                    matches whatever the recruiter last edited. */}
                <div className="card px-6 py-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#5a7a6a" }}>Draft &amp; send email</p>
                    <select value={emailPurpose} aria-label="Email purpose"
                      onChange={(e) => { setEmailPurpose(e.target.value); setEmailDraft(null); }}
                      className="text-[11px] px-2.5 py-1 rounded-[8px] outline-none transition-all"
                      style={{
                        border: "1px solid var(--border)",
                        color: "#13201b",
                        background: "var(--bg)",
                        fontFamily: "var(--font-body)",
                      }}>
                      <option value="invite_to_interview">Invite to interview</option>
                      <option value="client_shortlist_update">Client shortlist update</option>
                      <option value="rejection">Rejection</option>
                      <option value="chase_feedback">Chase client feedback</option>
                    </select>
                  </div>
                  {!emailDraft && (
                    <button type="button" onClick={generateEmail} disabled={emailLoading}
                      className="w-full font-semibold py-2.5 rounded-[10px] text-xs transition-all"
                      style={{
                        border: `1px solid var(--forest)`,
                        color: "var(--forest)",
                        background: "transparent",
                        opacity: emailLoading ? 0.5 : 1,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {emailLoading ? "Drafting…" : "Draft email"}
                    </button>
                  )}
                  {emailDraft && (
                    <div>
                      <textarea value={emailEdited} onChange={(e) => { setEmailEdited(e.target.value); setSent(false); }} rows={10}
                        aria-label="Email draft"
                        className="w-full p-3.5 text-xs resize-none outline-none mb-3 transition-all"
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-input)",
                          color: "#13201b",
                          background: "var(--bg)",
                          fontFamily: "var(--font-body)",
                        }}
                        onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)"}
                        onBlur={e => e.target.style.boxShadow = "none"} />

                      <div className="flex gap-2 mb-4">
                        <button type="button" onClick={handleCopyEmail}
                          className="flex-1 text-xs font-semibold py-2.5 rounded-[10px] transition-all text-white"
                          style={{ background: "var(--forest)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--forest-deep)"}
                          onMouseLeave={e => e.currentTarget.style.background = "var(--forest)"}>
                          {emailCopied ? "Copied!" : "Copy and use"}
                        </button>
                        <button type="button" onClick={() => { setEmailDraft(null); generateEmail(); }}
                          className="px-3 text-xs rounded-[10px] transition-all"
                          style={{ border: "1px solid var(--border)", color: "#5a7a6a" }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--mist)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          Regenerate
                        </button>
                      </div>

                      {/* ── Send email ────────────────────────────────────── */}
                      <div className="pt-4" style={{ borderTop: "1px solid var(--border-soft)" }}>
                        <label htmlFor="recipient-email" className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "#5a7a6a" }}>
                          Send to
                        </label>
                        <input
                          id="recipient-email"
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => { setRecipientEmail(e.target.value); setSent(false); }}
                          placeholder={isClientFacingEmail ? "client@company.com" : "candidate@email.com"}
                          className="w-full p-3 text-xs mb-2 outline-none transition-all"
                          style={{
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-input)",
                            color: "#13201b",
                            background: "var(--bg)",
                            fontFamily: "var(--font-body)",
                          }}
                          onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)"}
                          onBlur={e => e.target.style.boxShadow = "none"}
                        />
                        {isClientFacingEmail && !jobClientEmail && !recipientEmail && (
                          <p className="text-[10px] mb-2" style={{ color: "#b45309" }}>
                            No client email saved for this job — enter one above to send.
                          </p>
                        )}
                        <button type="button" onClick={handleSendEmail} disabled={sending || !recipientEmail.trim()}
                          className="w-full text-xs font-semibold py-2.5 rounded-[10px] transition-all text-white"
                          style={{
                            background: sending ? "var(--border)" : sent ? "#0b6e4f" : "#2563eb",
                            cursor: sending || !recipientEmail.trim() ? "not-allowed" : "pointer",
                            opacity: !recipientEmail.trim() && !sending ? 0.6 : 1,
                          }}
                          onMouseEnter={e => { if (!sending && recipientEmail.trim()) e.currentTarget.style.background = sent ? "#0b6e4f" : "#1d4ed8"; }}
                          onMouseLeave={e => { if (!sending && recipientEmail.trim()) e.currentTarget.style.background = sent ? "#0b6e4f" : "#2563eb"; }}>
                          {sending ? "Sending…" : sent ? "✓ Sent" : "Send email"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Feedback — always visible, independent of tab */}
                <div className="card px-6 py-5">
                  {!feedbackSent ? (
                    <>
                      <p className="text-[10px] mb-3 font-medium uppercase tracking-wide" style={{ color: "#5a7a6a" }}>
                        Did this match your read?
                      </p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => submitFeedback("up")}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold transition-all"
                          style={{
                            background: feedback === "up" ? "var(--forest)" : "var(--mist)",
                            color: feedback === "up" ? "white" : "#13201b",
                            border: `1px solid ${feedback === "up" ? "var(--forest)" : "var(--border)"}`,
                          }}>
                          👍 Accurate
                        </button>
                        <button type="button" onClick={() => setShowReasonPicker((v) => !v)}
                          aria-expanded={showReasonPicker}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold transition-all"
                          style={{
                            background: showReasonPicker ? "#dc2626" : "var(--mist)",
                            color: showReasonPicker ? "white" : "#13201b",
                            border: `1px solid ${showReasonPicker ? "#dc2626" : "var(--border)"}`,
                          }}>
                          👎 Not quite
                        </button>
                      </div>
                      {showReasonPicker && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {FEEDBACK_DOWN_REASONS.map((r) => (
                            <button key={r} type="button" onClick={() => submitFeedback("down", r)}
                              className="text-[10px] px-2.5 py-1.5 rounded-full transition-colors"
                              style={{ background: "var(--mist)", border: "1px solid var(--border-soft)", color: "#5a7a6a" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                              onMouseLeave={e => e.currentTarget.style.background = "var(--mist)"}>
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                      <FeedbackTrustNote version={feedbackVersion} />
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-semibold" style={{ color: "var(--forest)" }}>
                        ✓ Thanks — helps us improve{feedbackReason ? ` (noted: ${feedbackReason})` : ""}
                      </p>
                      <FeedbackTrustNote version={feedbackVersion} />
                    </>
                  )}
                </div>

                {/* Compare */}
                {!compareMode && !compareResult && (
                  <div className="card px-6 py-4">
                    <button type="button" onClick={() => setCompareMode(true)}
                      className="w-full text-xs font-semibold py-2.5 rounded-[10px] transition-all"
                      style={{ border: "1px solid var(--border)", color: "#5a7a6a" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--mist)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      ⇄ Compare with another candidate
                    </button>
                  </div>
                )}
                {compareMode && !compareResult && (
                  <div className="card px-6 py-4">
                    <p className="text-xs text-center" style={{ color: "#5a7a6a" }}>
                      Drop a second CV above and hit{" "}
                      <span className="font-semibold" style={{ color: "#2563eb" }}>Analyse second candidate</span>
                    </p>
                  </div>
                )}
                {compareResult && (
                  <ComparePanel result={result} compareResult={compareResult}
                    onClose={() => { setCompareMode(false); setCompareResult(null); }} />
                )}

                {/* Reset */}
                <div className="card px-5 py-3">
                  <button type="button" onClick={handleReset}
                    className="w-full text-xs py-2 rounded-[10px] transition-all"
                    style={{ color: "#5a7a6a" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--mist)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    ← Start a new candidate (clears CV, job spec &amp; requirements)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Upgrade modal ───────────────────────────────────────────────── */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
          <div ref={upgradeModalRef} className="bg-white rounded-[14px] p-8 max-w-sm w-full text-center"
            style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-raise)" }}>
            <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--mint)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 id="upgrade-title" className="text-base font-semibold mb-2 tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              Free trial complete
            </h2>
            <p className="text-xs mb-6 leading-relaxed" style={{ color: "#5a7a6a" }}>
              You&apos;ve used your 3 free analyses. Upgrade to continue — plans from £149/month.
            </p>
            <div className="space-y-2.5">
              <a href="YOUR-SOLO-STRIPE-LINK"
                className="block w-full font-bold py-3 rounded-[10px] text-xs transition-all text-white"
                style={{ background: "var(--forest)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--forest-deep)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--forest)"}>
                Solo — £149 / month
              </a>
              <a href="YOUR-TEAM-STRIPE-LINK"
                className="block w-full font-semibold py-3 rounded-[10px] text-xs transition-all"
                style={{ border: "1px solid var(--border)", color: "#13201b" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--mist)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                Team — £349 / month
              </a>
            </div>
            <button type="button" onClick={() => setShowUpgrade(false)}
              className="mt-4 text-[11px] transition-colors" style={{ color: "#5a7a6a" }}>
              Maybe later
            </button>
          </div>
        </div>
      )}
    </main>
  );
}