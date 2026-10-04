"use client";

// /analyse - one workspace instead of the old wizard that handed over to a
// second copy of the same form. Three states for a single CV:
//   setup   - role on the left, candidate on the right, one Analyse button
//   running - focused progress while /api/run works
//   report  - the assessment as a document, with an action rail beside it
// plus Bulk mode (BulkFlow) for many CVs against one role.

import { track } from "@/lib/analytics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import posthog from "@/lib/posthog";
import DashboardNav from "@/components/DashboardNav";
import { getJobs } from "@/lib/dashboard-api";
import RoleCard from "./_components/RoleCard";
import CandidateCard from "./_components/CandidateCard";
import RunningPanel from "./_components/RunningPanel";
import Report from "./_components/Report";
import BulkFlow from "./_components/BulkFlow";
import { StageCard, NotesCard, EmailCard, FeedbackCard } from "./_components/Rail";
import { printSection } from "@/lib/print";
import { BUTTON_BASE, BUTTON_SIZES, BUTTON_VARIANTS, Button, Card, Icon, Notice, Segmented, Toasts, cx, useToasts } from "./_components/ui";
import {
  MIN_LOADING_MS,
  RUN_STEPS,
  SCORING_VERSION,
  cvFileProblem,
  findPreviousAnalysis,
  isTextFile,
  jobFileProblem,
  ls,
  lsSet,
  recordAnalysis,
  savedJobText,
} from "./_lib/analyse";
import { EMPTY_ROLE_DRAFT } from "./_lib/roles";
import { useEmailComposer } from "./_lib/useEmailComposer";
import { reportQuietly } from "@/lib/report-error";

// When the server doesn't say what went wrong, say what most likely did,
// from the status - not one "Something went wrong" for every failure.
function failureMessage(status) {
  if (status === 413) return "That file is too large to analyse. Try a smaller PDF or Word (.docx) file.";
  if (status === 429) return "You've run a lot of analyses in a short time. Wait a minute, then try again.";
  if (status === 408 || status === 504) return "The analysis took too long to finish. Long CVs and specs sometimes do; trying again usually works.";
  if (status >= 500) return "Our analysis service had a problem with this one. Try again in a moment, and contact us if it keeps happening.";
  return "Something went wrong analysing this candidate. Please try again.";
}

function redirectForStatus(response, data) {
  if (response.status === 402 || data?.upgrade) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load on purpose: it drops all client state after sign-out, account deletion or an expired session
    window.location.assign("/pricing?reason=subscription_required");
    return true;
  }
  if (response.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load on purpose: it drops all client state after sign-out, account deletion or an expired session
    window.location.assign("/login?next=%2Fanalyse");
    return true;
  }
  return false;
}

