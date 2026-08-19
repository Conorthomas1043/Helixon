"use client";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS
 * ------------------------------------------------------------------------
 * - Route: /dashboard/candidates. Sibling to the existing /dashboard page;
 *   adjust if this project's app-router root lives elsewhere (e.g. under
 *   src/app).
 * - DashboardNav is reused as-is from the existing dashboard. If it
 *   doesn't yet have a "Candidates" link, add one pointing here — it
 *   wasn't safe to guess-edit a component whose source wasn't available.
 * - getCandidates()/getStageCounts() in lib/mock-data.js are written to
 *   look like a server-side filter/sort/paginate query so they're a
 *   one-file swap for a real `/api/candidates` call later (see the
 *   comment block at the top of that file).
 * - Bulk stage-change and bulk tag-add call the same mock mutation
 *   functions the candidate profile page uses, once per selected
 *   candidate, then refetch. There's no bulk endpoint assumed to exist.
 * ---------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import {
  getCandidates,
  getStageCounts,
  getJobs,
  getRecruiters,
  getTagCatalog,
  STAGE_LABELS,
  STAGE_ORDER,
  updateCandidateStage,
  addCandidateTag,
} from "@/lib/mock-data";
import {
  INK,
  INK_MUTED,
  INK_FAINT,
  AMBER,
  AMBER_BG,
  RED,
  RED_BG,
  GREEN_BG,
  CARD,
  formatRelativeTime,
  scoreColor,
  scoreLabel,
  initials,
} from "@/lib/candidate-format";

/* ------------------------------------------------------------------------
 * Mock "network" wrapper — see dashboard/page.js's fetchDashboardData for
 * the precedent. Swap the body for `fetch("/api/candidates?...")` later;
 * callers already treat this as async and handle the error path.
 * ---------------------------------------------------------------------- */

async function fetchCandidates(query) {
  try {
    return await new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve({ result: getCandidates(query), stageCounts: getStageCounts(query) });
        } catch (err) {
          reject(err);
        }
      }, 200);
    });
  } catch (err) {
    throw new Error("Failed to load candidates");
  }
}

const DEFAULT_FILTERS = {
  search: "",
  stage: "all",
  scoreBand: "all",
  status: "all",
  recruiterId: "all",
  jobId: "all",
  tagIds: [],
  dateRange: "all",
  sortBy: "score_desc",
  page: 1,
};

const SORT_OPTIONS = [
  { value: "score_desc", label: "Strongest match" },
  { value: "recent_activity", label: "Recently active" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "stage", label: "Pipeline stage" },
  { value: "recruiter", label: "Recruiter" },
  { value: "job", label: "Job" },
];

const SCORE_BANDS = [
  { value: "all", label: "Any score" },
  { value: "80+", label: "80+ Strong" },
  { value: "60-79", label: "60–79 Moderate" },
  { value: "<60", label: "Below 60" },
];

const DATE_RANGES = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "completed", label: "Completed" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
];

/* ------------------------------------------------------------------------
 * Small pieces
 * ---------------------------------------------------------------------- */

function Pill({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 shrink-0"
      style={{
        background: active ? "var(--forest)" : "white",
        color: active ? "white" : INK_MUTED,
        border: active ? "1px solid var(--forest)" : "1px solid var(--border)",
      }}
    >
      {children}
      {typeof count === "number" && (
        <span
          className="text-[10px] font-semibold px-1.5 rounded-full tabular-nums"
          style={{
            background: active ? "rgba(255,255,255,0.25)" : "var(--mist)",
            color: active ? "white" : INK_FAINT,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function Select({ value, onChange, options, ariaLabel }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ border: "1px solid var(--border)", color: INK }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TagChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: active ? "var(--forest)" : "var(--mist)",
        color: active ? "white" : INK_MUTED,
      }}
    >
      {label}
    </button>
  );
}

function ScorePill({ score }) {
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-end shrink-0 w-12">
      <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color }}>
        {score === null || score === undefined ? "—" : score}
      </span>
      <span className="text-[10px] whitespace-nowrap" style={{ color: INK_FAINT }}>
        {score === null || score === undefined ? "" : scoreLabel(score).split(" ")[0]}
      </span>
    </div>
  );
}

