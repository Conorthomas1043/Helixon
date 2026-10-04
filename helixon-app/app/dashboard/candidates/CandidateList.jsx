"use client";

// /dashboard/candidates - the agency's candidate database: search, filter,
// sort, paginate (app/api/candidates), CSV export, and bulk stage / tag /
// delete in one request each (app/api/candidates/bulk).
//
// Filters deep-link (?jobId=, ?recruiterId=, ?stage=) via useSearchParams(),
// so that part of the tree sits in a <Suspense> boundary, which Next.js
// requires or static prerendering fails the build.

import AddToShortlist from "@/components/dashboard/AddToShortlist";
import ComposeEmail from "@/components/dashboard/ComposeEmail";
import DashboardNav from "@/components/DashboardNav";
import Link from "next/link";
import SavedSearches from "@/components/dashboard/SavedSearches";
import { CANDIDATE_COLUMNS, parseColumns } from "@/lib/list-columns";
import { useLocalSetting } from "@/lib/hooks/useLocalSetting";
import { CARD, INK, INK_FAINT, INK_MUTED, RED } from "@/lib/candidates/format";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TAG_CATALOG } from "@/lib/tag-catalog";
import { bulkUpdateCandidates, deleteTag, enrollInSequence, getCandidates, getCandidatesForExport, getEmailSequences, getJobs, getRecruiters, getStageCounts, getTags } from "@/lib/dashboard-api";
import { downloadCsv } from "@/lib/csv";
import { DEFAULT_FILTERS, filtersFromParams, paramsFromFilters } from "@/lib/candidates/list-params";
import { reportQuietly } from "@/lib/report-error";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { useRouter, useSearchParams } from "next/navigation";
import { ColumnsMenu, FilterChip, Select } from "./_components/filters";
import { CandidateRow, TagChip } from "./_components/row";
import { STAGE_ORDER } from "./_components/shared";
import { EmptyState, ErrorState, ListSkeleton } from "./_components/states";

async function fetchCandidates(query) {
  const [result, stageCounts] = await Promise.all([getCandidates(query), getStageCounts(query)]);
  return { result, stageCounts };
}

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

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "completed", label: "Analysed" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
];

const DATE_RANGES = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

/* ------------------------------------------------------------------------
 * Candidate row
 * ---------------------------------------------------------------------- */

const COLUMNS_KEY = "helixon:candidate-columns";

/* ------------------------------------------------------------------------
 * Page content - reads useSearchParams(), so it must live inside the
 * <Suspense> boundary set up by the default export below.
 * ---------------------------------------------------------------------- */

