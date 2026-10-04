"use client";

// /dashboard/talent-pool - people the agency has saved for future roles
// (app/api/talent-pool). Each entry carries why they're kept, their
// availability and a date to check in, all editable here.
//
// Every open job is pre-matched against the pool with a quick keyword fit
// (free, instant - lib/talent-pool-match.js): the strip at the top shows
// which jobs the pool could fill, and each person shows their best open
// job. Picking a job ranks everyone by fit; the best can then be screened
// properly in one go from the CVs already on file (app/api/candidates/[id]/
// rescreen) - no re-uploading. ?jobId= deep-links straight to a job;
// ?due=1 opens on the check-ins that are due.

import DashboardNav from "@/components/DashboardNav";
import { Card, Icon, Notice, Spinner, Toasts, cx, useToasts } from "@/app/analyse/_components/ui";
import { PillButton } from "@/app/analyse/_components/compareBits";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bulkUpdateCandidates, getJobs, getTalentPool, removeFromTalentPool, rescreenCandidate, updateTalentPoolEntry } from "@/lib/dashboard-api";
import { downloadCsv } from "@/lib/csv";
import { reportQuietly } from "@/lib/report-error";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { useRouter, useSearchParams } from "next/navigation";
import { useUndoDelete } from "@/components/dashboard/use-undo-delete";
import { Chip, PoolRow } from "./_components/row";
import { AVAILABILITY, todayIso } from "./_components/shared";
import { PoolSkeleton, StatCard } from "./_components/summary";

const SCREEN_CONCURRENCY = 2;

const byCheckIn = (a, b) => {
  const x = a.checkIn || "9999";
  const y = b.checkIn || "9999";
  return x < y ? -1 : x > y ? 1 : 0;
};

const SORTS = {
  recent: { label: "Recently saved", fn: (a, b) => new Date(b.savedAt) - new Date(a.savedAt) },
  checkIn: { label: "Check-in date", fn: byCheckIn },
  bestMatch: { label: "Best open-job match", fn: (a, b) => (b.bestMatch?.fit ?? -1) - (a.bestMatch?.fit ?? -1) },
  experience: { label: "Most experience", fn: (a, b) => (b.yearsExperience ?? -1) - (a.yearsExperience ?? -1) },
  name: { label: "Name A–Z", fn: (a, b) => a.name.localeCompare(b.name) },
  fit: { label: "Best fit for this job", fn: (a, b) => (b.fit ?? -1) - (a.fit ?? -1) },
};

/* ── Page ─────────────────────────────────────────────────────────────── */

const AVAILABILITY_FILTERS = [
  ["all", "Everyone"],
  ["available", "Available"],
  ["open", "Open to offers"],
  ["not_looking", "Not looking"],
  ["due", "Check-in due"],
];