function StageBadge({ stage, status }) {
  if (status === "failed") {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: RED_BG, color: "#b91c1c" }}>
        Failed
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: AMBER_BG, color: AMBER }}>
        Processing
      </span>
    );
  }
  if (!stage || !STAGE_LABELS[stage]) {
    return (
      <span className="text-[11px]" style={{ color: INK_FAINT }}>
        No stage
      </span>
    );
  }
  const isPlaced = stage === STAGE_ORDER[STAGE_ORDER.length - 1];
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: isPlaced ? GREEN_BG : "var(--mist)", color: isPlaced ? "var(--forest)" : INK_MUTED }}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

function Avatar({ name }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[12px] font-semibold"
      style={{ background: "var(--mist)", color: "var(--forest)" }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Candidate row
 * ---------------------------------------------------------------------- */

function CandidateRow({ candidate, selected, onToggleSelect }) {
  const overdue = candidate.nextAction && new Date(candidate.nextAction.dueAt).getTime() < Date.now();
  return (
    <li>
      <div
        className="flex items-center gap-3 py-3.5 -mx-2 px-2 rounded-[10px] transition-colors hover:bg-[var(--mist)] focus-within:bg-[var(--mist)]"
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(candidate.id)}
          aria-label={`Select ${candidate.fullName}`}
          className="w-4 h-4 shrink-0 accent-[var(--forest)]"
        />

        <Avatar name={candidate.fullName} />

        <Link href={`/dashboard/candidates/${candidate.id}`} className="flex-1 min-w-0 flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" style={{ color: INK }}>
              {candidate.fullName}
            </p>
            <p className="text-[12px] truncate" style={{ color: INK_MUTED }}>
              {candidate.jobTitle}
              {candidate.company ? ` · ${candidate.company}` : ""}
            </p>
          </div>

          <div className="hidden lg:flex flex-wrap gap-1 w-40 shrink-0">
            {candidate.skills.slice(0, 3).map((s) => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_MUTED }}>
                {s}
              </span>
            ))}
          </div>

          <div className="hidden md:block w-24 shrink-0 text-[12px] truncate" style={{ color: INK_MUTED }}>
            {candidate.recruiterName ?? "Unassigned"}
          </div>

          <div className="hidden sm:block w-24 shrink-0">
            <StageBadge stage={candidate.stage} status={candidate.status} />
          </div>

          <div className="hidden xl:block w-40 shrink-0 text-[11px] truncate" style={{ color: overdue ? "#b91c1c" : INK_FAINT }}>
            {candidate.nextAction ? `${overdue ? "Overdue: " : "Next: "}${candidate.nextAction.label}` : ""}
          </div>

          <ScorePill score={candidate.score} />
        </Link>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------------
 * Skeleton / empty / error
 * ---------------------------------------------------------------------- */

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading candidates">
      {Array.from({ length: 8 }).map((_, i) => (
        <Block key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <p className="text-sm font-semibold mb-1" style={{ color: INK }}>
        {hasFilters ? "No candidates match these filters" : "No candidates yet"}
      </p>
      <p className="text-[13px] max-w-sm mb-4" style={{ color: INK_MUTED }}>
        {hasFilters
          ? "Try widening your search or clearing a filter."
          : "Candidates will appear here once you start screening CVs against your roles."}
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Clear filters
        </button>
      ) : (
        <Link
          href="/analyse"
          className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "var(--forest)", color: "white" }}
        >
          New analysis
        </Link>
      )}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <p className="text-sm font-semibold mb-1" style={{ color: INK }}>
        Unable to load candidates
      </p>
      <p className="text-[13px] max-w-sm mb-4" style={{ color: INK_MUTED }}>
        Something went wrong while loading the candidate database.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--forest)", color: "white" }}
      >
        Try again
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

