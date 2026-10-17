"use client";

// /analyse - one workspace instead of the old wizard that handed over to a
// second copy of the same form. Three states for a single CV:
//   setup   - role on the left, candidate on the right, one Analyse button
//   running - focused progress while /api/run works
//   report  - the assessment as a document, with an action rail beside it
// plus Bulk mode (BulkFlow) for many CVs against one role.

import { track } from "@/lib/analytics/track";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import posthog from "@/lib/analytics/posthog";
import DashboardNav from "@/components/DashboardNav";
import { getJobs } from "@/lib/dashboard-api";
import { useResource } from "@/lib/hooks/useResource";
import { splitViewHref } from "@/lib/workspace/panes";
import RoleCard from "./_components/RoleCard";
import CandidateCard from "./_components/CandidateCard";
import RunningPanel from "./_components/RunningPanel";
import CvPane from "./_components/CvPane";
import { SAMPLE_CV_NAME, SAMPLE_CV_PATH, SAMPLE_REQUIREMENTS, SAMPLE_ROLE } from "@/lib/screening/sample";
import Report from "./_components/Report";
import BulkFlow from "./_components/BulkFlow";
import { StageCard, NotesCard, EmailCard, FeedbackCard } from "./_components/Rail";
import PhoneActionBar from "@/components/dashboard/PhoneActionBar";
import { updateCandidateStage } from "@/lib/dashboard-api";
import { printSection } from "@/lib/ui/print";
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
} from "./_lib/analyse";
import { initialWorkspace, roleModeFor, workspaceReducer } from "./_lib/workspace-state";
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
        <div role="menu" className="absolute right-0 top-[40px] z-30 min-w-[240px] rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-lg py-1.5">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-14 text-[var(--ink)] hover:bg-[var(--mint)] focus-visible:bg-[var(--mint)] outline-none"
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

// A stable empty list while saved jobs load.
const NO_JOBS = [];

