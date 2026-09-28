"use client";

// /dashboard/talent-pool - people the agency has saved for future roles
// (app/api/talent-pool). When a new job comes in, pick it here: everyone in
// the pool gets a quick keyword fit against the job's requirements (free,
// instant - lib/talent-pool-match.js), then the best can be screened
// properly in one go from the CVs already on file (app/api/candidates/[id]/
// rescreen). No re-uploading. ?jobId= deep-links straight to a job, e.g.
// from the job's own page.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { getJobs, getTalentPool, removeFromTalentPool, rescreenCandidate } from "@/lib/dashboard-api";
import { formatRelativeTime } from "@/lib/candidate-format";
import { scoreTone } from "@/app/analyse/_lib/analyse";
import { Card, Icon, Notice, Spinner, Toasts, cx, useToasts } from "@/app/analyse/_components/ui";
import { Avatar, PillButton, StagePill } from "@/app/analyse/_components/compareBits";

const SCREEN_CONCURRENCY = 2;

function fitTone(fit) {
  if (fit == null) return { fg: "var(--ink-faint)", bar: "var(--border)", label: "No requirements to check" };
  if (fit >= 70) return { fg: "var(--score-strong)", bar: "var(--score-strong)", label: "Likely fit" };
  if (fit >= 40) return { fg: "var(--score-mid)", bar: "var(--score-mid)", label: "Partial fit" };
  return { fg: "var(--score-low)", bar: "var(--score-low)", label: "Unlikely fit" };
}