export default function CandidateDatabasePage() {
  // Supports deep-linking from Jobs/Team ("?jobId=…", "?recruiterId=…",
  // "?stage=…") so those pages can hand off into a pre-filtered view of
  // the same underlying candidate data rather than duplicating it.
  const searchParams = useSearchParams();
  const initialFilters = useMemo(
    () => ({
      ...DEFAULT_FILTERS,
      jobId: searchParams?.get("jobId") || "all",
      recruiterId: searchParams?.get("recruiterId") || "all",
      stage: searchParams?.get("stage") || "all",
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps -- read once on mount; the UI's own filter controls take over after that
  );

  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState(null); // { result, stageCounts }
  const [status, setStatus] = useState("loading");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [reloadKey, setReloadKey] = useState(0);

  const jobs = useMemo(() => getJobs(), []);
  const recruiters = useMemo(() => getRecruiters(), []);
  const tags = useMemo(() => getTagCatalog(), []);

  // Debounce the free-text search before it hits the "query".
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput, page: 1 }));
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    fetchCandidates(filters)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
        setSelectedIds(new Set());
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [filters, reloadKey]);

  const retry = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  const updateFilter = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...patch, page: 1 }));
  }, []);

  const setPage = useCallback((page) => {
    setFilters((f) => ({ ...f, page }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setFilters(DEFAULT_FILTERS);
  }, []);

  const toggleTag = useCallback((tagId) => {
    setFilters((f) => ({
      ...f,
      page: 1,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((t) => t !== tagId) : [...f.tagIds, tagId],
    }));
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (!data?.result.items.length) return prev;
      const allSelected = data.result.items.every((c) => prev.has(c.id));
      if (allSelected) return new Set();
      return new Set(data.result.items.map((c) => c.id));
    });
  }, [data]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.stage !== "all") n += 1;
    if (filters.scoreBand !== "all") n += 1;
    if (filters.status !== "all") n += 1;
    if (filters.recruiterId !== "all") n += 1;
    if (filters.jobId !== "all") n += 1;
    if (filters.dateRange !== "all") n += 1;
    if (filters.tagIds.length > 0) n += 1;
    return n;
  }, [filters]);

  const hasAnyFilter = activeFilterCount > 0 || filters.search.trim().length > 0;

  const bulkChangeStage = useCallback(
    (newStage) => {
      if (!newStage) return;
      selectedIds.forEach((id) => updateCandidateStage(id, newStage, "You"));
      retry();
    },
    [selectedIds, retry]
  );

  const bulkAddTag = useCallback(
    (tagId) => {
      if (!tagId) return;
      selectedIds.forEach((id) => addCandidateTag(id, tagId, "You"));
      retry();
    },
    [selectedIds, retry]
  );

  const result = data?.result;
  const stageCounts = data?.stageCounts;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Candidate database
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Candidates
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK }}
            >
              ← Dashboard
            </Link>
            <Link
              href="/analyse"
              className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "var(--forest)", color: "white" }}
            >
              + New analysis
            </Link>
          </div>
        </header>

        {/* Search + filters */}
        <div className="rounded-[14px] p-4 sm:p-5 space-y-4" style={CARD}>
          <div className="relative">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search candidates, jobs or recruiters…"
              className="w-full text-sm px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK }}
              aria-label="Search candidates, jobs or recruiters"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Pill active={filters.stage === "all"} onClick={() => updateFilter({ stage: "all" })} count={stageCounts?.all}>
              All
            </Pill>
            {STAGE_ORDER.map((key) => (
              <Pill key={key} active={filters.stage === key} onClick={() => updateFilter({ stage: key })} count={stageCounts?.[key]}>
                {STAGE_LABELS[key]}
              </Pill>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select ariaLabel="Filter by score" value={filters.scoreBand} onChange={(v) => updateFilter({ scoreBand: v })} options={SCORE_BANDS} />
            <Select
              ariaLabel="Filter by recruiter"
              value={filters.recruiterId}
              onChange={(v) => updateFilter({ recruiterId: v })}
              options={[{ value: "all", label: "Any recruiter" }, ...recruiters.map((r) => ({ value: r.id, label: r.name }))]}
            />
            <Select
              ariaLabel="Filter by job"
              value={filters.jobId}
              onChange={(v) => updateFilter({ jobId: v })}
              options={[{ value: "all", label: "Any job" }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]}
            />
            <Select ariaLabel="Filter by date" value={filters.dateRange} onChange={(v) => updateFilter({ dateRange: v })} options={DATE_RANGES} />
            <Select ariaLabel="Filter by analysis status" value={filters.status} onChange={(v) => updateFilter({ status: v })} options={STATUS_OPTIONS} />

            <span className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

            {tags.map((t) => (
              <TagChip key={t.id} label={t.label} active={filters.tagIds.includes(t.id)} onClick={() => toggleTag(t.id)} />
            ))}

            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[12px] font-semibold ml-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
                style={{ color: "var(--forest)" }}
              >
                Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="rounded-[14px] p-3.5 sm:p-4 flex flex-wrap items-center gap-3" style={{ ...CARD, background: "var(--mist)" }}>
            <span className="text-[13px] font-semibold" style={{ color: INK }}>
              {selectedIds.size} selected
            </span>
            <Select
              ariaLabel="Bulk move stage"
              value=""
              onChange={bulkChangeStage}
              options={[{ value: "", label: "Move to stage…" }, ...STAGE_ORDER.map((k) => ({ value: k, label: STAGE_LABELS[k] }))]}
            />
            <Select
              ariaLabel="Bulk add tag"
              value=""
              onChange={bulkAddTag}
              options={[{ value: "", label: "Add tag…" }, ...tags.map((t) => ({ value: t.id, label: t.label }))]}
            />
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-[12px] font-semibold ml-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              style={{ color: INK_MUTED }}
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Results */}
        <div className="rounded-[14px] p-4 sm:p-5" style={CARD}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px]" style={{ color: INK_MUTED }}>
              {status === "ready" && result ? `Showing ${result.items.length === 0 ? 0 : (result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} of ${result.total}` : "\u00A0"}
            </p>
            <div className="flex items-center gap-2">
              {status === "ready" && result && result.items.length > 0 && (
                <label className="flex items-center gap-1.5 text-[12px] font-semibold mr-2" style={{ color: INK_MUTED }}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[var(--forest)]"
                    checked={result.items.every((c) => selectedIds.has(c.id))}
                    onChange={toggleSelectAll}
                  />
                  Select page
                </label>
              )}
              <Select ariaLabel="Sort by" value={filters.sortBy} onChange={(v) => updateFilter({ sortBy: v })} options={SORT_OPTIONS} />
            </div>
          </div>

          {status === "loading" && <ListSkeleton />}
          {status === "error" && <ErrorState onRetry={retry} />}
          {status === "ready" && result && result.items.length === 0 && <EmptyState hasFilters={hasAnyFilter} onClear={clearFilters} />}
          {status === "ready" && result && result.items.length > 0 && (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {result.items.map((c) => (
                <CandidateRow key={c.id} candidate={c} selected={selectedIds.has(c.id)} onToggleSelect={toggleSelect} />
              ))}
            </ul>
          )}

          {status === "ready" && result && result.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                disabled={result.page <= 1}
                onClick={() => setPage(result.page - 1)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              >
                ← Previous
              </button>
              <span className="text-[12px] tabular-nums" style={{ color: INK_MUTED, fontFamily: "var(--font-mono)" }}>
                Page {result.page} of {result.totalPages}
              </span>
              <button
                type="button"
                disabled={result.page >= result.totalPages}
                onClick={() => setPage(result.page + 1)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