function TalentPoolContent() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("jobId") || "";

  const [jobs, setJobs] = useState([]);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  // ?due=1 (from the Overview's Follow-ups) opens on check-ins that are due.
  const dueOnly = params.get("due") === "1";
  const [availability, setAvailability] = useState(dueOnly ? "due" : "all"); // all | available | open | not_looking | due
  const [skill, setSkill] = useState("");
  const [sortBy, setSortBy] = useState(jobId ? "fit" : dueOnly ? "checkIn" : "recent");

  const [selected, setSelected] = useState([]);
  const [screening, setScreening] = useState({}); // id -> { status, error }
  const [running, setRunning] = useState(false);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const stopRef = useRef(false);
  const { toasts, toast, dismiss } = useToasts();
  const undoable = useUndoDelete(toast);
  const [ask, confirmDialog] = useConfirm();

  useEffect(() => {
    getJobs()
      .then(setJobs)
      .catch(reportQuietly);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getTalentPool({ jobId })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Couldn't load the talent pool.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, reloadKey]);

  // Picking a job ranks by fit; clearing it goes back to the saved order.
  const setJob = useCallback(
    (next) => {
      setSelected([]);
      setScreening({});
      setStatus("loading");
      setSortBy(next ? "fit" : "recent");
      router.replace(next ? `/dashboard/talent-pool?jobId=${next}` : "/dashboard/talent-pool", { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router]
  );

  const job = data?.job || null;
  const allItems = useMemo(() => data?.items || [], [data]);
  const effectiveSort = !job && sortBy === "fit" ? "recent" : sortBy;

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = todayIso();
    const list = allItems.filter((i) => {
      if (availability === "due" ? !(i.checkIn && i.checkIn <= today) : availability !== "all" && i.status !== availability) return false;
      if (skill && !i.skills.some((s) => s.toLowerCase() === skill)) return false;
      if (q && ![i.name, i.currentTitle, i.currentCompany, i.location, i.note, ...i.skills].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort(SORTS[effectiveSort].fn);
  }, [allItems, search, availability, skill, effectiveSort]);

  const counts = useMemo(() => {
    const today = todayIso();
    return {
      all: allItems.length,
      available: allItems.filter((i) => i.status === "available").length,
      open: allItems.filter((i) => i.status === "open").length,
      not_looking: allItems.filter((i) => i.status === "not_looking").length,
      due: allItems.filter((i) => i.checkIn && i.checkIn <= today).length,
    };
  }, [allItems]);

  const pickable = useMemo(() => items.filter((i) => (job ? !i.screened && i.hasCv : true)), [items, job]);
  const filtering = Boolean(search.trim() || skill || availability !== "all");

  function patchItem(id, fields) {
    setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...fields } : i)) }));
  }

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  // Availability, check-in and note, saved as they're changed.
  async function updateEntry(item, fields) {
    const before = { status: item.status, checkIn: item.checkIn, note: item.note, expiresAt: item.expiresAt };
    if (!fields.extend) patchItem(item.id, fields);
    setBusyIds((s) => new Set(s).add(item.id));
    try {
      const saved = await updateTalentPoolEntry(item.id, fields);
      patchItem(item.id, { status: saved.status, checkIn: saved.checkIn, note: saved.note, expiresAt: saved.expiresAt });
      if (fields.extend) toast(`Kept in the pool until ${new Date(saved.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`);
      return true;
    } catch (err) {
      patchItem(item.id, before);
      toast(err.message || "Couldn't save that.", "error");
      return false;
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(item.id);
        return next;
      });
    }
  }

  function removeItem(item) {
    const index = data?.items.findIndex((i) => i.id === item.id) ?? -1;
    undoable({
      key: `pool:${item.id}`,
      message: `${item.name} removed from the pool`,
      hide: () => {
        setData((d) => ({ ...d, total: d.total - 1, items: d.items.filter((i) => i.id !== item.id) }));
        setSelected((s) => s.filter((x) => x !== item.id));
      },
      restore: () =>
        setData((d) => {
          if (!d || d.items.some((i) => i.id === item.id)) return d;
          const items = [...d.items];
          items.splice(index < 0 ? items.length : Math.min(index, items.length), 0, item);
          return { ...d, total: d.total + 1, items };
        }),
      commit: () => removeFromTalentPool(item.id),
    });
  }

  async function bulkAvailability(value) {
    if (!value || selected.length === 0) return;
    setBulkBusy(true);
    const ids = [...selected];
    const next = value === "clear" ? null : value;
    let failedCount = 0;
    for (let i = 0; i < ids.length; i += 4) {
      await Promise.all(
        ids.slice(i, i + 4).map((id) =>
          updateTalentPoolEntry(id, { status: next })
            .then(() => patchItem(id, { status: next }))
            .catch(() => {
              failedCount += 1;
            })
        )
      );
    }
    setBulkBusy(false);
    if (failedCount) toast(`Couldn't update ${failedCount} of them.`, "error");
    else toast(`Updated ${ids.length}`);
  }

  async function bulkRemove() {
    const ids = [...selected];
    const who = `${ids.length} ${ids.length === 1 ? "person" : "people"}`;
    if (!(await ask({ title: `Remove ${who} from the talent pool?`, body: "Their profiles and screenings stay as they are.", confirmLabel: "Remove from pool" }))) return;
    setBulkBusy(true);
    try {
      await bulkUpdateCandidates(ids, { action: "unpool" });
      setData((d) => ({ ...d, total: d.total - ids.length, items: d.items.filter((i) => !ids.includes(i.id)) }));
      setSelected([]);
      toast(`Removed ${ids.length} from the pool`);
    } catch (err) {
      toast(err.message || "Couldn't remove them.", "error");
    } finally {
      setBulkBusy(false);
    }
  }

  // Screens the selection a couple at a time. Each is a full analysis, so a
  // 429 (hourly allowance used up) stops the rest.
  async function screenSelected() {
    if (!job || selected.length === 0) return;
    const queue = selected.filter((id) => pickable.some((p) => p.id === id));
    stopRef.current = false;
    setRunning(true);
    setScreening((s) => ({ ...s, ...Object.fromEntries(queue.map((id) => [id, { status: "queued" }])) }));

    let done = 0;
    async function worker() {
      while (queue.length && !stopRef.current) {
        const id = queue.shift();
        setScreening((s) => ({ ...s, [id]: { status: "running" } }));
        try {
          const r = await rescreenCandidate(id, job.id);
          done += 1;
          const role = { candidateId: r.candidateId, jobId: job.id, jobTitle: job.title, score: r.score, stage: "Screened" };
          setScreening((s) => ({ ...s, [id]: { status: "done" } }));
          setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, screened: role, roles: [...i.roles, role] } : i)) }));
        } catch (err) {
          if (err.status === 409 && err.existingId) {
            setScreening((s) => ({ ...s, [id]: { status: "done" } }));
            patchItem(id, { screened: { candidateId: err.existingId, jobId: job.id, score: null } });
          } else {
            if (err.status === 429) stopRef.current = true;
            setScreening((s) => ({ ...s, [id]: { status: "failed", error: err.message } }));
          }
        }
        setSelected((sel) => sel.filter((x) => x !== id));
      }
    }
    await Promise.all(Array.from({ length: SCREEN_CONCURRENCY }, worker));
    setScreening((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v.status !== "queued")));
    setRunning(false);
    if (stopRef.current && queue.length) toast("Stopped - the rest weren't screened.", "error");
    else if (done) toast(`Screened ${done} for ${job.title}`);
  }

  function exportCsv() {
    downloadCsv(
      `talent-pool-${todayIso()}.csv`,
      items.map((i) => ({
        Name: i.name,
        "Current title": i.currentTitle || "",
        "Current company": i.currentCompany || "",
        Location: i.location || "",
        "Years experience": i.yearsExperience ?? "",
        Availability: AVAILABILITY[i.status]?.label || "",
        "Check in": i.checkIn || "",
        Note: i.note || "",
        Skills: i.skills.join("; "),
        "Best open job": i.bestMatch ? `${i.bestMatch.title} (${i.bestMatch.fit}%)` : "",
        ...(job ? { [`Fit for ${job.title}`]: i.fit ?? "", Screened: i.screened?.score ?? "" } : {}),
        "Screened for": i.roles.map((r) => `${r.jobTitle}${r.score != null ? ` (${r.score})` : ""}`).join("; "),
        Saved: i.savedAt?.slice(0, 10) || "",
        "Saved by": i.savedBy || "",
      }))
    );
  }

  const screenedForJob = useMemo(
    () => allItems.filter((i) => i.screened?.candidateId).sort((a, b) => (b.screened.score ?? -1) - (a.screened.score ?? -1)),
    [allItems]
  );
  const compareHref =
    job && screenedForJob.length >= 2
      ? `/analyse/compare?jobId=${job.id}&ids=${screenedForJob.slice(0, 4).map((i) => i.screened.candidateId).join(",")}`
      : null;

  const openJobsWithPool = data?.openJobs || [];
  const stats = data?.stats;
  const allSelected = pickable.length > 0 && pickable.every((i) => selected.includes(i.id));

  return (
    <main className="min-h-screen bg-[var(--mist)] pb-28">
      <DashboardNav />
      {confirmDialog}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-widest mb-1 text-[var(--ink-faint)]">Candidate database</p>
            <h1 className="text-2xl font-semibold text-[var(--ink)]" style={{ fontFamily: "var(--font-display)" }}>
              Talent pool
            </h1>
            <p className="text-[14px] text-[var(--ink-soft)] mt-1 max-w-2xl">
              People worth keeping for future roles. When a new job comes in, match it against the pool and screen the best from
              the CVs you already have.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data && data.total > 0 && (
              <PillButton icon="clipboard" onClick={exportCsv}>
                Export CSV
              </PillButton>
            )}
            <PillButton href="/dashboard/candidates" icon="plus" primary={Boolean(data) && data.total === 0}>
              Add from Candidates
            </PillButton>
          </div>
        </header>

        {status === "loading" && !data && <PoolSkeleton />}
        {status === "error" && (
          <Notice
            tone="error"
            action={
              <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline">
                Try again
              </button>
            }
          >
            {error}
          </Notice>
        )}

        {status !== "error" && data && data.total === 0 && (
          <Card className="p-8 sm:p-12 text-center">
            <span className="mx-auto w-12 h-12 rounded-full bg-[var(--mint)] text-[var(--forest)] flex items-center justify-center mb-4">
              <Icon name="bookmark" size={20} />
            </span>
            <p className="text-[16px] font-semibold text-[var(--ink)]">Start building your talent pool</p>
            <p className="text-[14px] text-[var(--ink-soft)] mt-1.5 max-w-md mx-auto">
              Save strong candidates who weren&apos;t right this time - from their profile, the report after an analysis, or by selecting
              several on the Candidates list. When a new job comes in, they&apos;re matched to it automatically.
            </p>
            <div className="mt-6 grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
              {[
                ["bookmark", "Save", "Keep anyone worth another look, with a note on why."],
                ["sparkle", "Match", "Every open job is checked against the pool for free."],
                ["refresh", "Screen", "Score the best fits from their CV on file - no re-upload."],
              ].map(([icon, title, body]) => (
                <div key={title} className="rounded-[12px] border border-[var(--border)] p-3.5">
                  <span className="text-[var(--forest)]">
                    <Icon name={icon} size={16} />
                  </span>
                  <p className="text-[14px] font-semibold text-[var(--ink)] mt-1.5">{title}</p>
                  <p className="text-[13px] text-[var(--ink-soft)] mt-0.5">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <PillButton href="/dashboard/candidates" primary icon="arrowRight">
                Go to Candidates
              </PillButton>
            </div>
          </Card>
        )}

        {data && data.total > 0 && (
          <>
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="In the pool" value={stats.total} sub={`${stats.addedLast30} added in the last 30 days`} />
                <StatCard
                  label="Available now"
                  value={stats.available}
                  sub="Available or open to offers"
                  accent="var(--score-strong)"
                  active={availability === "available"}
                  onClick={() => setAvailability((a) => (a === "available" ? "all" : "available"))}
                />
                <StatCard
                  label="Check-ins due"
                  value={stats.checkInsDue}
                  sub={stats.checkInsDue ? "Time to get back in touch" : "Nothing due"}
                  accent={stats.checkInsDue ? "var(--score-low)" : undefined}
                  active={availability === "due"}
                  onClick={() => setAvailability((a) => (a === "due" ? "all" : "due"))}
                />
                <StatCard
                  label="Open jobs with fits"
                  value={openJobsWithPool.filter((j) => j.likely > 0).length}
                  sub={`of ${openJobsWithPool.length} open job${openJobsWithPool.length === 1 ? "" : "s"}`}
                  accent="var(--forest)"
                />
              </div>
            )}

            {job ? (
              <Card className="p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="w-10 h-10 rounded-[10px] bg-[var(--mint)] text-[var(--forest)] flex items-center justify-center shrink-0">
                      <Icon name="briefcase" size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">Matching the pool against</p>
                      <p className="text-[16px] font-semibold text-[var(--ink)] truncate">
                        {job.title}
                        {job.client && <span className="font-normal text-[var(--ink-soft)]"> · {job.client}</span>}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mt-2">
                        {job.requiredSkills.map((s) => (
                          <Chip key={s}>{s}</Chip>
                        ))}
                        {job.minYearsExperience ? <Chip>{job.minYearsExperience}+ yrs</Chip> : null}
                        {job.requiredSkills.length === 0 && !job.minYearsExperience && (
                          <span className="text-[13px] text-[var(--ink-soft)]">
                            No requirements listed on this job, so there&apos;s nothing to pre-check - screening still works.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      value={jobId}
                      onChange={(e) => setJob(e.target.value)}
                      disabled={running}
                      aria-label="Change job"
                      className="text-[13.5px] font-semibold px-3.5 py-2 rounded-full border border-[var(--border)] bg-white max-w-[220px] disabled:opacity-60"
                    >
                      {!jobs.some((j) => j.id === jobId) && <option value={jobId}>{job.title}</option>}
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                          {j.status !== "open" ? " (closed)" : ""}
                        </option>
                      ))}
                    </select>
                    <PillButton href={`/dashboard/jobs/${job.id}`} icon="external">
                      View job
                    </PillButton>
                    {compareHref && (
                      <PillButton href={compareHref} primary icon="compare">
                        Compare top {Math.min(4, screenedForJob.length)}
                      </PillButton>
                    )}
                    <button
                      type="button"
                      onClick={() => setJob("")}
                      disabled={running}
                      aria-label="Stop matching against this job"
                      className="p-2 rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--mist)] disabled:opacity-40"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            ) : (
              openJobsWithPool.length > 0 && (
                <section aria-labelledby="open-jobs-title">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3 mb-2.5">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">Match to a job</p>
                      <h2 id="open-jobs-title" className="text-[15px] font-semibold text-[var(--ink)]">
                        Open jobs you could fill from the pool
                      </h2>
                    </div>
                    <select
                      value=""
                      onChange={(e) => e.target.value && setJob(e.target.value)}
                      aria-label="Match against any job"
                      className="self-start sm:self-auto text-[13px] font-semibold px-3 py-1.5 rounded-full border border-[var(--border)] bg-white"
                    >
                      <option value="">Any job…</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                          {j.status !== "open" ? " (closed)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
                    {openJobsWithPool.slice(0, 12).map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => setJob(j.id)}
                        className="snap-start shrink-0 w-[250px] text-left rounded-[14px] bg-white border border-[var(--border)] p-4 hover:border-[var(--forest)] hover:shadow-[0_6px_20px_-12px_rgba(19,32,27,0.35)] transition"
                      >
                        <p className="text-[14px] font-semibold text-[var(--ink)] truncate">{j.title}</p>
                        <p className="text-[13px] text-[var(--ink-soft)] truncate">{j.client || "No client set"}</p>
                        <div className="flex items-center justify-between mt-3">
                          {j.likely > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[13px] font-semibold px-2 py-0.5 rounded-full bg-[var(--mint)] text-[var(--forest-deep)]">
                              <Icon name="sparkle" size={11} />
                              {j.likely} likely fit{j.likely === 1 ? "" : "s"}
                            </span>
                          ) : (
                            <span className="text-[13px] text-[var(--ink-faint)]">{j.requiredSkills.length ? "No likely fits yet" : "No requirements to check"}</span>
                          )}
                          <span className="text-[13px] font-semibold text-[var(--forest)] inline-flex items-center gap-1">
                            Match <Icon name="arrowRight" size={12} />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )
            )}

            <Card className="overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-[var(--border-soft)] space-y-3">
                <div className="flex flex-col md:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none">
                      <Icon name="search" size={15} />
                    </span>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, role, skill, location or note…"
                      aria-label="Search the talent pool"
                      className="w-full text-[14.5px] pl-10 pr-4 py-2 rounded-full border border-[var(--border)] bg-white text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={skill}
                      onChange={(e) => setSkill(e.target.value)}
                      aria-label="Filter by skill"
                      className="text-[13.5px] font-semibold px-3.5 py-2 rounded-full bg-white min-w-0 flex-1 md:flex-none md:w-44"
                      style={{ border: `1px solid ${skill ? "var(--forest)" : "var(--border)"}` }}
                    >
                      <option value="">Any skill</option>
                      {(data.topSkills || []).map((s) => (
                        <option key={s.label} value={s.label.toLowerCase()}>
                          {s.label} ({s.count})
                        </option>
                      ))}
                    </select>
                    <select
                      value={effectiveSort}
                      onChange={(e) => setSortBy(e.target.value)}
                      aria-label="Sort"
                      className="text-[13.5px] font-semibold px-3.5 py-2 rounded-full border border-[var(--border)] bg-white min-w-0 flex-1 md:flex-none md:w-48"
                    >
                      {Object.entries(SORTS)
                        .filter(([k]) => k !== "fit" || job)
                        .map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
                  {AVAILABILITY_FILTERS.map(([k, label]) => {
                    const on = availability === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setAvailability(k)}
                        aria-pressed={on}
                        className={cx(
                          "shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full border transition-colors",
                          on ? "bg-[var(--forest)] border-[var(--forest)] text-white" : "bg-white border-[var(--border)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                        )}
                      >
                        {AVAILABILITY[k] && <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "white" : AVAILABILITY[k].dot }} />}
                        {label}
                        <span className={cx("text-[12px] tabular-nums px-1.5 rounded-full", on ? "bg-white/25" : "bg-[var(--mist)] text-[var(--ink-faint)]")}>
                          {counts[k]}
                        </span>
                      </button>
                    );
                  })}
                  {filtering && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setSkill("");
                        setAvailability("all");
                      }}
                      className="shrink-0 text-[13px] font-semibold text-[var(--forest)] px-2"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5 bg-[#fbfcfb] border-b border-[var(--border-soft)] text-[13px] text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={pickable.length === 0 || running}
                  onChange={() => setSelected(allSelected ? [] : pickable.map((i) => i.id))}
                  aria-label="Select all shown"
                  className="w-4 h-4 accent-[var(--forest)] disabled:opacity-30"
                />
                <span>
                  {status === "loading" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Spinner size={12} /> Updating…
                    </span>
                  ) : (
                    <>
                      Showing <b className="text-[var(--ink)] tabular-nums">{items.length}</b> of {data.total}
                      {job && effectiveSort === "fit" ? " · best fit first" : ""}
                    </>
                  )}
                </span>
                {job && pickable.length > 0 && !running && (
                  <button
                    type="button"
                    onClick={() => setSelected(pickable.filter((i) => (i.fit ?? 0) >= 40).slice(0, 5).map((i) => i.id))}
                    className="ml-auto font-semibold text-[var(--forest)] hover:underline"
                  >
                    Select top 5 by fit
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <p className="p-10 text-center text-[14px] text-[var(--ink-soft)]">No one in the pool matches these filters.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-soft)]">
                  {items.map((item) => (
                    <PoolRow
                      key={item.id}
                      item={item}
                      job={job}
                      selected={selected.includes(item.id)}
                      onToggle={toggle}
                      screening={screening[item.id]}
                      onUpdate={updateEntry}
                      onRemove={removeItem}
                      onMatchJob={setJob}
                      busy={busyIds.has(item.id)}
                    />
                  ))}
                </ul>
              )}
            </Card>

            {job && (
              <p className="text-[13px] text-[var(--ink-faint)]">
                Fit is a quick check of which of the job&apos;s requirements appear in each CV - free and instant, but only a guide. Screening
                gives the real match score, and puts them in the pipeline under this job.
              </p>
            )}
          </>
        )}
      </div>

      {/* Selection tray */}
      {(selected.length > 0 || running) && (
        <div className="fixed bottom-5 inset-x-0 z-30 px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[760px] flex flex-wrap items-center gap-2.5 rounded-[16px] bg-[var(--ink)] text-white pl-5 pr-2.5 py-2.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)]">
            <span className="text-[14px] font-semibold">{running ? `Screening for ${job?.title}…` : `${selected.length} selected`}</span>
            {!running && (
              <button type="button" onClick={() => setSelected([])} className="text-[13px] font-medium text-white/70 hover:text-white">
                Clear
              </button>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {job ? (
                running ? (
                  <button
                    type="button"
                    onClick={() => {
                      stopRef.current = true;
                    }}
                    className="text-[13.5px] font-semibold px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={screenSelected}
                    disabled={selected.length === 0}
                    className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold px-4 py-2 rounded-full bg-[var(--forest)] hover:bg-[var(--forest-deep)] disabled:opacity-50"
                  >
                    <Icon name="sparkle" size={13} />
                    Screen {selected.length} for {job.title}
                  </button>
                )
              ) : (
                <>
                  <select
                    value=""
                    disabled={bulkBusy}
                    onChange={(e) => bulkAvailability(e.target.value)}
                    aria-label="Set availability for the selected"
                    className="text-[13.5px] font-semibold px-3.5 py-2 rounded-full bg-white/10 text-white border border-white/15 [&>option]:text-[var(--ink)]"
                  >
                    <option value="">Set availability…</option>
                    {Object.entries(AVAILABILITY).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                    <option value="clear">Unknown</option>
                  </select>
                  <button
                    type="button"
                    onClick={bulkRemove}
                    disabled={bulkBusy}
                    className="text-[13.5px] font-semibold px-3.5 py-2 rounded-full bg-white/10 hover:bg-[#a83226] disabled:opacity-50"
                  >
                    Remove from pool
                  </button>
                </>
              )}
            </span>
          </div>
        </div>
      )}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}

export default function TalentPoolPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--mist)]"><DashboardNav /></main>}>
      <TalentPoolContent />
    </Suspense>
  );
}
