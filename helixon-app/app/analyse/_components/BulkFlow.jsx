"use client";

// Bulk screening: one role, up to BULK_MAX_FILES CVs, each scored exactly
// like a single analysis.
//
// Run order matters: until the role has a job row (a pasted/uploaded role
// gets one from the first successful request), CVs go one at a time so the
// job can be recorded and reused - otherwise concurrent requests would each
// create a duplicate job. After that, BULK_CONCURRENCY workers drain the
// queue. A 429 stops the run and leaves the rest paused for Retry.
//
// CVs can be added one by one or as a .zip (_lib/zip.js). The run is kept
// in this browser as it goes (_lib/bulkRun.js), so a closed tab or dropped
// connection can be resumed instead of starting again.

import { track } from "@/lib/analytics";
import { useEffect, useMemo, useRef, useState } from "react";
import { getJobById } from "@/lib/dashboard-api";
import { downloadCsv } from "@/lib/csv";
import { isZipFile, unzipCvs } from "../_lib/zip";
import { bulkResultRows, clearSavedRun, loadSavedRun, pendingInRun, saveRun, serialiseQueue } from "../_lib/bulkRun";
import { Card, CardHeader, Select, Textarea, Button, Icon, Notice, Switch, cx } from "./ui";
import { MethodPicker, RoleBuilder, SpecChecklist, TemplateGallery } from "./RoleInputs";
import { EMPTY_ROLE_DRAFT, composeRoleText } from "../_lib/roles";
import {
  BULK_CONCURRENCY,
  BULK_MAX_FILES,
  CV_ACCEPT,
  JOB_ACCEPT,
  cvFileProblem,
  formatBytes,
  isTextFile,
  jobFileProblem,
  savedJobText,
  scoreTone,
} from "../_lib/analyse";

const STATUS_LABEL = { queued: "Queued", processing: "Analysing", done: "Done", failed: "Failed", rate_limited: "Paused" };