function CandidateDatabaseContent({ initialData }) {
  // Supports deep-linking from Jobs/Team ("?jobId=…", "?recruiterId=…",
  // "?stage=…") so those pages can hand off into a pre-filtered view of
  // the same underlying candidate data rather than duplicating it.
  //
  // Every filter is mirrored back into the address bar, so Back from a
  // profile returns to the same filtered list and a filtered view can be
  // shared. They used to be read once and then lost.
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialFilters = useMemo(
    () => filtersFromParams(searchParams),
    [] // eslint-disable-line react-hooks/exhaustive-deps -- read once on mount; the UI's own filter controls take over after that
  );

  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [nearInput, setNearInput] = useState(initialFilters.near);
  const [errorMessage, setErrorMessage] = useState("");
  const [ask, confirmDialog] = useConfirm();

  useEffect(() => {
    const qs = paramsFromFilters(filters);
    if (qs !== (window.location.search || "").replace(/^\?/, "")) {
      router.replace(`/dashboard/candidates${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [filters, router]);
  // Starts open when a deep link (jobId=/recruiterId=/etc.) already narrowed
  // the results, so the reason for the filtered view is visible immediately.
  const [filtersOpen, setFiltersOpen] = useState(
    () =>
      initialFilters.recruiterId !== "all" ||
      initialFilters.jobId !== "all" ||
      Boolean(initialFilters.near)
  );
  const [data, setData] = useState(initialData); // { result, stageCounts }
  const [status, setStatus] = useState(initialData ? "ready" : "loading");
  // The filters page.jsx loaded on the server; no need to fetch those again.
  const serverLoaded = useRef(initialData ? paramsFromFilters(initialFilters) : null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // The default columns in the server render, then the person's own choice.
  const [savedColumns, saveColumns] = useLocalSetting(COLUMNS_KEY);
  const columns = useMemo(() => new Set(parseColumns(savedColumns, CANDIDATE_COLUMNS)), [savedColumns]);
  const setColumns = useCallback((next) => saveColumns(JSON.stringify([...next])), [saveColumns]);
  const [composing, setComposing] = useState(false);
  const [sequences, setSequences] = useState([]);
  const [bulkNotice, setBulkNotice] = useState("");

  useEffect(() => {
    getEmailSequences()
      .then((list) => setSequences(list.filter((s) => s.active)))
      .catch(reportQuietly);
  }, []);

  const bulkEnroll = useCallback(
    async (sequenceId) => {
      if (!sequenceId) return;
      setBulkNotice("");
      try {
        const res = await enrollInSequence(sequenceId, [...selectedIds]);
        setBulkNotice(`Added ${res.enrolled} to the sequence${res.skipped?.length ? ` · ${res.skipped.length} skipped (no email, already on it, or rejected/placed)` : ""}.`);
      } catch (err) {
        setBulkNotice(err.message || "Couldn't add them to the sequence.");
      }
    },
    [selectedIds]
  );
  const [reloadKey, setReloadKey] = useState(0);

  const [jobs, setJobs] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [tags, setTags] = useState(TAG_CATALOG);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getJobs(), getRecruiters()])
      .then(([j, r]) => {
        if (cancelled) return;
        setJobs(j);
        setRecruiters(r);
      })
      .catch(reportQuietly);
    getTags()
      .then((t) => !cancelled && setTags(t))
      .catch(reportQuietly);
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce the free-text search before it hits the "query".
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput, page: 1 }));
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (serverLoaded.current === paramsFromFilters(filters) && reloadKey === 0) return;
    serverLoaded.current = null;
    let cancelled = false;
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    fetchCandidates(filters)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
        setSelectedIds(new Set());
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err?.message || "");
        setStatus("error");
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
    setNearInput("");
    setFilters(DEFAULT_FILTERS);
  }, []);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError("");
    try {
      // Same filters currently applied to the list, minus pagination - the
      // export is "everything matching what you're looking at", not just
      // the current page.
      const { page, pageSize, sortBy, ...activeFilters } = filters;
      const items = await getCandidatesForExport(activeFilters);
      downloadCsv(
        `candidates-${new Date().toISOString().slice(0, 10)}.csv`,
        items.map((c) => ({
          Name: c.fullName,
          "Current title": c.currentTitle || "",
          "Current company": c.currentCompany || "",
          Location: c.location || "",
          Job: c.jobTitle || "",
          Client: c.company || "",
          Recruiter: c.recruiterName || "",
          Stage: c.stage ? STAGE_LABELS[c.stage] || c.stage : "",
          Score: c.score ?? "",
          Status: c.status,
          "Created at": c.createdAt || "",
          "Last activity": c.lastActivityAt || "",
        }))
      );
    } catch (err) {
      setExportError(err?.message || "Couldn't export candidates. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [filters]);

  const toggleTag = useCallback((tagId) => {
    setFilters((f) => ({
      ...f,
      page: 1,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((t) => t !== tagId) : [...f.tagIds, tagId],
    }));
  }, []);

  const removeCustomTag = useCallback(
    async (tag) => {
      if (!(await ask({ title: `Delete the tag "${tag.label}"?`, body: "It's taken off every candidate that has it.", confirmLabel: "Delete tag", danger: true }))) return;
      try {
        await deleteTag(tag.id);
        setTags((list) => list.filter((t) => t.id !== tag.id));
        setFilters((f) => (f.tagIds.includes(tag.id) ? { ...f, tagIds: f.tagIds.filter((x) => x !== tag.id), page: 1 } : f));
        retry();
      } catch (err) {
        setExportError(err.message || "Couldn't delete the tag.");
      }
    },
    [retry, ask]
  );

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
    if (filters.pool) n += 1;
    if (filters.near) n += 1;
    return n;
  }, [filters]);

  const hasAnyFilter = activeFilterCount > 0 || filters.search.trim().length > 0;

  // One request per bulk action (app/api/candidates/bulk). These used to
  // fire one request per candidate and swallow any failures.
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const runBulk = useCallback(
    async (payload, { clearSelection = false } = {}) => {
      setBulkBusy(true);
      setBulkError("");
      try {
        await bulkUpdateCandidates([...selectedIds], payload);
        if (clearSelection) setSelectedIds(new Set());
      } catch (err) {
        setBulkError(err.message || "That didn't work. Please try again.");
      } finally {
        setBulkBusy(false);
        retry();
      }
    },
    [selectedIds, retry]
  );

  const bulkChangeStage = useCallback(
    (newStage) => {
      if (newStage) runBulk({ action: "stage", stage: newStage });
    },
    [runBulk]
  );

  const bulkAddTag = useCallback(
    (tagId) => {
      if (tagId) runBulk({ action: "tag", tagId });
    },
    [runBulk]
  );

  const bulkDelete = useCallback(async () => {
    const n = selectedIds.size;
    const label = `${n} candidate${n === 1 ? "" : "s"}`;
    if (!(await ask({ title: `Permanently erase ${label}?`, body: "Their CVs, analyses, notes and history are deleted and can't be recovered.", confirmLabel: `Erase ${label}`, danger: true }))) return;
    runBulk({ action: "delete" }, { clearSelection: true });
  }, [selectedIds, runBulk, ask]);

  const result = data?.result;
  const stageCounts = data?.stageCounts;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      {confirmDialog}

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Candidate database
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Candidates
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK }}
            >
              ← Dashboard
            </Link>
            <Link
              href="/analyse"
              className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "var(--forest)", color: "white" }}
            >
              + Screen a CV
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
              placeholder="Search name, skill, company, job or recruiter…"
              className="w-full text-sm px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK }}
              aria-label="Search candidates, jobs or recruiters"
            />
            <p className="text-[12px] mt-1.5 px-2" style={{ color: INK_FAINT }}>
              {result?.searchMode === "boolean" ? (
                <span style={{ color: "var(--forest)" }}>Boolean search across CVs and profiles. </span>
              ) : null}
              Tip: <code>(java OR kotlin) AND &quot;spring boot&quot; NOT junior</code>, or <code>develop*</code>, searches every CV.
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <FilterChip active={filters.stage === "all"} onClick={() => updateFilter({ stage: "all" })} count={stageCounts?.all}>
              All
            </FilterChip>
            {STAGE_ORDER.map((key) => (
              <FilterChip key={key} active={filters.stage === key} onClick={() => updateFilter({ stage: key })} count={stageCounts?.[key]}>
                {STAGE_LABELS[key]}
              </FilterChip>
            ))}

            <span className="w-px h-5 mx-1 shrink-0" style={{ background: "var(--border)" }} />

            <FilterChip active={filters.pool} onClick={() => updateFilter({ pool: !filters.pool })}>
              ☆ Talent pool
            </FilterChip>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 shrink-0"
              style={{
                background: activeFilterCount > 0 ? "var(--mint)" : "white",
                color: activeFilterCount > 0 ? "var(--forest)" : INK_MUTED,
                border: `1px solid ${activeFilterCount > 0 ? "var(--forest)" : "var(--border)"}`,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="text-[12px] font-semibold px-1.5 rounded-full tabular-nums" style={{ background: "var(--forest)", color: "white" }}>
                  {activeFilterCount}
                </span>
              )}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: filtersOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            <SavedSearches
              currentQuery={paramsFromFilters({ ...filters, page: 1 })}
              onApply={(qs) => {
                const next = filtersFromParams(new URLSearchParams(qs));
                setSearchInput(next.search);
                setNearInput(next.near);
                setFilters(next);
              }}
            />

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 shrink-0 disabled:opacity-50"
              style={{ background: "white", color: INK_MUTED, border: "1px solid var(--border)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v13m0 0-4-4m4 4 4-4M5 21h14" />
              </svg>
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>

          {exportError && (
            <p role="alert" className="text-[13px]" style={{ color: RED }}>{exportError}</p>
          )}

          {filtersOpen && (
            <div className="flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: "1px solid var(--border-soft, var(--border))" }}>
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
              <Select ariaLabel="Filter by status" value={filters.status} onChange={(v) => updateFilter({ status: v })} options={STATUS_OPTIONS} />
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateFilter({ near: nearInput.trim() });
                }}
              >
                <input
                  value={nearInput}
                  onChange={(e) => setNearInput(e.target.value)}
                  onBlur={() => nearInput.trim() !== filters.near && updateFilter({ near: nearInput.trim() })}
                  placeholder="Near town or postcode"
                  aria-label="Near a town or postcode"
                  maxLength={100}
                  className="text-[13px] px-3 py-1.5 rounded-full w-44 bg-white"
                  style={{ border: "1px solid var(--border)", color: INK }}
                />
                <Select
                  ariaLabel="Distance"
                  value={filters.radius}
                  onChange={(v) => updateFilter({ radius: v })}
                  options={["5", "10", "25", "50", "100"].map((m) => ({ value: m, label: `within ${m} mi` }))}
                />
              </form>
              <Select ariaLabel="Filter by date" value={filters.dateRange} onChange={(v) => updateFilter({ dateRange: v })} options={DATE_RANGES} />

              <span className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

              {tags.map((t) => (
                <TagChip
                  key={t.id}
                  label={t.label}
                  active={filters.tagIds.includes(t.id)}
                  onClick={() => toggleTag(t.id)}
                  onDelete={t.custom ? () => removeCustomTag(t) : null}
                />
              ))}

              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[13px] font-semibold ml-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
                  style={{ color: "var(--forest)" }}
                >
                  Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="rounded-[14px] p-3.5 sm:p-4 flex flex-wrap items-center gap-3" style={{ ...CARD, background: "var(--mist)" }}>
            <span className="text-[14px] font-semibold" style={{ color: INK }}>
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
              onClick={() => runBulk({ action: "pool" })}
              disabled={bulkBusy}
              className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
              style={{ border: "1px solid var(--forest)", color: "var(--forest)" }}
            >
              ☆ Save to talent pool
            </button>
            {filters.pool && (
              <button
                type="button"
                onClick={() => runBulk({ action: "unpool" }, { clearSelection: true })}
                disabled={bulkBusy}
                className="text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
                style={{ color: INK_MUTED }}
              >
                Remove from pool
              </button>
            )}
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK }}
            >
              Email…
            </button>
            {sequences.length > 0 && (
              <Select
                ariaLabel="Add to a sequence"
                value=""
                onChange={bulkEnroll}
                options={[{ value: "", label: "Add to sequence…" }, ...sequences.map((s) => ({ value: s.id, label: s.name }))]}
              />
            )}
            <AddToShortlist
              candidateIds={[...selectedIds]}
              jobId={filters.jobId !== "all" ? filters.jobId : null}
              label="Add to client shortlist…"
            />
            {selectedIds.size >= 2 && selectedIds.size <= 4 ? (
              <Link
                href={`/analyse/compare?ids=${[...selectedIds].join(",")}`}
                className="text-[13px] font-semibold px-3 py-1.5 rounded-full text-white bg-[var(--forest)] hover:bg-[var(--forest-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Compare side by side
              </Link>
            ) : selectedIds.size > 4 ? (
              <span className="text-[13px]" style={{ color: INK_MUTED }}>Select up to 4 to compare</span>
            ) : null}
            <button
              type="button"
              onClick={bulkDelete}
              disabled={bulkBusy}
              className="text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
              style={{ color: RED }}
            >
              Delete…
            </button>
            {bulkBusy && <span className="text-[13px]" style={{ color: INK_MUTED }}>Working…</span>}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-[13px] font-semibold ml-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              style={{ color: INK_MUTED }}
            >
              Clear selection
            </button>
            {bulkNotice && (
              <p role="status" className="w-full text-[13px]" style={{ color: INK_MUTED }}>
                {bulkNotice}
              </p>
            )}
            {composing && (
              <ComposeEmail
                candidateIds={[...selectedIds]}
                onClose={() => setComposing(false)}
                onSent={(res) => setBulkNotice(`Sent ${res.sent} email${res.sent === 1 ? "" : "s"}.`)}
              />
            )}
            {bulkError && (
              <p role="alert" className="w-full text-[13px]" style={{ color: RED }}>{bulkError}</p>
            )}
          </div>
        )}

        {/* Results */}
        <div className="rounded-[14px] p-4 sm:p-5" style={CARD}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px]" style={{ color: INK_MUTED }}>
              {status === "ready" && result ? `Showing ${result.items.length === 0 ? 0 : (result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} of ${result.total}` : "\u00A0"}
            </p>
            <div className="flex items-center gap-2">
              {status === "ready" && result && result.items.length > 0 && (
                <label className="flex items-center gap-1.5 text-[13px] font-semibold mr-2" style={{ color: INK_MUTED }}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[var(--forest)]"
                    checked={result.items.every((c) => selectedIds.has(c.id))}
                    onChange={toggleSelectAll}
                  />
                  Select page
                </label>
              )}
              <ColumnsMenu columns={columns} onChange={setColumns} />
              <Select ariaLabel="Sort by" value={filters.sortBy} onChange={(v) => updateFilter({ sortBy: v })} options={SORT_OPTIONS} />
            </div>
          </div>

          {status === "loading" && <ListSkeleton />}
          {/* Always with "Try again": a dropped connection or a server error
              is usually fixed by retrying, so a bare message was a dead end. */}
          {status === "error" && (
            <ErrorState onRetry={retry} message={errorMessage && errorMessage !== "Failed to load candidates" ? errorMessage : null} />
          )}
          {status === "ready" && result && result.items.length === 0 && <EmptyState hasFilters={hasAnyFilter} onClear={clearFilters} />}
          {status === "ready" && result && result.items.length > 0 && (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {result.items.map((c) => (
                <CandidateRow key={c.id} candidate={c} selected={selectedIds.has(c.id)} onToggleSelect={toggleSelect} columns={columns} />
              ))}
            </ul>
          )}

          {status === "ready" && result && result.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                disabled={result.page <= 1}
                onClick={() => setPage(result.page - 1)}
                className="text-[13px] font-semibold px-3 py-1.5 rounded-full disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              >
                ← Previous
              </button>
              <span className="text-[13px] tabular-nums" style={{ color: INK_MUTED, fontFamily: "var(--font-mono)" }}>
                Page {result.page} of {result.totalPages}
              </span>
              <button
                type="button"
                disabled={result.page >= result.totalPages}
                onClick={() => setPage(result.page + 1)}
                className="text-[13px] font-semibold px-3 py-1.5 rounded-full disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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

/* ------------------------------------------------------------------------
 * Fallback shown during the (very brief) moment Suspense needs before
 * useSearchParams() resolves - reuses the same skeleton as the loading
 * state so there's no visible flash between the two.
 * ---------------------------------------------------------------------- */

function CandidateDatabaseFallback() {
  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <ListSkeleton />
      </div>
    </main>
  );
}

// `initialData` is the first page and stage counts as page.jsx loaded them on
// the server ({ result, stageCounts }), or null if that failed and the list
// should load itself.
export default function CandidateList({ initialData = null }) {
  return (
    <Suspense fallback={<CandidateDatabaseFallback />}>
      <CandidateDatabaseContent initialData={initialData} />
    </Suspense>
  );
}