function Chip({ children, tone = "plain", title }) {
  const styles = {
    plain: "bg-[var(--mist)] text-[var(--ink-soft)]",
    match: "bg-[var(--mint)] text-[var(--forest-deep)]",
    miss: "bg-[#fbefed] text-[#a83226]",
  };
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", styles[tone])}>
      {tone === "match" && <Icon name="check" size={10} strokeWidth={2.4} />}
      {tone === "miss" && <Icon name="x" size={10} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

function RoleLink({ role }) {
  const tone = scoreTone(role.score);
  return (
    <Link
      href={`/dashboard/candidates/${role.candidateId}`}
      className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-0.5 rounded-full border border-[var(--border)] bg-white hover:bg-[var(--mist)]"
      title={`Screened for ${role.jobTitle}`}
    >
      <span className="truncate max-w-[160px] text-[var(--ink-soft)]">{role.jobTitle}</span>
      {role.score != null && (
        <b className="tabular-nums" style={{ color: tone.fg }}>
          {role.score}
        </b>
      )}
    </Link>
  );
}

function FitMeter({ fit }) {
  const tone = fitTone(fit);
  return (
    <div className="w-[92px] shrink-0 text-right" title="Quick keyword check of their CV against the job's requirements - not the real screening score">
      <p className="text-[15px] font-semibold tabular-nums leading-none" style={{ color: tone.fg }}>
        {fit == null ? "–" : `${fit}%`}
      </p>
      <div className="h-1.5 rounded-full bg-[var(--mist)] mt-1.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${fit ?? 0}%`, background: tone.bar }} />
      </div>
      <p className="text-[10.5px] text-[var(--ink-faint)] mt-1">{tone.label}</p>
    </div>
  );
}

function PoolRow({ item, job, selected, onToggle, screening, onRemove, removing }) {
  const screened = job ? item.screened : null;
  const canPick = job && !screened && item.hasCv && !screening;
  const status = screening?.status;

  return (
    <li className={cx("px-4 sm:px-5 py-4 transition-colors", selected ? "bg-[#f4faf7]" : "bg-white")}>
      <div className="flex items-start gap-3">
        {job && (
          <input
            type="checkbox"
            checked={selected}
            disabled={!canPick}
            onChange={() => onToggle(item.id)}
            aria-label={`Select ${item.name} to screen`}
            className="mt-2.5 w-4 h-4 shrink-0 accent-[var(--forest)] disabled:opacity-30"
          />
        )}
        <Avatar name={item.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link href={`/dashboard/candidates/${item.id}`} className="text-[14.5px] font-semibold text-[var(--ink)] hover:underline truncate">
              {item.name}
            </Link>
            <span className="text-[12.5px] text-[var(--ink-soft)] truncate">
              {[item.currentTitle, item.currentCompany].filter(Boolean).join(" · ") || "No current role on file"}
            </span>
          </div>
          <p className="text-[12px] text-[var(--ink-faint)] mt-0.5">
            {[item.location, item.yearsExperience != null && `${item.yearsExperience} yrs experience`, `saved ${formatRelativeTime(item.savedAt)}${item.savedBy ? ` by ${item.savedBy}` : ""}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {job && (
            <div className="sm:hidden flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12.5px]">
              <span className="font-semibold tabular-nums" style={{ color: fitTone(item.fit).fg }}>
                {item.fit == null ? "No fit score" : `${item.fit}% fit`}
              </span>
              {screened && (
                <Link href={`/dashboard/candidates/${screened.candidateId}`} className="font-semibold text-[var(--forest)]">
                  Screened: {screened.score ?? "–"} →
                </Link>
              )}
              {status === "running" && <span className="text-[var(--ink-soft)]">Screening…</span>}
              {status === "queued" && <span className="text-[var(--ink-faint)]">Queued</span>}
              {status === "failed" && <span className="text-[#a83226]">{screening.error}</span>}
              {!screened && !item.hasCv && <span className="text-[var(--ink-faint)]">No CV text on file</span>}
            </div>
          )}
          {item.note && <p className="text-[12.5px] text-[var(--ink)] mt-1.5 italic">“{item.note}”</p>}

          {job ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.matched.map((s) => (
                <Chip key={`m-${s}`} tone="match">
                  {s}
                </Chip>
              ))}
              {item.missing.map((s) => (
                <Chip key={`x-${s}`} tone="miss" title="Not found in their CV">
                  {s}
                </Chip>
              ))}
              {item.experienceOk === false && <Chip tone="miss">Under {job.minYearsExperience} yrs</Chip>}
            </div>
          ) : (
            item.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.skills.slice(0, 6).map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            )
          )}

          {item.roles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-[var(--ink-faint)]">Screened for</span>
              {item.roles.map((r) => (
                <RoleLink key={r.candidateId} role={r} />
              ))}
            </div>
          )}
        </div>

        <div className={cx("flex-col items-end gap-2 shrink-0", job ? "hidden sm:flex" : "flex")}>
          {job && <FitMeter fit={item.fit} />}
          {job && screened && (
            <Link href={`/dashboard/candidates/${screened.candidateId}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--forest)] hover:underline">
              Screened: {screened.score ?? "–"}
              <Icon name="arrowRight" size={12} />
            </Link>
          )}
          {job && !screened && !item.hasCv && <span className="text-[11px] text-[var(--ink-faint)]">No CV text on file</span>}
          {status === "running" && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
              <Spinner size={12} /> Screening…
            </span>
          )}
          {status === "queued" && <span className="text-[12px] text-[var(--ink-faint)]">Queued</span>}
          {status === "failed" && <span className="text-[12px] text-[#a83226] max-w-[180px] text-right">{screening.error}</span>}
          {!job && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              disabled={removing}
              className="text-[12px] font-medium text-[var(--ink-faint)] hover:text-[#a83226] disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove from pool"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function PoolSkeleton() {
  return (
    <Card className="divide-y divide-[var(--border-soft)]" aria-busy="true" aria-label="Loading talent pool">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <div className="w-10 h-10 rounded-full shimmer-block" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-48 rounded shimmer-block" />
            <div className="h-3 w-72 rounded shimmer-block" />
          </div>
        </div>
      ))}
    </Card>
  );
}