// A small disclosure menu for the report's secondary actions. Escape or a
// click outside closes it, and focus goes back to the button.
function MoreActions({ actions }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    function onPointer(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    wrapRef.current?.querySelector("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(BUTTON_BASE, BUTTON_SIZES.sm, BUTTON_VARIANTS.secondary)}
      >
        More
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[40px] z-30 min-w-[240px] rounded-[12px] bg-white border border-[var(--border)] shadow-lg py-1.5">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[14px] text-[var(--ink)] hover:bg-[var(--mint)] focus-visible:bg-[var(--mint)] outline-none"
            >
              <Icon name={a.icon} size={15} />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalyseWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toasts, toast } = useToasts();

  const [mode, setMode] = useState(() => (searchParams?.get("mode") === "bulk" ? "bulk" : "single"));

  // ── Role ──────────────────────────────────────────────────────────────
  const [savedJobs, setSavedJobs] = useState([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [roleMode, setRoleMode] = useState("paste");
  const [existingJobId, setExistingJobId] = useState(null);
  const [prefilledJob, setPrefilledJob] = useState(null);
  const [jobText, setJobText] = useState("");
  const [jobFile, setJobFile] = useState(null);
  const [requirements, setRequirements] = useState([]);
  // The "Build it" form's answers - kept here so they survive switching
  // between methods and coming back for the next candidate.
  const [roleDraft, setRoleDraft] = useState(EMPTY_ROLE_DRAFT);
  const [clientEmail, setClientEmail] = useState("");

  // ── Candidate ─────────────────────────────────────────────────────────
  const [file, setFile] = useState(null);
  const [compareFile, setCompareFile] = useState(null);
  const [reference, setReference] = useState("");
  const [blind, setBlind] = useState(false);
  const [consent, setConsentState] = useState(false);

  // ── Run / result ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [candidateId, setCandidateId] = useState(null);
  // Set when this CV belongs to someone already on file (api/run links them).
  const [duplicate, setDuplicate] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [jobTitle, setJobTitle] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  // ── Email / feedback ──────────────────────────────────────────────────
  // The analysis the thumbs up/down rates (scores.id from /api/run).
  const [scoreId, setScoreId] = useState(null);
  const [feedback, setFeedback] = useState({ sent: false, rating: null, reason: null });
  const { email, reset: resetEmail } = useEmailComposer({
    candidateId,
    jobId,
    candidateEmail: result?.email || null,
    clientEmail,
    toast,
    handleStatus: redirectForStatus,
  });

  const lastRunRef = useRef({});

  // Consent is remembered per browser once given - it's a standing
  // confirmation about the agency's lawful basis, not per-CV busywork.
  useEffect(() => {
    const t = setTimeout(() => setConsentState(ls("analyseConsent", false) === true), 0);
    return () => clearTimeout(t);
  }, []);
  const setConsent = useCallback((value) => {
    setConsentState(value);
    lsSet("analyseConsent", value);
  }, []);

  useEffect(() => {
    getJobs()
      .then((jobs) => {
        setSavedJobs(jobs);
        if (jobs.length) setRoleMode((m) => (m === "paste" ? "saved" : m));
      })
      .catch(reportQuietly)
      .finally(() => setJobsLoaded(true));
  }, []);

  const selectSavedJob = useCallback((job) => {
    setExistingJobId(job.id);
    setJobText(savedJobText(job));
    setJobFile(null);
    if (job.client_email && !clientEmail) setClientEmail(job.client_email);
  }, [clientEmail]);

  // /analyse?jobId=... from a job's page pre-selects that job.
  useEffect(() => {
    const targetId = searchParams?.get("jobId");
    if (!targetId || !savedJobs.length) return;
    const match = savedJobs.find((j) => j.id === targetId);
    if (!match) return;
    const t = setTimeout(() => {
      setPrefilledJob(match);
      setRoleMode("saved");
      selectSavedJob(match);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only once jobs have loaded
  }, [savedJobs]);

  // Progress steps advance on a timer while the request is in flight.
  useEffect(() => {
    if (!loading) return undefined;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, RUN_STEPS.length - 1)), 6000);
    return () => clearInterval(t);
  }, [loading]);

  const roleLabel = useMemo(() => {
    if (jobTitle) return jobTitle;
    const saved = savedJobs.find((j) => j.id === existingJobId);
    if (saved) return saved.title;
    if (jobFile) return jobFile.name;
    const first = jobText.trim().split("\n")[0]?.trim().replace(/^job title:\s*/i, "");
    return first ? (first.length > 60 ? `${first.slice(0, 60)}…` : first) : null;
  }, [jobTitle, savedJobs, existingJobId, jobFile, jobText]);

  const roleReady = !!jobFile || jobText.trim().length >= 50;
  const activeFile = comparing ? compareFile : file;
  const missing = !roleReady
    ? "Add the job - pick a saved one, build one, paste an advert or upload a spec."
    : !activeFile
      ? "Add the candidate's CV."
      : !consent
        ? "Confirm your lawful basis to continue."
        : null;
  const canAnalyse = !missing && !loading;

  // ── Handlers ──────────────────────────────────────────────────────────
  function onRoleText(value) {
    setJobText(value);
    // Editing the text means it's no longer exactly the saved job.
    if (existingJobId) setExistingJobId(null);
    setJobTitle(null);
  }

  function onRoleModeChange(next) {
    setRoleMode(next);
    if (next !== "saved" && existingJobId) {
      setExistingJobId(null);
      setJobTitle(null);
    }
  }

  function onJobFile(chosen) {
    setExistingJobId(null);
    setJobTitle(null);
    if (!chosen) {
      setJobFile(null);
      return;
    }
    const problem = jobFileProblem(chosen);
    if (problem) {
      toast(problem, "error");
      return;
    }
    if (isTextFile(chosen)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setJobText(String(e.target?.result || ""));
        setRoleMode("paste");
      };
      reader.readAsText(chosen);
      setJobFile(null);
    } else {
      setJobFile(chosen);
      setJobText("");
    }
  }

  function onCvFile(chosen) {
    if (!chosen) return;
    const problem = cvFileProblem(chosen);
    if (problem) {
      toast(problem, "error");
      return;
    }
    setError(null);
    if (comparing) setCompareFile(chosen);
    else setFile(chosen);
  }

  function saveTemplate() {
    const text = jobText.trim();
    if (!text) return;
    const templates = ls("jobTemplates", []);
    const firstLine = text.split("\n")[0].replace(/^job title:\s*/i, "");
    const name = firstLine.slice(0, 60) + (firstLine.length > 60 ? "…" : "");
    lsSet("jobTemplates", [{ id: crypto.randomUUID(), name, text, savedAt: new Date().toISOString(), uses: 0 }, ...templates].slice(0, 20));
    toast("Saved to your templates");
  }

  async function analyse(opts = {}) {
    const isCompare = comparing;
    const cv = isCompare ? compareFile : file;
    if (!cv || !roleReady || !consent) return;
    lastRunRef.current = opts;

    const startedAt = Date.now();
    setLoading(true);
    setStep(0);
    setError(null);

    const form = new FormData();
    form.append("cv", cv);
    form.append("jobText", jobText);
    if (jobFile && !jobId) form.append("jobFile", jobFile);
    if (clientEmail.trim()) form.append("clientEmail", clientEmail.trim());
    form.append("blind", blind ? "true" : "false");
    // Recorded with the analysis - the lawful-basis checkbox is required to get here.
    form.append("lawfulBasisConfirmed", consent ? "true" : "false");
    form.append("requirements", JSON.stringify(requirements));
    // Re-runs and comparisons reuse the job the first analysis created, so
    // they don't each add another copy of the same role.
    const attachJobId = existingJobId || (isCompare || rerunning ? jobId : null);
    if (attachJobId) form.append("jobId", attachJobId);

    try {
      const response = await fetch("/api/run", { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (redirectForStatus(response, data)) return;

      if (!data?.ok) {
        // Without this, failed analyses were invisible in analytics: only
        // successes were recorded, so the failure rate couldn't be seen.
        track("analysis_failed", { status: response.status, comparison: isCompare, cv_file_type: cv.type || "unknown" });
        setError(data?.error || failureMessage(response.status));
        return;
      }

      if (isCompare) {
        // Both candidates are saved now - open the full side-by-side page.
        setComparing(false);
        setCompareFile(null);
        const q = new URLSearchParams({ ids: [candidateId, data.candidateId].filter(Boolean).join(",") });
        if (data.jobId || jobId) q.set("jobId", data.jobId || jobId);
        router.push(`/analyse/compare?${q.toString()}`);
      } else {
        setResult(data.result);
        setCandidateId(data.candidateId);
        setDuplicate(data.duplicate || null);
        setJobId(data.jobId);
        setScoreId(data.scoreId || null);
        setJobTitle(data.job?.title || null);
        resetEmail();
        setFeedback({ sent: false, rating: null, reason: null });
        setRerunning(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if (posthog.__loaded) {
        posthog.capture("analysis_completed", {
          rerun: !!opts.rerun,
          comparison: isCompare,
          blind_mode: blind,
          job_source: jobFile ? "file" : existingJobId ? "saved" : "text",
          cv_file_type: cv.type || "unknown",
          requirements_count: requirements.length,
          scoring_version: SCORING_VERSION,
        });
      }

      recordAnalysis({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        analysisName: reference || null,
        cvName: cv.name,
        matchScore: data.result.match_score,
        recommendation: data.result.recommendation,
        summary: data.result.summary,
        rerun: !!opts.rerun,
        scoringVersion: SCORING_VERSION,
      });
    } catch {
      track("analysis_failed", { status: "network", comparison: isCompare, cv_file_type: cv.type || "unknown" });
      setError("Network error - check your connection and try again.");
    } finally {
      const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setLoading(false);
    }
  }

  const analyseRef = useRef(analyse);
  useEffect(() => {
    analyseRef.current = analyse;
  });
  const showSetup = !result || comparing || rerunning;

  // Ctrl/Cmd+Enter analyses from the setup view.
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && mode === "single" && showSetup && canAnalyse) {
        e.preventDefault();
        analyseRef.current({ rerun: rerunning });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, showSetup, canAnalyse, rerunning]);

  function startNew() {
    setResult(null);
    setCandidateId(null);
    setDuplicate(null);
    setJobId(null);
    setJobTitle(null);
    setFile(null);
    setCompareFile(null);
    setComparing(false);
    setRerunning(false);
    setReference("");
    setScoreId(null);
    resetEmail();
    setFeedback({ sent: false, rating: null, reason: null });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newCandidateSameRole() {
    // Keep the role (and attach to the job the last analysis created).
    const keepJobId = existingJobId || jobId;
    startNew();
    if (keepJobId) {
      setExistingJobId(keepJobId);
      if (savedJobs.some((j) => j.id === keepJobId)) setRoleMode("saved");
    }
  }

  async function copySummary() {
    if (!result) return;
    const lines = [
      `Candidate: ${result.blind_mode ? "Blind-screened candidate" : result.name || "Candidate"}`,
      roleLabel ? `Role: ${roleLabel}` : "",
      `Match score: ${result.match_score}/100 - ${result.recommendation}`,
      result.summary ? `\n${result.summary}` : "",
      result.standout_factors?.length ? `\nStandout:\n${result.standout_factors.map((i) => `• ${i}`).join("\n")}` : "",
      result.missing_required?.length ? `\nMissing (required):\n${result.missing_required.map((i) => `• ${i}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      toast("Client-ready summary copied");
    } catch {
      toast("Couldn't access the clipboard", "error");
    }
  }

  async function submitFeedback(rating, reason = null, expectedBand = null) {
    setFeedback({ sent: true, rating, reason });
    lsSet("feedbackCount", ls("feedbackCount", 0) + 1);
    if (posthog.__loaded) posthog.capture("analysis_feedback_submitted", { rating, reason });
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, reason, scoreId, expectedBand }),
      });
    } catch {
      // Feedback is best-effort.
    }
  }

  const previous = useMemo(() => (activeFile ? findPreviousAnalysis(activeFile) : null), [activeFile]);

  // ── Render ────────────────────────────────────────────────────────────
  const inReport = mode === "single" && result && !showSetup && !loading;

  return (
    <main className="min-h-screen bg-[var(--mist)]">
      <DashboardNav />
      <Toasts toasts={toasts} />

      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-7 sm:py-9">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div className="min-w-0">
            {inReport ? (
              <>
                <button type="button" onClick={startNew} className="inline-flex items-center gap-1 text-[13.5px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] mb-1.5">
                  <Icon name="arrowLeft" size={14} /> Screen another CV
                </button>
                <h1 className="text-[24px] font-semibold tracking-tight text-[var(--ink)] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  Screening report
                </h1>
              </>
            ) : (
              <>
                <h1 className="text-[24px] font-semibold tracking-tight text-[var(--ink)] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {comparing ? "Compare a second candidate" : rerunning ? "Re-score candidate" : "Screen a CV"}
                </h1>
                <p className="text-[14.5px] text-[var(--ink-soft)] mt-1">
                  {mode === "bulk"
                    ? "Score a whole batch of CVs against one role."
                    : comparing
                      ? "Same role, a different CV - you'll see the two side by side."
                      : "Score a CV against a role and get the evidence behind it."}
                </p>
              </>
            )}
          </div>

          {inReport ? (
            // Five equal buttons made every action look as likely as the
            // next. The two that keep a screening session moving stay out;
            // re-scoring and comparing go under "More".
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon="copy" onClick={copySummary}>
                Copy summary
              </Button>
              <MoreActions
                actions={[
                  { label: "Re-score", icon: "refresh", onSelect: () => setRerunning(true) },
                  { label: "Upload a CV to compare", icon: "compare", onSelect: () => setComparing(true) },
                  jobId && candidateId && {
                    label: "Compare everyone for this role",
                    icon: "layers",
                    onSelect: () => router.push(`/analyse/compare?jobId=${jobId}&ids=${candidateId}`),
                  },
                ].filter(Boolean)}
              />
              <Button size="sm" variant="dark" icon="plus" onClick={newCandidateSameRole}>
                Next candidate
              </Button>
            </div>
          ) : (
            !loading &&
            !comparing &&
            !rerunning && (
              <Segmented
                value={mode}
                onChange={setMode}
                ariaLabel="Analysis mode"
                options={[
                  { value: "single", label: "Single CV", icon: "file" },
                  { value: "bulk", label: "Bulk", icon: "layers" },
                ]}
              />
            )
          )}
        </header>

        {mode === "bulk" ? (
          <BulkFlow savedJobs={savedJobs} prefilledJob={prefilledJob} consent={consent} setConsent={setConsent} />
        ) : loading ? (
          <RunningPanel fileName={activeFile?.name} roleLabel={roleLabel} step={step} compare={comparing} />
        ) : showSetup ? (
          <>
            {error && (
              <Notice
                tone="error"
                className="mb-5"
                onDismiss={() => setError(null)}
                action={
                  <button type="button" onClick={() => analyse(lastRunRef.current)} className="font-semibold underline underline-offset-2 shrink-0">
                    Try again
                  </button>
                }
              >
                {error}
              </Notice>
            )}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start">
              {comparing ? (
                <Card className="px-5 py-5">
                  <p className="text-[13px] font-medium text-[var(--ink-soft)]">Job</p>
                  <p className="text-[15px] font-semibold text-[var(--ink)] mt-1">{roleLabel || "Same role as before"}</p>
                  <p className="text-[14px] text-[var(--ink-soft)] mt-2">
                    Comparing against <span className="text-[var(--ink)] font-medium">{result?.blind_mode ? "the blind-screened candidate" : result?.name || "the first candidate"}</span> ({result?.match_score}/100).
                  </p>
                  <Button size="sm" variant="ghost" className="mt-3 -ml-2" onClick={() => { setComparing(false); setCompareFile(null); }} icon="arrowLeft">
                    Back to the report
                  </Button>
                </Card>
              ) : (
                <RoleCard
                  savedJobs={savedJobs}
                  existingJobId={existingJobId}
                  jobText={jobText}
                  jobFile={jobFile}
                  mode={roleMode}
                  setMode={onRoleModeChange}
                  roleDraft={roleDraft}
                  setRoleDraft={setRoleDraft}
                  onSelectSavedJob={(job) => { selectSavedJob(job); setJobTitle(null); }}
                  onJobTextChange={onRoleText}
                  onJobFile={onJobFile}
                  onSaveTemplate={saveTemplate}
                  requirements={requirements}
                  setRequirements={setRequirements}
                  clientEmail={clientEmail}
                  setClientEmail={setClientEmail}
                  disabled={!jobsLoaded && roleMode === "saved"}
                />
              )}
              <div className="lg:sticky lg:top-[76px]">
                <CandidateCard
                  file={activeFile}
                  onFile={onCvFile}
                  previous={previous}
                  reference={reference}
                  setReference={setReference}
                  blind={blind}
                  setBlind={setBlind}
                  consent={consent}
                  setConsent={setConsent}
                  canAnalyse={canAnalyse}
                  missing={missing}
                  onAnalyse={() => analyse({ rerun: rerunning })}
                  rerunOf={rerunning ? file?.name : null}
                  onCancelRerun={() => setRerunning(false)}
                  compare={comparing}
                />
                {rerunning && (
                  <Button size="sm" variant="ghost" className="mt-2" icon="arrowLeft" onClick={() => setRerunning(false)}>
                    Back to the report
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
            <div id="analysis-report" className="space-y-5 min-w-0">
              {duplicate && (
                <div
                  role="status"
                  className="print-hide rounded-[12px] px-4 py-3 text-[14px] border"
                  style={duplicate.sameJobCandidateId
                    ? { background: "#fff8e6", borderColor: "#f1dfb5", color: "#7a4f0a" }
                    : { background: "var(--mint)", borderColor: "var(--border)", color: "var(--ink)" }}
                >
                  {duplicate.sameJobCandidateId ? (
                    <>
                      <strong>Already screened for this job.</strong> This CV matches someone on file (by {duplicate.matchedOn}) who is
                      already in this job&apos;s pipeline, so there are now two records for them here.{" "}
                      <a href={`/dashboard/candidates/${duplicate.sameJobCandidateId}`} className="underline font-semibold">Open the earlier one</a>
                      {" "}- you may want to delete one.
                    </>
                  ) : (
                    <>
                      <strong>Already on file.</strong> This CV matches someone you&apos;ve screened before (by {duplicate.matchedOn}), so
                      it&apos;s been linked to their record - their profile lists every role they&apos;ve been considered for.{" "}
                      <a href={`/dashboard/candidates/${duplicate.candidateId}`} className="underline font-semibold">See their earlier record</a>
                    </>
                  )}
                </div>
              )}
              <Report result={result} roleLabel={roleLabel} />
            </div>
            <aside className="space-y-4 lg:sticky lg:top-[76px]" aria-label="Actions">
              <Button variant="secondary" size="sm" icon="printer" className="w-full" onClick={() => printSection("analysis-report")}>
                Print / save as PDF
              </Button>
              {candidateId && <StageCard key={`stage-${candidateId}`} candidateId={candidateId} toast={toast} />}
              {candidateId && <NotesCard key={`notes-${candidateId}`} candidateId={candidateId} toast={toast} />}
              <EmailCard email={email} />
              <FeedbackCard feedback={{ ...feedback, submit: submitFeedback }} />
              <p className="text-[13px] text-[var(--ink-faint)] px-1">
                Saved to your pipeline.{" "}
                <Link href="/dashboard/candidates" className="font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
                  All candidates
                </Link>
              </p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