export default function AnalyseWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toasts, toast } = useToasts();

  const [mode, setMode] = useState(() => (searchParams?.get("mode") === "bulk" ? "bulk" : "single"));

  // The job, the candidate, the run and its report: one reducer
  // (_lib/workspace-state.js), so the changes that touch several at once are
  // named and tested there.
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspace);
  const {
    existingJobId,
    prefilledJob,
    jobText,
    jobFile,
    requirements,
    roleDraft,
    clientEmail,
    file,
    compareFile,
    reference,
    blind,
    loading,
    step,
    error,
    result,
    candidateId,
    duplicate,
    jobId,
    jobTitle,
    comparing,
    rerunning,
    scoreId,
    feedback,
  } = state;
  const set = useCallback((field) => (value) => dispatch({ type: "set", field, value }), []);

  const { data: savedJobs = NO_JOBS, loading: jobsLoading, error: jobsError } = useResource("jobs", getJobs);
  useEffect(() => {
    if (jobsError) reportQuietly(jobsError);
  }, [jobsError]);
  const roleMode = roleModeFor(state, savedJobs.length);

  const [consent, setConsentState] = useState(false);
  // The CV side panel: null when closed, else { skill } to scroll to.
  const [cvPane, setCvPane] = useState(null);
  const closeCvPane = useCallback(() => setCvPane(null), []);
  // The sample run (lib/screening/sample.js): idle | loading | ready | error.
  // "ready" while the sample CV is the one chosen; any other CV ends it.
  const [sampleStatus, setSampleStatus] = useState("idle");
  const autoRunRef = useRef(false);
  // The report's candidate's stage, held here so the rail's stage card and
  // the phone action bar move them in step. A new analysis starts at
  // "Screened" (see app/api/run).
  const [heldStage, setHeldStage] = useState({ id: null, stage: "Screened" });

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

  // /analyse?jobId=... from a job's page pre-selects that job - once: the
  // saved jobs load again in the background (a cached list shows first), and
  // that mustn't undo what the person has done since.
  useEffect(() => {
    const targetId = searchParams?.get("jobId");
    if (!targetId || !savedJobs.length || prefilledJob) return;
    const match = savedJobs.find((j) => j.id === targetId);
    if (!match) return;
    const t = setTimeout(() => dispatch({ type: "prefillJob", job: match }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the jobs arrive
  }, [savedJobs]);

  // Progress steps advance on a timer while the request is in flight.
  useEffect(() => {
    if (!loading) return undefined;
    const t = setInterval(() => dispatch({ type: "tick", lastStep: RUN_STEPS.length - 1 }), 6000);
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
  // The sample is fictional, so it needs no lawful basis (the server checks
  // it really is the sample before skipping that).
  const sampleRun = sampleStatus === "ready" && !comparing && file?.name === SAMPLE_CV_NAME;
  const missing = !roleReady
    ? "Add the job - pick a saved one, build one, paste an advert or upload a spec."
    : !activeFile
      ? "Add the candidate's CV."
      : !consent && !sampleRun
        ? "Confirm your lawful basis to continue."
        : null;
  const canAnalyse = !missing && !loading;

  // ── Handlers ──────────────────────────────────────────────────────────
  function onJobFile(chosen) {
    if (!chosen) {
      dispatch({ type: "jobFile", file: null });
      return;
    }
    const problem = jobFileProblem(chosen);
    if (problem) {
      dispatch({ type: "detachJob" });
      toast(problem, "error");
      return;
    }
    if (isTextFile(chosen)) {
      dispatch({ type: "jobFile", file: null });
      const reader = new FileReader();
      reader.onload = (e) => dispatch({ type: "jobTextFromFile", text: String(e.target?.result || "") });
      reader.readAsText(chosen);
    } else {
      dispatch({ type: "jobFile", file: chosen });
    }
  }

  function onCvFile(chosen) {
    if (!chosen) return;
    setSampleStatus("idle");
    const problem = cvFileProblem(chosen);
    if (problem) {
      toast(problem, "error");
      return;
    }
    dispatch({ type: "cvFile", file: chosen });
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

  // "Try a sample CV": the sample role and CV filled in, then screened for
  // real, so a new account sees a whole report before uploading anything.
  async function startSample() {
    setSampleStatus("loading");
    try {
      const res = await fetch(SAMPLE_CV_PATH);
      if (!res.ok) throw new Error(String(res.status));
      const cv = new File([await res.blob()], SAMPLE_CV_NAME, { type: "application/pdf" });
      dispatch({ type: "jobTextFromFile", text: SAMPLE_ROLE });
      dispatch({ type: "set", field: "requirements", value: SAMPLE_REQUIREMENTS });
      dispatch({ type: "cvFile", file: cv });
      autoRunRef.current = true;
      setSampleStatus("ready");
      track("sample_screening_started");
    } catch {
      setSampleStatus("error");
      toast("Couldn't load the sample CV. Please try again.", "error");
    }
  }

  async function analyse(opts = {}) {
    const isCompare = comparing;
    const cv = isCompare ? compareFile : file;
    if (!cv || !roleReady || (!consent && !sampleRun)) return;
    lastRunRef.current = opts;

    const startedAt = Date.now();
    dispatch({ type: "runStarted" });

    const form = new FormData();
    form.append("cv", cv);
    form.append("jobText", jobText);
    if (jobFile && !jobId) form.append("jobFile", jobFile);
    if (clientEmail.trim()) form.append("clientEmail", clientEmail.trim());
    form.append("blind", blind ? "true" : "false");
    // Recorded with the analysis - the lawful-basis checkbox is required to get
    // here, except for the fictional sample.
    form.append("lawfulBasisConfirmed", consent ? "true" : "false");
    if (sampleRun && !isCompare) form.append("sample", "true");
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
        dispatch({ type: "runFailed", error: data?.error || failureMessage(response.status) });
        return;
      }

      if (isCompare) {
        // Both candidates are saved now - open the full side-by-side page.
        dispatch({ type: "stopComparing" });
        const q = new URLSearchParams({ ids: [candidateId, data.candidateId].filter(Boolean).join(",") });
        if (data.jobId || jobId) q.set("jobId", data.jobId || jobId);
        router.push(`/analyse/compare?${q.toString()}`);
      } else {
        dispatch({ type: "analysed", data });
        resetEmail();
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
      dispatch({ type: "runFailed", error: "Network error - check your connection and try again." });
    } finally {
      const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      dispatch({ type: "runFinished" });
    }
  }

  const analyseRef = useRef(analyse);
  useEffect(() => {
    analyseRef.current = analyse;
  });
  const showSetup = !result || comparing || rerunning;
  const stage = heldStage.id === candidateId ? heldStage.stage : "Screened";
  const setStage = useCallback((next) => setHeldStage({ id: candidateId, stage: next }), [candidateId]);

  async function shortlistFromBar() {
    if (!candidateId || stage === "Shortlisted") return;
    const previous = stage;
    setStage("Shortlisted");
    try {
      await updateCandidateStage(candidateId, "Shortlisted");
      toast("Moved to Shortlisted");
    } catch {
      setStage(previous);
      toast("Couldn't update the stage - try again", "error");
    }
  }

  // The sample starts itself once its role and CV are in.
  useEffect(() => {
    if (!autoRunRef.current || !sampleRun || !roleReady || loading) return undefined;
    autoRunRef.current = false;
    const t = setTimeout(() => analyseRef.current(), 0);
    return () => clearTimeout(t);
  }, [sampleRun, roleReady, loading]);

  // /analyse?sample=1, from the first-run checklist on the overview.
  useEffect(() => {
    if (searchParams?.get("sample") !== "1") return undefined;
    const t = setTimeout(() => startSample(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);
  const emptySetup = !comparing && !rerunning && !file && !jobFile && !existingJobId && !jobText.trim() && sampleStatus !== "loading";

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
    setSampleStatus("idle");
    dispatch({ type: "startNew" });
    resetEmail();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newCandidateSameRole() {
    setSampleStatus("idle");
    dispatch({ type: "nextCandidate", savedJobIds: savedJobs.map((j) => j.id) });
    resetEmail();
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    dispatch({ type: "feedbackSent", rating, reason });
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
                <button type="button" onClick={startNew} className="inline-flex items-center gap-1 text-14 font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] mb-1.5">
                  <Icon name="arrowLeft" size={14} /> Screen another CV
                </button>
                <h1 className="text-24 font-semibold tracking-tight text-[var(--ink)] leading-tight font-display">
                  Screening report
                </h1>
              </>
            ) : (
              <>
                <h1 className="text-24 font-semibold tracking-tight text-[var(--ink)] leading-tight font-display">
                  {comparing ? "Compare a second candidate" : rerunning ? "Re-score candidate" : "Screen a CV"}
                </h1>
                <p className="text-15 text-[var(--ink-soft)] mt-1">
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
                  { label: "Re-score", icon: "refresh", onSelect: () => set("rerunning")(true) },
                  { label: "Upload a CV to compare", icon: "compare", onSelect: () => set("comparing")(true) },
                  jobId && candidateId && {
                    label: "Compare everyone for this role",
                    icon: "layers",
                    onSelect: () => router.push(`/analyse/compare?jobId=${jobId}&ids=${candidateId}`),
                  },
                  candidateId && {
                    label: "Open side by side",
                    icon: "compare",
                    onSelect: () => router.push(splitViewHref([candidateId])),
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
          <RunningPanel fileName={activeFile?.name} roleLabel={roleLabel} step={step} compare={comparing} requirements={requirements} />
        ) : showSetup ? (
          <>
            {error && (
              <Notice
                tone="error"
                className="mb-5"
                onDismiss={() => set("error")(null)}
                action={
                  <button type="button" onClick={() => analyse(lastRunRef.current)} className="font-semibold underline underline-offset-2 shrink-0">
                    Try again
                  </button>
                }
              >
                {error}
              </Notice>
            )}
            {emptySetup && (
              <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-[var(--mint-line)] bg-[var(--mint)] px-5 py-4">
                <span className="w-10 h-10 rounded-btn bg-[var(--bg)] border border-[var(--mint-line)] flex items-center justify-center text-[var(--forest)] shrink-0" aria-hidden="true">
                  <Icon name="file" size={18} />
                </span>
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-15 font-semibold text-[var(--ink)]">See it work on a sample CV first</p>
                  <p className="text-14 text-[var(--ink-soft)]">A fictional warehouse team leader, scored against a sample role. About a minute, nothing to upload.</p>
                </div>
                <Button variant="primary" size="sm" icon="arrowRight" onClick={startSample}>
                  Try a sample CV
                </Button>
              </div>
            )}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start">
              {comparing ? (
                <Card className="px-5 py-5">
                  <p className="text-13 font-medium text-[var(--ink-soft)]">Job</p>
                  <p className="text-15 font-semibold text-[var(--ink)] mt-1">{roleLabel || "Same role as before"}</p>
                  <p className="text-14 text-[var(--ink-soft)] mt-2">
                    Comparing against <span className="text-[var(--ink)] font-medium">{result?.blind_mode ? "the blind-screened candidate" : result?.name || "the first candidate"}</span> ({result?.match_score}/100).
                  </p>
                  <Button size="sm" variant="ghost" className="mt-3 -ml-2" onClick={() => dispatch({ type: "stopComparing" })} icon="arrowLeft">
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
                  setMode={(mode) => dispatch({ type: "roleMode", mode })}
                  roleDraft={roleDraft}
                  setRoleDraft={set("roleDraft")}
                  onSelectSavedJob={(job) => dispatch({ type: "selectSavedJob", job })}
                  onJobTextChange={(text) => dispatch({ type: "roleText", text })}
                  onJobFile={onJobFile}
                  onSaveTemplate={saveTemplate}
                  requirements={requirements}
                  setRequirements={set("requirements")}
                  clientEmail={clientEmail}
                  setClientEmail={set("clientEmail")}
                  disabled={jobsLoading && roleMode === "saved"}
                />
              )}
              <div className="lg:sticky lg:top-[76px]">
                <CandidateCard
                  file={activeFile}
                  onFile={onCvFile}
                  previous={previous}
                  reference={reference}
                  setReference={set("reference")}
                  blind={blind}
                  setBlind={set("blind")}
                  consent={consent}
                  setConsent={setConsent}
                  canAnalyse={canAnalyse}
                  missing={missing}
                  onAnalyse={() => analyse({ rerun: rerunning })}
                  rerunOf={rerunning ? file?.name : null}
                  onCancelRerun={() => set("rerunning")(false)}
                  compare={comparing}
                />
                {rerunning && (
                  <Button size="sm" variant="ghost" className="mt-2" icon="arrowLeft" onClick={() => set("rerunning")(false)}>
                    Back to the report
                  </Button>
                )}
              </div>
            </div>
            {/* On a phone the Screen button is far down the page, under the role. */}
            <PhoneActionBar watchId="screen-candidate-button" label="Screen candidate">
              <p className="min-w-0 flex-1 text-13 leading-snug text-[var(--ink-soft)]">{missing || "Ready to screen."}</p>
              <Button variant="primary" disabled={!canAnalyse} onClick={() => analyse({ rerun: rerunning })} iconRight="arrowRight">
                {comparing ? "Screen and compare" : rerunning ? "Re-score" : "Screen"}
              </Button>
            </PhoneActionBar>
          </>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
            <div id="analysis-report" className="space-y-5 min-w-0">
              {duplicate && (
                <div
                  role="status"
                  className="print-hide rounded-xl px-4 py-3 text-14 border"
                  style={duplicate.sameJobCandidateId
                    ? { background: "var(--ui-warn-soft)", borderColor: "var(--warn-line)", color: "var(--ui-warn)" }
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
              {sampleRun && candidateId && (
                <Notice tone="info" className="print-hide">
                  Amy Clarke is fictional. She&apos;s saved to your pipeline as a sample candidate so you can see the rest of Helixon - delete her from{" "}
                  <Link href={`/dashboard/candidates/${candidateId}`} className="font-semibold underline underline-offset-2">
                    her profile
                  </Link>{" "}
                  any time. Ready for a real one?{" "}
                  <button type="button" onClick={startNew} className="font-semibold underline underline-offset-2">
                    Screen your own CV
                  </button>
                </Notice>
              )}
              <Report result={result} roleLabel={roleLabel} candidateId={candidateId} onShowInCv={candidateId && !result.blind_mode ? (skill) => setCvPane({ skill }) : null} />
            </div>
            <aside className="space-y-4 lg:sticky lg:top-[76px]" aria-label="Actions">
              {candidateId && !result.blind_mode && (
                <Button variant="secondary" size="sm" icon="file" className="w-full" onClick={() => setCvPane({ skill: null })}>
                  View the CV
                </Button>
              )}
              <Button variant="secondary" size="sm" icon="printer" className="w-full" onClick={() => printSection("analysis-report")}>
                Print / save as PDF
              </Button>
              {candidateId && <StageCard key={`stage-${candidateId}`} candidateId={candidateId} toast={toast} stage={stage} onStageChange={setStage} />}
              {candidateId && <NotesCard key={`notes-${candidateId}`} candidateId={candidateId} toast={toast} />}
              <EmailCard email={email} />
              <FeedbackCard feedback={{ ...feedback, submit: submitFeedback }} />
              <p className="text-13 text-[var(--ink-faint)] px-1">
                Saved to your pipeline.{" "}
                <Link href="/dashboard/candidates" className="font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
                  All candidates
                </Link>
              </p>
            </aside>
            {candidateId && (
              <PhoneActionBar label="Candidate actions">
                {!result.blind_mode && (
                  <Button variant="secondary" icon="file" onClick={() => setCvPane({ skill: null })}>
                    CV
                  </Button>
                )}
                <Button variant="secondary" icon="plus" onClick={newCandidateSameRole} className="flex-1">
                  Next
                </Button>
                <Button variant="primary" icon="check" disabled={stage === "Shortlisted"} onClick={shortlistFromBar} className="flex-1">
                  {stage === "Shortlisted" ? "Shortlisted" : "Shortlist"}
                </Button>
              </PhoneActionBar>
            )}
            {cvPane && candidateId && (
              <CvPane
                key={`${candidateId}-${cvPane.skill || ""}`}
                candidateId={candidateId}
                name={result.name && result.name !== "Candidate" ? result.name : ""}
                quotes={result.skill_evidence || []}
                focusSkill={cvPane.skill}
                onClose={closeCvPane}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