function TalentPoolContent() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("jobId") || "";

  const [jobs, setJobs] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState([]);
  const [screening, setScreening] = useState({}); // id -> { status, error }
  const [running, setRunning] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const stopRef = useRef(false);
  const { toasts, toast } = useToasts();

  useEffect(() => {
    getJobs()
      .then(setJobs)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    getTalentPool({ search, jobId })
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
  }, [search, jobId, reloadKey]);

  const setJob = useCallback(
    (next) => {
      setSelected([]);
      setScreening({});
      setStatus("loading");
      router.replace(next ? `/dashboard/talent-pool?jobId=${next}` : "/dashboard/talent-pool", { scroll: false });
    },
    [router]
  );

  const job = data?.job || null;
  const items = useMemo(() => data?.items || [], [data]);
  const pickable = useMemo(() => items.filter((i) => job && !i.screened && i.hasCv), [items, job]);

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function pickTop(n) {
    setSelected(pickable.filter((i) => (i.fit ?? 0) > 0).slice(0, n).map((i) => i.id));
  }

  async function removeItem(item) {
    if (!confirm(`Remove ${item.name} from the talent pool? Their profile and screenings stay as they are.`)) return;
    setRemovingId(item.id);
    try {
      await removeFromTalentPool(item.id);
      setData((d) => ({ ...d, total: d.total - 1, items: d.items.filter((i) => i.id !== item.id) }));
      toast(`${item.name} removed from the pool`);
    } catch (err) {
      toast(err.message || "Couldn't remove them.", "error");
    } finally {
      setRemovingId(null);
    }
  }

  // Screens the selection a couple at a time. Each is a full analysis, so a
  // 429 (hourly allowance used up) stops the rest.
  async function screenSelected() {
    if (!job || selected.length === 0) return;
    const queue = [...selected];
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
          setScreening((s) => ({ ...s, [id]: { status: "done" } }));
          setData((d) => ({
            ...d,
            items: d.items.map((i) =>
              i.id === id
                ? {
                    ...i,
                    screened: { candidateId: r.candidateId, jobId: job.id, jobTitle: job.title, score: r.score, stage: "Screened" },
                    roles: [...i.roles, { candidateId: r.candidateId, jobId: job.id, jobTitle: job.title, score: r.score, stage: "Screened" }],
                  }
                : i
            ),
          }));
        } catch (err) {
          if (err.status === 409 && err.existingId) {
            setScreening((s) => ({ ...s, [id]: { status: "done" } }));
            setData((d) => ({
              ...d,
              items: d.items.map((i) => (i.id === id ? { ...i, screened: { candidateId: err.existingId, jobId: job.id, score: null } } : i)),
            }));
          } else {
            if (err.status === 429) stopRef.current = true;
            setScreening((s) => ({ ...s, [id]: { status: "failed", error: err.message } }));
          }
        }
        setSelected((sel) => sel.filter((x) => x !== id));
      }
    }
    await Promise.all(Array.from({ length: SCREEN_CONCURRENCY }, worker));
    // Anything still queued after a stop goes back to unscreened.
    setScreening((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v.status !== "queued")));
    setRunning(false);
    if (stopRef.current) toast("Hourly analysis limit reached - the rest weren't screened.", "error");
    else if (done) toast(`Screened ${done} for ${job.title}`);
  }

  const screenedForJob = useMemo(
    () => items.filter((i) => i.screened?.candidateId).sort((a, b) => (b.screened.score ?? -1) - (a.screened.score ?? -1)),
    [items]
  );
  const compareHref =
    job && screenedForJob.length >= 2
      ? `/analyse/compare?jobId=${job.id}&ids=${screenedForJob.slice(0, 4).map((i) => i.screened.candidateId).join(",")}`
      : null;

  const openJobs = jobs.filter((j) => j.status === "open");
  const closedJobs = jobs.filter((j) => j.status !== "open");

  return (
    <main className="min-h-screen bg-[var(--mist)]">
      <DashboardNav />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 text-[var(--ink-faint)]">Candidate database</p>
            <h1 className="text-2xl font-semibold text-[var(--ink)]" style={{ fontFamily: "var(--font-display)" }}>
              Talent pool
              {status === "ready" && <span className="text-base font-medium tabular-nums text-[var(--ink-faint)]"> · {data.total}</span>}
            </h1>
            <p className="text-[13px] text-[var(--ink-soft)] mt-1 max-w-2xl">
              People worth keeping for future roles. When a new job comes in, pick it below to see who fits - then screen the best
              from the CVs you already have.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PillButton href="/dashboard/candidates" icon="plus">
              Add from Candidates
            </PillButton>
            {compareHref && (
              <PillButton href={compareHref} primary icon="compare">
                Compare top {Math.min(4, screenedForJob.length)}
              </PillButton>
            )}
          </div>
        </header>

        <Card className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none">
                <Icon name="search" size={15} />
              </span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name, role, skill, location or note…"
                aria-label="Search the talent pool"
                className="w-full text-[14px] pl-10 pr-4 py-2.5 rounded-full border border-[var(--border)] bg-white text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)]"
              />
            </div>
            <label className="relative flex items-center lg:w-[360px]">
              <span className="sr-only">Match against a job</span>
              <span className="absolute left-4 text-[var(--forest)] pointer-events-none">
                <Icon name="briefcase" size={15} />
              </span>
              <select
                value={jobId}
                onChange={(e) => setJob(e.target.value)}
                disabled={running}
                className="w-full appearance-none text-[14px] font-semibold pl-10 pr-9 py-2.5 rounded-full border bg-white cursor-pointer disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ borderColor: jobId ? "var(--forest)" : "var(--border)", color: "var(--ink)" }}
              >
                <option value="">Match against a job…</option>
                {openJobs.length > 0 && (
                  <optgroup label="Open jobs">
                    {openJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                        {j.company ? ` · ${j.company}` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {closedJobs.length > 0 && (
                  <optgroup label="Closed jobs">
                    {closedJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                        {j.company ? ` · ${j.company}` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <Icon name="arrowRight" size={12} className="absolute right-4 rotate-90 text-[var(--ink-faint)] pointer-events-none" />
            </label>
          </div>

          {job && (
            <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-[var(--border-soft)]">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-faint)] mr-1">Looking for</span>
              {job.requiredSkills.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
              {job.minYearsExperience ? <Chip>{job.minYearsExperience}+ yrs</Chip> : null}
              {job.requiredSkills.length === 0 && !job.minYearsExperience && (
                <span className="text-[12.5px] text-[var(--ink-soft)]">
                  This job has no requirements listed yet, so there&apos;s nothing to pre-check - screening still works.
                </span>
              )}
              <Link href={`/dashboard/jobs/${job.id}`} className="ml-auto text-[12px] font-semibold text-[var(--forest)] hover:underline">
                View job →
              </Link>
            </div>
          )}
        </Card>

        {job && status === "ready" && pickable.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-[14px] px-4 py-3 border border-[var(--border)] bg-white">
            <span className="text-[13px] font-semibold text-[var(--ink)]">
              {selected.length ? `${selected.length} selected` : "Pick who to screen properly"}
            </span>
            {!running && (
              <>
                <button type="button" onClick={() => pickTop(5)} className="text-[12.5px] font-semibold text-[var(--forest)] hover:underline">
                  Select top 5 by fit
                </button>
                {selected.length > 0 && (
                  <button type="button" onClick={() => setSelected([])} className="text-[12.5px] font-semibold text-[var(--ink-soft)] hover:underline">
                    Clear
                  </button>
                )}
              </>
            )}
            <span className="text-[12px] text-[var(--ink-faint)] hidden md:inline">
              Each is a full analysis against this job and appears in the pipeline under it.
            </span>
            <span className="ml-auto flex items-center gap-2">
              {running && (
                <PillButton onClick={() => (stopRef.current = true)} icon="x">
                  Stop
                </PillButton>
              )}
              <PillButton primary disabled={running || selected.length === 0} onClick={screenSelected} icon={running ? undefined : "sparkle"}>
                {running ? (
                  <>
                    <Spinner size={13} /> Screening…
                  </>
                ) : (
                  `Screen ${selected.length || ""} for ${job.title}`.replace("  ", " ")
                )}
              </PillButton>
            </span>
          </div>
        )}

        {status === "loading" && <PoolSkeleton />}
        {status === "error" && (
          <Notice tone="error" action={<button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline">Try again</button>}>
            {error}
          </Notice>
        )}

        {status === "ready" && data.total === 0 && (
          <Card className="p-8 sm:p-10 text-center">
            <span className="mx-auto w-11 h-11 rounded-full bg-[var(--mint)] text-[var(--forest)] flex items-center justify-center mb-3">
              <Icon name="bookmark" size={18} />
            </span>
            <p className="text-[15px] font-semibold text-[var(--ink)]">Your talent pool is empty</p>
            <p className="text-[13px] text-[var(--ink-soft)] mt-1 max-w-md mx-auto">
              Save strong candidates who weren&apos;t right for this role - from their profile (&ldquo;Save to talent pool&rdquo;) or by selecting
              several on the Candidates list. When a new job comes in, they&apos;re ready to screen without re-uploading their CV.
            </p>
            <div className="mt-5 flex justify-center">
              <PillButton href="/dashboard/candidates" primary icon="arrowRight">
                Go to Candidates
              </PillButton>
            </div>
          </Card>
        )}

        {status === "ready" && data.total > 0 && items.length === 0 && (
          <Card className="p-8 text-center text-[13px] text-[var(--ink-soft)]">No one in the pool matches &ldquo;{search}&rdquo;.</Card>
        )}

        {status === "ready" && items.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-[var(--border-soft)]">
              {items.map((item) => (
                <PoolRow
                  key={item.id}
                  item={item}
                  job={job}
                  selected={selected.includes(item.id)}
                  onToggle={toggle}
                  screening={screening[item.id]}
                  onRemove={removeItem}
                  removing={removingId === item.id}
                />
              ))}
            </ul>
          </Card>
        )}

        {job && status === "ready" && items.length > 0 && (
          <p className="text-[12px] text-[var(--ink-faint)]">
            Fit is a quick check of which of the job&apos;s requirements appear in each CV - it&apos;s free and instant, but only a guide.
            Screening gives the real match score.
          </p>
        )}
      </div>
      <Toasts toasts={toasts} />
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