export default function BulkFlow({ savedJobs, prefilledJob, consent, setConsent }) {
  const [jobPickMode, setJobPickMode] = useState(savedJobs.length > 0 ? "saved" : "paste");
  const [bulkJobId, setBulkJobId] = useState(null);
  const [bulkJobText, setBulkJobText] = useState("");
  const [bulkJobFile, setBulkJobFile] = useState(null);
  const [bulkJobFileName, setBulkJobFileName] = useState(null);
  const [roleDraft, setRoleDraft] = useState(EMPTY_ROLE_DRAFT);
  // Finished candidates ticked for side-by-side comparison (max 4).
  const [compareIds, setCompareIds] = useState([]);
  const [queue, setQueue] = useState([]);
  // On by default for bulk: mass screening with no per-candidate review is
  // exactly where blind screening earns its keep. Still a real toggle.
  const [bulkBlind, setBulkBlind] = useState(true);
  const [running, setRunning] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [unzipping, setUnzipping] = useState(false);
  // An unfinished run from an earlier visit, until resumed or discarded.
  // Nothing new is saved while it's on offer, so it can't be overwritten.
  const [savedRun, setSavedRun] = useState(null);
  const [savedRunChecked, setSavedRunChecked] = useState(false);

  const nextIdRef = useRef(0);
  const abortRef = useRef(false);
  const retryLockRef = useRef(false);
  const resolvedJobRef = useRef({ id: null, text: "" });
  const cvInputRef = useRef(null);
  const jobInputRef = useRef(null);

  useEffect(() => {
    if (!running) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  useEffect(() => {
    let cancelled = false;
    loadSavedRun().then((run) => {
      if (cancelled) return;
      if (run && pendingInRun(run) > 0) setSavedRun(run);
      else if (run) clearSavedRun();
      setSavedRunChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the run as it goes; forget it once nothing is left to analyse.
  useEffect(() => {
    if (!savedRunChecked || savedRun) return undefined;
    const t = setTimeout(() => {
      if (queue.length === 0 || queue.every((it) => it.status === "done")) {
        clearSavedRun();
        return;
      }
      const resolvedId = resolvedJobRef.current.id;
      saveRun({
        savedAt: new Date().toISOString(),
        role: {
          pickMode: jobPickMode,
          jobId: resolvedId || bulkJobId,
          jobText: resolvedId ? resolvedJobRef.current.text : bulkJobText,
          jobFile: resolvedId || bulkJobId ? null : bulkJobFile,
          jobFileName: bulkJobFileName,
        },
        blind: bulkBlind,
        queue: serialiseQueue(queue),
      });
    }, 300);
    return () => clearTimeout(t);
  }, [queue, savedRun, savedRunChecked, jobPickMode, bulkJobId, bulkJobText, bulkJobFile, bulkJobFileName, bulkBlind]);

  function resumeSavedRun() {
    const run = savedRun;
    if (!run) return;
    const role = run.role || {};
    if (role.jobId) {
      resolvedJobRef.current = { id: role.jobId, text: role.jobText || "" };
      setBulkJobId(role.jobId);
      setBulkJobText(role.jobText || "");
      setBulkJobFile(null);
      setBulkJobFileName(null);
      setJobPickMode(savedJobs.some((j) => j.id === role.jobId) ? "saved" : "paste");
    } else if (role.jobFile) {
      setBulkJobFile(role.jobFile);
      setBulkJobFileName(role.jobFileName || role.jobFile.name || null);
      setBulkJobText("");
      setJobPickMode("upload");
    } else {
      setBulkJobText(role.jobText || "");
      setJobPickMode(role.pickMode === "saved" ? "paste" : role.pickMode || "paste");
    }
    setBulkBlind(run.blind !== false);
    const restored = run.queue || [];
    nextIdRef.current = restored.reduce((max, it) => Math.max(max, it.id + 1), 0);
    setQueue(restored);
    setSavedRun(null);
  }

  function discardSavedRun() {
    clearSavedRun();
    setSavedRun(null);
  }

  function selectSavedJob(jobId) {
    const job = savedJobs.find((j) => j.id === jobId);
    setBulkJobId(job?.id || null);
    setBulkJobText(savedJobText(job));
    setBulkJobFile(null);
    setBulkJobFileName(null);
  }

  useEffect(() => {
    if (!prefilledJob) return undefined;
    const t = setTimeout(() => {
      setJobPickMode("saved");
      selectSavedJob(prefilledJob.id);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reacts to prefilledJob arriving
  }, [prefilledJob]);

  function handleBulkJobFile(file) {
    setBulkJobId(null);
    if (!file) {
      setBulkJobFile(null);
      setBulkJobFileName(null);
      return;
    }
    const problem = jobFileProblem(file);
    if (problem) {
      setQueueError(problem);
      return;
    }
    setQueueError(null);
    setBulkJobFileName(file.name);
    if (isTextFile(file)) {
      const reader = new FileReader();
      reader.onload = (event) => setBulkJobText(String(event.target?.result || ""));
      reader.readAsText(file);
      setBulkJobFile(null);
    } else {
      setBulkJobFile(file);
      setBulkJobText("");
    }
  }

  async function addFiles(fileList) {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const rejected = [];
    // Zips are opened here and their CVs join the queue like any other.
    const zips = picked.filter(isZipFile);
    let incoming = picked.filter((f) => !isZipFile(f));
    if (zips.length) {
      setUnzipping(true);
      try {
        for (const zip of zips) {
          const room = Math.max(0, BULK_MAX_FILES - queue.length - incoming.length);
          try {
            const { files, skipped } = await unzipCvs(new Uint8Array(await zip.arrayBuffer()), { limit: room });
            incoming = incoming.concat(files);
            rejected.push(...skipped.map((s) => `${s} in ${zip.name}`));
            if (files.length === 0 && skipped.length === 0) rejected.push(`${zip.name} (no CVs inside)`);
          } catch {
            rejected.push(`${zip.name} (couldn't be opened)`);
          }
        }
      } finally {
        setUnzipping(false);
      }
    }
    const accepted = [];
    incoming.forEach((f) => {
      const problem = cvFileProblem(f);
      if (problem) rejected.push(`${f.name} (${f.size > 10 * 1024 * 1024 ? "over 10 MB" : "not a PDF or DOCX"})`);
      else accepted.push(f);
    });
    setQueue((q) => {
      const room = BULK_MAX_FILES - q.length;
      const toAdd = accepted.slice(0, Math.max(0, room));
      if (accepted.length > toAdd.length) rejected.push(`${accepted.length - toAdd.length} more - a run is capped at ${BULK_MAX_FILES} CVs`);
      return [...q, ...toAdd.map((file) => ({ id: nextIdRef.current++, file, status: "queued", candidateId: null, score: null, name: null, errorMessage: null }))];
    });
    setQueueError(rejected.length ? `Skipped ${rejected.join(", ")}.` : null);
  }

  function toggleCompare(candidateId) {
    setCompareIds((ids) => (ids.includes(candidateId) ? ids.filter((x) => x !== candidateId) : ids.length >= 4 ? ids : [...ids, candidateId]));
  }

  function openCompare(ids) {
    const q = new URLSearchParams({ ids: ids.filter(Boolean).join(",") });
    const jobIdForCompare = resolvedJobRef.current.id || bulkJobId;
    if (jobIdForCompare) q.set("jobId", jobIdForCompare);
    // New tab, so the run's results list stays open here.
    window.open(`/analyse/compare?${q.toString()}`, "_blank", "noopener");
  }

  function updateItem(id, patch) {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  const jobReady = bulkJobId ? true : bulkJobFile ? true : bulkJobText.trim().length >= 50;
  const pendingCount = queue.filter((it) => it.status === "queued" || it.status === "failed").length;
  const doneCount = queue.filter((it) => it.status === "done").length;
  const failedCount = queue.filter((it) => it.status === "failed").length;
  const settledCount = doneCount + failedCount;
  const allSettled = queue.length > 0 && settledCount === queue.length && !running;
  const canStart = jobReady && pendingCount > 0 && !running && consent;

  async function runOne(item, jobIdForRequest, jobTextForRequest, jobFileForRequest) {
    updateItem(item.id, { status: "processing", errorMessage: null });
    const fd = new FormData();
    fd.append("cv", item.file);
    fd.append("blind", bulkBlind ? "true" : "false");
    // Recorded with the analysis (the lawful-basis checkbox above is required to start).
    fd.append("lawfulBasisConfirmed", consent ? "true" : "false");
    fd.append("requirements", "[]");
    fd.append("jobText", jobTextForRequest || "");
    if (jobFileForRequest) fd.append("jobFile", jobFileForRequest);
    if (jobIdForRequest) fd.append("jobId", jobIdForRequest);

    try {
      const res = await fetch("/api/run", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load on purpose: it drops all client state after sign-out, account deletion or an expired session
        window.location.assign("/login?next=%2Fanalyse%3Fmode%3Dbulk");
        return { outcome: "aborted" };
      }
      if (res.status === 402 || data?.upgrade) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load on purpose: it drops all client state after sign-out, account deletion or an expired session
        window.location.assign("/pricing?reason=subscription_required");
        return { outcome: "aborted" };
      }
      if (res.status === 429) {
        updateItem(item.id, { status: "rate_limited", errorMessage: "Hourly analysis limit reached." });
        return { outcome: "rate_limited" };
      }
      if (data?.ok) {
        updateItem(item.id, { status: "done", candidateId: data.candidateId, score: data.result?.match_score ?? null, name: data.result?.name || null, duplicate: data.duplicate || null });
        return { outcome: "ok", jobId: data.jobId };
      }
      updateItem(item.id, { status: "failed", errorMessage: data?.error || "Analysis failed." });
      return { outcome: "failed" };
    } catch {
      updateItem(item.id, { status: "failed", errorMessage: "Network error - check your connection and retry." });
      return { outcome: "failed" };
    }
  }

  async function recordResolvedJob(jobId, jobTextSent) {
    let text = jobTextSent;
    if (!text || text.trim().length < 50) {
      try {
        const job = await getJobById(jobId);
        text = job.job_text || text;
      } catch {
        // A later request that still lacks job text fails clearly on its own.
      }
    }
    resolvedJobRef.current = { id: jobId, text };
    setBulkJobId(jobId);
  }

  async function startBulk() {
    const items = queue.filter((it) => it.status === "queued" || it.status === "failed");
    if (!canStart || !items.length) return;
    // Starting a new run replaces the earlier unfinished one.
    if (savedRun) discardSavedRun();
    setRunning(true);
    setRateLimited(false);
    abortRef.current = false;
    track("bulk_analysis_started", { cv_count: items.length, job_source: bulkJobId ? "saved" : bulkJobFile ? "file" : "text" });
    const tally = { ok: 0, failed: 0 };
    const count = (outcome) => { if (outcome.outcome === "ok") tally.ok++; else if (outcome.outcome !== "aborted") tally.failed++; };

    // A picked saved job is already resolved. Otherwise run CVs one at a
    // time until one succeeds and creates the job, so parallel requests
    // never each create a duplicate job - and a failed first CV doesn't
    // leave the rest with no role to score against.
    if (bulkJobId && !resolvedJobRef.current.id) resolvedJobRef.current = { id: bulkJobId, text: bulkJobText };
    let idx = 0;
    while (!resolvedJobRef.current.id && idx < items.length) {
      const outcome = await runOne(items[idx], null, bulkJobText, bulkJobFile);
      count(outcome);
      idx++;
      if (outcome.outcome === "aborted") {
        setRunning(false);
        return;
      }
      if (outcome.outcome === "rate_limited") {
        setRateLimited(true);
        setRunning(false);
        return;
      }
      if (outcome.outcome === "ok") await recordResolvedJob(outcome.jobId, bulkJobText);
    }

    const { id: resolvedId, text: resolvedText } = resolvedJobRef.current;
    const rest = items.slice(idx);
    let cursor = 0;
    async function worker() {
      while (cursor < rest.length) {
        if (abortRef.current) return;
        const item = rest[cursor++];
        const outcome = await runOne(item, resolvedId, resolvedText, null);
        count(outcome);
        if (outcome.outcome === "aborted") {
          abortRef.current = true;
          return;
        }
        if (outcome.outcome === "rate_limited") {
          abortRef.current = true;
          setRateLimited(true);
          return;
        }
      }
    }
    await Promise.all(Array.from({ length: BULK_CONCURRENCY }, worker));
    setRunning(false);
    track("bulk_analysis_finished", { cv_count: items.length, succeeded: tally.ok, failed: tally.failed, stopped: abortRef.current });
  }

  async function retryOne(id) {
    if (retryLockRef.current || running) return;
    const item = queue.find((it) => it.id === id);
    if (!item) return;
    const alreadyResolved = !!resolvedJobRef.current.id;
    if (!alreadyResolved) retryLockRef.current = true;
    try {
      const jobId = alreadyResolved ? resolvedJobRef.current.id : bulkJobId;
      const jobText = alreadyResolved ? resolvedJobRef.current.text : bulkJobText;
      const result = await runOne(item, jobId, jobText, alreadyResolved ? null : bulkJobFile);
      if (result.outcome === "ok" && !resolvedJobRef.current.id) await recordResolvedJob(result.jobId, jobText);
    } finally {
      retryLockRef.current = false;
    }
  }

  const ranked = useMemo(() => {
    if (!allSettled) return queue;
    return [...queue].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [queue, allSettled]);

  const progress = queue.length ? Math.round((settledCount / queue.length) * 100) : 0;
  const missing = !jobReady ? "Add the role first." : !queue.length ? "Add at least one CV." : !consent ? "Confirm your lawful basis to continue." : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
      <Card className={cx(running && "opacity-60 pointer-events-none")}>
        <CardHeader title="What are you hiring for?" description="Every CV in this run is scored against it - any kind of job." />
        <div className="px-5 pt-4">
          <MethodPicker
            value={jobPickMode}
            onChange={setJobPickMode}
            methods={[...(savedJobs.length ? ["saved"] : []), "build", "paste", "upload", "template"]}
            counts={{ saved: savedJobs.length }}
          />
        </div>
        <div className="px-5 py-4 space-y-4">
          {jobPickMode === "saved" && (
            <Select value={bulkJobId || ""} onChange={(e) => selectSavedJob(e.target.value)} aria-label="Choose a job">
              <option value="">Choose one of your jobs…</option>
              {savedJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                  {j.company ? ` · ${j.company}` : ""}
                </option>
              ))}
            </Select>
          )}
          {jobPickMode === "build" && (
            <RoleBuilder
              draft={roleDraft}
              onChange={(next) => {
                setRoleDraft(next);
                setBulkJobText(composeRoleText(next));
                setBulkJobId(null);
              }}
              onEditAsText={(text) => {
                setBulkJobText(text);
                setBulkJobId(null);
                setJobPickMode("paste");
              }}
            />
          )}
          {jobPickMode === "paste" && (
            <div className="space-y-3">
              <Textarea
                value={bulkJobText}
                onChange={(e) => {
                  setBulkJobText(e.target.value);
                  setBulkJobId(null);
                }}
                rows={9}
                placeholder={"Paste the job advert or description - any format works.\n\nFor example:\nCare Assistant, nights - £12/hour\nSupporting residents with personal care.\nMust have: Enhanced DBS."}
                aria-label="Job description"
              />
              <SpecChecklist text={bulkJobText} />
            </div>
          )}
          {jobPickMode === "upload" && (
            <div>
              <button
                type="button"
                onClick={() => jobInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-[12px] border border-dashed border-[var(--ink-mute)] hover:bg-[var(--mist)] hover:border-[var(--forest)] transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-[10px] bg-[var(--mist)] flex items-center justify-center text-[var(--ink-soft)] shrink-0">
                  <Icon name={bulkJobFileName ? "file" : "upload"} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-[var(--ink)] truncate">{bulkJobFileName || "Choose the job spec"}</span>
                  <span className="block text-[11.5px] text-[var(--ink-faint)]">{bulkJobFileName ? "Click to replace" : "PDF, Word or .txt · up to 10 MB"}</span>
                </span>
              </button>
              <input ref={jobInputRef} type="file" accept={JOB_ACCEPT} className="hidden" onChange={(e) => { handleBulkJobFile(e.target.files?.[0] || null); e.target.value = ""; }} />
            </div>
          )}
          {jobPickMode === "template" && (
            <TemplateGallery
              onPick={(text) => {
                setBulkJobText(text);
                setBulkJobId(null);
                setJobPickMode("paste");
              }}
            />
          )}
          <div className="pt-4 border-t border-[var(--border-soft)] space-y-4">
            <Switch id="bulk-blind" checked={bulkBlind} onChange={setBulkBlind} label="Blind screening" description="Hide names, contact details and institutions when scoring." />
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-[3px] w-4 h-4 shrink-0 accent-[var(--forest)]" />
              <span className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">I have a lawful basis (for example consent or legitimate interest under UK GDPR) to screen these CVs.</span>
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Candidates"
          description={`${queue.length} of ${BULK_MAX_FILES} CVs`}
          action={
            queue.length > 0 && !running && !allSettled ? (
              <Button size="sm" variant="ghost" onClick={() => setQueue((q) => q.filter((it) => it.status !== "queued"))}>
                Clear queued
              </Button>
            ) : null
          }
        />
        <div className="px-5 py-4 space-y-4">
          {savedRun && (
            <Notice tone="info">
              <span className="block">
                You have an unfinished run from{" "}
                {new Date(savedRun.savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}:{" "}
                {(savedRun.queue || []).length - pendingInRun(savedRun)} of {(savedRun.queue || []).length} CVs done.
              </span>
              <span className="flex gap-2 mt-2">
                <Button size="sm" variant="primary" onClick={resumeSavedRun} disabled={running || queue.length > 0}>
                  Pick up where it stopped
                </Button>
                <Button size="sm" variant="ghost" onClick={discardSavedRun}>
                  Discard it
                </Button>
              </span>
              {queue.length > 0 && <span className="block text-[12px] mt-1">Clear the CVs below to pick it up.</span>}
            </Notice>
          )}
          {!running && queue.length < BULK_MAX_FILES && (
            <button
              type="button"
              onClick={() => cvInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                addFiles(e.dataTransfer.files);
              }}
              className={cx(
                "w-full flex flex-col items-center justify-center gap-1.5 rounded-[12px] border border-dashed transition-colors",
                queue.length ? "py-5" : "py-12",
                dragActive ? "border-[var(--forest)] bg-[#f4faf7]" : "border-[var(--ink-mute)] hover:bg-[var(--mist)]"
              )}
            >
              <Icon name="upload" size={18} className="text-[var(--ink-soft)]" />
              <span className="text-[13.5px] font-medium text-[var(--ink)]">{queue.length ? "Add more CVs" : "Drop CVs here, or browse"}</span>
              <span className="text-[12px] text-[var(--ink-faint)]">PDF or Word, up to 10 MB each, or a .zip of them</span>
            </button>
          )}
          <input ref={cvInputRef} type="file" multiple accept={`${CV_ACCEPT},.zip,application/zip`} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          {unzipping && <p className="text-[12.5px] text-[var(--ink-soft)]" role="status">Opening zip…</p>}
          {queueError && <Notice tone="warn" onDismiss={() => setQueueError(null)}>{queueError}</Notice>}

          {(running || settledCount > 0) && (
            <div>
              <div className="flex justify-between text-[12.5px] mb-1.5">
                <span className="text-[var(--ink-soft)]">{running ? "Analysing…" : allSettled ? "Run complete" : "Paused"}</span>
                <span className="tabular-nums text-[var(--ink)]">
                  {settledCount} / {queue.length}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border-soft)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--forest)] transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {rateLimited && (
            <Notice tone="warn">
              Hourly analysis limit reached - {doneCount} of {queue.length} finished. The rest are paused; press Retry on them later.
            </Notice>
          )}
          {doneCount >= 2 && !running && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--mist)] px-3 py-2">
              <span className="text-[12.5px] text-[var(--ink-soft)]">
                {compareIds.length ? `${compareIds.length} of 4 ticked to compare` : "Tick 2-4 candidates to compare them side by side"}
              </span>
              <span className="flex gap-2">
                {compareIds.length === 0 && (
                  <Button size="sm" icon="compare" onClick={() => openCompare(ranked.filter((it) => it.status === "done").slice(0, 3).map((it) => it.candidateId))}>
                    Compare top {Math.min(3, doneCount)}
                  </Button>
                )}
                {compareIds.length > 0 && (
                  <Button size="sm" variant="primary" icon="compare" disabled={compareIds.length < 2} onClick={() => openCompare(compareIds)}>
                    Compare {compareIds.length}
                  </Button>
                )}
              </span>
            </div>
          )}
          {doneCount > 0 && !running && (
            <div className="flex justify-end">
              <Button
                size="sm"
                icon="download"
                onClick={() => downloadCsv(`bulk-screening-${new Date().toISOString().slice(0, 10)}.csv`, bulkResultRows(queue, window.location.origin))}
              >
                Download results (CSV)
              </Button>
            </div>
          )}
          {allSettled && (
            <Notice tone="ok">
              {doneCount} scored{failedCount ? `, ${failedCount} failed` : ""}. Ranked by score below.{" "}
              {bulkJobId && (
                <a href={`/dashboard/jobs/${bulkJobId}`} className="font-semibold underline underline-offset-2">
                  Open the job
                </a>
              )}
            </Notice>
          )}

          {queue.length > 0 && (
            <ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
              {ranked.map((item) => {
                const tone = scoreTone(item.score);
                return (
                  <li key={item.id} className={cx("flex items-center gap-3 py-2.5", item.status === "processing" && "bg-[#f4faf7] -mx-5 px-5")}>
                    {item.status === "done" && item.candidateId && !running ? (
                      <input
                        type="checkbox"
                        checked={compareIds.includes(item.candidateId)}
                        disabled={!compareIds.includes(item.candidateId) && compareIds.length >= 4}
                        onChange={() => toggleCompare(item.candidateId)}
                        aria-label={`Tick ${item.name || item.file.name} to compare`}
                        className="w-4 h-4 shrink-0 accent-[var(--forest)]"
                      />
                    ) : (
                      <Icon name="file" size={15} className="text-[var(--ink-faint)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] text-[var(--ink)] truncate">{item.name || item.file.name}</p>
                      <p className={cx("text-[12px] truncate", item.status === "failed" ? "text-[var(--score-low)]" : "text-[var(--ink-faint)]")}>
                        {item.status === "failed" || item.status === "rate_limited" ? item.errorMessage : item.name ? item.file.name : formatBytes(item.file.size)}
                      </p>
                      {item.duplicate && (
                        <p className="text-[11.5px] truncate" style={{ color: item.duplicate.sameJobCandidateId ? "var(--score-mid)" : "var(--forest)" }}>
                          {item.duplicate.sameJobCandidateId ? "Already in this job's pipeline - check for a duplicate" : "Already on file - linked to their earlier record"}
                        </p>
                      )}
                    </div>
                    {item.status === "done" ? (
                      <a href={`/dashboard/candidates/${item.candidateId}`} className="flex items-center gap-2 group" aria-label={`Open ${item.name || item.file.name}, score ${item.score}`}>
                        <span className="h-6 min-w-[36px] px-1.5 rounded-[6px] text-[12.5px] font-semibold tabular-nums flex items-center justify-center" style={{ background: tone.bg, color: tone.fg }}>
                          {item.score ?? "–"}
                        </span>
                        <Icon name="arrowRight" size={14} className="text-[var(--ink-faint)] group-hover:text-[var(--ink)]" />
                      </a>
                    ) : item.status === "processing" ? (
                      <span className="text-[12px] text-[var(--forest)] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--forest)] animate-pulse motion-reduce:animate-none" /> Analysing
                      </span>
                    ) : (item.status === "failed" || item.status === "rate_limited") && !running ? (
                      <Button size="sm" onClick={() => retryOne(item.id)} icon="refresh">
                        Retry
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className="text-[12px] text-[var(--ink-faint)]">{STATUS_LABEL[item.status]}</span>
                        {item.status === "queued" && !running && (
                          <button type="button" onClick={() => setQueue((q) => q.filter((it) => it.id !== item.id))} aria-label={`Remove ${item.file.name}`} className="p-1 rounded text-[var(--ink-faint)] hover:text-[var(--ink)]">
                            <Icon name="x" size={13} />
                          </button>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div>
            <Button variant="primary" size="lg" className="w-full" disabled={!canStart} onClick={startBulk}>
              {running ? `Analysing ${settledCount + 1 > queue.length ? queue.length : settledCount + 1} of ${queue.length}…` : `Analyse ${pendingCount || ""} candidate${pendingCount === 1 ? "" : "s"}`}
            </Button>
            {missing && !running && <p className="text-[12px] text-center mt-2 text-[var(--ink-faint)]">{missing}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}
