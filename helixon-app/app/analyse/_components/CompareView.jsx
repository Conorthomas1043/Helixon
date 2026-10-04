"use client";

// Side-by-side comparison of 2-4 saved candidates (app/analyse/compare,
// the "Compare" tab). Data from /api/compare; the grid, winners and verdict
// come from ../_lib/compare.js. Two views: "Scores" (the analysis, below)
// and "Raw CVs" (RawCvCompare.jsx - the CVs themselves side by side).
// Candidates can come from one role or be chosen from anyone already
// screened (CandidateChooser.jsx).

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { Card, Icon, Notice, Spinner, cx } from "./ui";
import CandidateChooser from "./CandidateChooser";
import RawCvCompare from "./RawCvCompare";
import { LETTERS, PillButton, PillTabs, StagePicker, openOriginalCv } from "./compareBits";
import { printSection } from "@/lib/print";
import { scoreTone } from "../_lib/analyse";
import { columnLabels, coverage, mustHaveRows, skillRows, verdict, winners } from "../_lib/compare";

// ── Formatting ──────────────────────────────────────────────────────────

function fmtPay(salary) {
  if (!salary?.low) return null;
  const period = salary.period || "year";
  const currency = salary.currency || "GBP";
  const hourly = period === "hour" || period === "day";
  const fmt = (n) => {
    try {
      return new Intl.NumberFormat("en-GB", hourly
        ? { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }
        : { style: "currency", currency, notation: "compact", maximumSignificantDigits: 3 }).format(n);
    } catch {
      return String(n);
    }
  };
  const range = salary.high && salary.high !== salary.low ? `${fmt(salary.low)}–${fmt(salary.high)}` : fmt(salary.low);
  return `${range}${period === "hour" ? " an hour" : period === "day" ? " a day" : ""}`;
}

const MUST_HAVE = {
  met: { label: "Met", icon: "check", cls: "bg-[var(--mint)] text-[var(--forest-deep)] border-[#cfe6da]" },
  not_met: { label: "Not met", icon: "x", cls: "bg-[#fbefed] text-[#a83226] border-[#f2d2cd]" },
  unverified: { label: "To confirm", icon: "info", cls: "bg-white text-[var(--ink-soft)] border-[var(--border)]" },
};

const SKILL = {
  strong: "bg-[var(--mint)] text-[var(--forest-deep)] border-[#cfe6da]",
  weak: "bg-[#fdf6e9] text-[#8a5a12] border-[#f1dfbc]",
  missing: "bg-[#fbefed] text-[#a83226] border-[#f2d2cd]",
  unknown: "bg-white text-[var(--ink-faint)] border-[var(--border)]",
};

// ── Layout pieces ───────────────────────────────────────────────────────

// Columns share the card's width; below ~190px each the grid keeps its
// minimum and the card scrolls sideways (label column stays pinned).
// Not `min-w-max`: that sizes every column to its longest unwrapped line
// (a strengths sentence), pushing later candidates off the edge.
function gridStyle(n) {
  return {
    gridTemplateColumns: `minmax(150px, 190px) repeat(${n}, minmax(190px, 1fr))`,
    minWidth: `${170 + n * 200}px`,
  };
}

function RowLabel({ children, hint }) {
  return (
    <div className="sticky left-0 z-[1] bg-white px-4 py-3 border-t border-[var(--border-soft)]">
      <p className="text-[12.5px] font-medium text-[var(--ink)] leading-snug">{children}</p>
      {hint && <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">{hint}</p>}
    </div>
  );
}

function Cell({ children, best }) {
  return (
    <div className={cx("px-4 py-3 border-t border-[var(--border-soft)] min-w-0", best && "bg-[#f4faf7]")}>{children}</div>
  );
}

function SectionRow({ n, title, extra }) {
  return (
    <div className="contents">
      <div className="sticky left-0 z-[1] bg-[var(--mist)] px-4 pt-5 pb-2 border-t border-[var(--border)]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-soft)]">{title}</p>
      </div>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="bg-[var(--mist)] px-4 pt-5 pb-2 border-t border-[var(--border)] text-[11.5px] text-[var(--ink-soft)] tabular-nums">
          {extra?.[i] ?? ""}
        </div>
      ))}
    </div>
  );
}

function BestTag() {
  return <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--forest)]">Best</span>;
}

function ScoreBar({ value, best }) {
  if (value == null) return <span className="text-[13px] text-[var(--ink-faint)]">–</span>;
  const tone = scoreTone(value);
  return (
    <div>
      <div className="flex items-baseline">
        <span className="text-[15px] font-semibold tabular-nums" style={{ color: tone.fg }}>{value}</span>
        {best && <BestTag />}
      </div>
      <div className="h-1.5 rounded-full bg-[var(--mist)] mt-1.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: tone.fg }} />
      </div>
    </div>
  );
}

function Pill({ className, icon, children, title }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11.5px] font-medium", className)}>
      {icon && <Icon name={icon} size={11} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

function Bullets({ items, tone }) {
  if (!items.length) return <span className="text-[12.5px] text-[var(--ink-faint)]">None noted</span>;
  return (
    <ul className="space-y-1.5">
      {items.slice(0, 4).map((t, i) => (
        <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug text-[var(--ink-soft)]">
          <span className={cx("mt-[6px] w-1.5 h-1.5 rounded-full shrink-0", tone === "bad" ? "bg-[var(--score-low)]" : "bg-[var(--forest)]")} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Candidate header ────────────────────────────────────────────────────

function CandidateHeader({ c, label, index, onRemove, canRemove, isLeader, onStageChanged }) {
  const tone = scoreTone(c.matchScore);
  const [opening, setOpening] = useState(false);

  async function openCv() {
    setOpening(true);
    await openOriginalCv(c);
    setOpening(false);
  }

  return (
    <div className={cx("px-4 pt-4 pb-4 min-w-0 relative", isLeader && "bg-[#f4faf7]")}>
      <div className="flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-full bg-[var(--ink)] text-white text-[12px] font-semibold flex items-center justify-center shrink-0">{LETTERS[index]}</span>
        <div className="min-w-0 flex-1">
          <Link href={`/dashboard/candidates/${c.id}`} className="block text-[14px] font-semibold text-[var(--ink)] truncate hover:underline" title={label}>
            {label}
          </Link>
          <p className="text-[11.5px] text-[var(--ink-faint)] truncate">
            {c.blind ? "Screened blind" : [c.currentTitle, c.currentCompany].filter(Boolean).join(" · ") || "No current role on file"}
          </p>
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${label} from the comparison`} className="p-1 -mr-1 rounded text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--mist)]">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 mt-3">
        <div>
          <span className="text-[30px] leading-none font-semibold tabular-nums" style={{ color: tone.fg, fontFamily: "var(--font-display)" }}>
            {c.matchScore ?? "–"}
          </span>
          <span className="text-[12px] text-[var(--ink-faint)] ml-1">/100</span>
        </div>
        {isLeader && <Pill className="bg-[var(--forest)] text-white border-[var(--forest)]" icon="check">Top match</Pill>}
      </div>
      <p className="text-[12px] font-medium mt-1.5" style={{ color: tone.fg }}>{c.recommendation || tone.label}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-[12px]">
        <Link href={`/dashboard/candidates/${c.id}`} className="font-semibold text-[var(--forest)] hover:underline">Profile</Link>
        {c.hasCv && (
          <button type="button" onClick={openCv} disabled={opening} className="font-semibold text-[var(--forest)] hover:underline disabled:opacity-50">
            {opening ? "Opening…" : "Open CV"}
          </button>
        )}
      </div>
      <div className="mt-3">
        <StagePicker candidateId={c.id} stage={c.stage} onChanged={(stage) => onStageChanged(c.id, stage)} />
      </div>
      {c.otherRole && <p className="text-[11px] mt-2 text-[#8a5a12]">Scored against a different role</p>}
      {!c.analysed && <p className="text-[11px] mt-2 text-[#8a5a12]">No saved analysis</p>}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function CompareWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const jobIdParam = params.get("jobId") || "";
  const idsParam = params.get("ids") || "";
  const view = params.get("view") === "raw" ? "raw" : "scores";
  const ids = useMemo(() => idsParam.split(",").map((s) => s.trim()).filter(Boolean), [idsParam]);

  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const setIds = useCallback(
    (next) => {
      const q = new URLSearchParams();
      if (jobIdParam || data?.job?.id) q.set("jobId", jobIdParam || data.job.id);
      if (next.length) q.set("ids", next.join(","));
      if (view === "raw") q.set("view", "raw");
      router.replace(`/analyse/compare?${q.toString()}`);
    },
    [router, jobIdParam, data, view]
  );

  const setView = useCallback(
    (next) => {
      const q = new URLSearchParams(params.toString());
      if (next === "raw") q.set("view", "raw");
      else q.delete("view");
      router.replace(`/analyse/compare?${q.toString()}`);
    },
    [router, params]
  );

  // Choosing from everyone already screened: in the empty state (a draft
  // list, then Compare), or added straight in from the "Add candidate" panel.
  const [draft, setDraft] = useState([]);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  // A stage change made here shows straight away in both views.
  const onStageChanged = useCallback((id, stage) => {
    setData((d) => (d ? { ...d, candidates: d.candidates.map((c) => (c.id === id ? { ...c, stage } : c)) } : d));
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked - nothing useful to do */
    }
  }

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams();
    if (idsParam) q.set("ids", idsParam);
    if (jobIdParam) q.set("jobId", jobIdParam);
    fetch(`/api/compare?${q.toString()}`, { credentials: "include" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body) {
          setError(body?.error || "Couldn't load the comparison.");
          setStatus("error");
          return;
        }
        setData(body);
        setStatus("ready");
        // Arriving from a job with nobody picked yet: start with the top 3.
        if (!idsParam && body.pool?.length >= 2) {
          const q2 = new URLSearchParams({ jobId: jobIdParam || body.job?.id || "", ids: body.pool.slice(0, 3).map((p) => p.id).join(",") });
          router.replace(`/analyse/compare?${q2.toString()}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't reach the server. Check your connection.");
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [idsParam, jobIdParam, router]);

  const candidates = useMemo(() => data?.candidates || [], [data]);
  const job = data?.job || null;
  const labels = useMemo(() => columnLabels(candidates), [candidates]);
  const required = useMemo(() => skillRows(job, candidates, "required"), [job, candidates]);
  const preferred = useMemo(() => skillRows(job, candidates, "preferred"), [job, candidates]);
  const mustHaves = useMemo(() => mustHaveRows(candidates), [candidates]);
  const lines = useMemo(() => verdict(candidates, labels, required, mustHaves), [candidates, labels, required, mustHaves]);
  const leader = winners(candidates.map((c) => c.matchScore));
  const n = candidates.length;

  const scoreRowDefs = [
    { label: "Overall match", key: "matchScore" },
    { label: "Skills", key: "skillScore", hint: "Required and preferred skills, by depth" },
    { label: "Experience", key: "experienceScore", hint: "Relevant years and career" },
    { label: "Industry relevance", key: "industryScore", rationale: "industry" },
    { label: "Achievements", key: "achievementScore", rationale: "achievements" },
  ].filter((r) => candidates.some((c) => c[r.key] != null));

  return (
    <main className="min-h-screen bg-[var(--mist)]">
      <DashboardNav />
      <div id="compare-print" className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 text-[var(--ink-faint)]">Compare candidates</p>
            <h1 className="text-2xl font-semibold text-[var(--ink)] truncate" style={{ fontFamily: "var(--font-display)" }}>
              {job && n >= 2 ? job.title : "Side by side"}
            </h1>
            <p className="text-[13px] text-[var(--ink-soft)] mt-1">
              {status === "ready" && n >= 2
                ? [job?.client, `${n} candidates`].filter(Boolean).join(" · ")
                : "Put 2 to 4 screened candidates next to each other - their scores, or their CVs."}
            </p>
          </div>
          {status === "ready" && n >= 2 && (
            <div className="flex flex-wrap items-center gap-2 print-hide">
              <PillButton icon="printer" onClick={() => printSection("compare-print")} title="Print, or choose Save as PDF to send it">
                Print / PDF
              </PillButton>
              {job && (
                <PillButton href={`/dashboard/jobs/${job.id}`} icon="briefcase">
                  View job
                </PillButton>
              )}
              <PillButton icon={copied ? "check" : "copy"} onClick={copyLink}>
                {copied ? "Link copied" : "Copy link"}
              </PillButton>
              {ids.length < (data.max || 4) && (
                <PillButton primary icon="plus" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
                  Add candidate
                </PillButton>
              )}
            </div>
          )}
        </header>

        {status === "ready" && n >= 2 && (
          <div className="flex flex-wrap items-center justify-between gap-3 print-hide">
            <PillTabs
              value={view}
              onChange={setView}
              ariaLabel="What to compare"
              options={[
                { value: "scores", label: "Scores", icon: "compare" },
                { value: "raw", label: "Raw CVs", icon: "file" },
              ]}
            />
            <p className="text-[12.5px] text-[var(--ink-faint)]">
              {view === "raw" ? "Each CV as it was uploaded - jump them all to the same section." : "Scored against the role - best in each row highlighted."}
            </p>
          </div>
        )}

        {status === "loading" && (
          <Card className="p-10 flex items-center justify-center gap-3 text-[13px] text-[var(--ink-soft)]">
            <Spinner /> Loading the comparison…
          </Card>
        )}

        {status === "error" && <Notice tone="error">{error}</Notice>}

        {status === "ready" && n < 2 && (
          <Card className="p-5 sm:p-6">
            <p className="text-[15px] font-semibold text-[var(--ink)]">Choose who to compare</p>
            <p className="text-[13px] text-[var(--ink-soft)] mt-1 mb-4">
              Pick two to four candidates you&apos;ve already screened - then compare their scores, or their CVs side by side.
            </p>
            <CandidateChooser
              selected={[...new Set([...ids, ...draft])]}
              max={data.max || 4}
              pool={data.pool || []}
              knownPeople={candidates}
              onToggle={(id) => {
                if (ids.includes(id)) setIds(ids.filter((x) => x !== id));
                else setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
              }}
              onCompare={() => {
                setIds([...new Set([...ids, ...draft])]);
                setDraft([]);
              }}
            />
          </Card>
        )}

        {status === "ready" && n >= 2 && adding && (
          <Card className="p-5 sm:p-6 print-hide">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[15px] font-semibold text-[var(--ink)]">Add a candidate</p>
                <p className="text-[13px] text-[var(--ink-soft)] mt-0.5">Anyone you&apos;ve screened - up to {data.max || 4} side by side.</p>
              </div>
              <button type="button" onClick={() => setAdding(false)} aria-label="Close" className="p-1.5 rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--mist)]">
                <Icon name="x" size={16} />
              </button>
            </div>
            <CandidateChooser
              selected={ids}
              max={data.max || 4}
              pool={data.pool || []}
              knownPeople={candidates}
              onToggle={(id) => {
                setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
                if (!ids.includes(id) && ids.length + 1 >= (data.max || 4)) setAdding(false);
              }}
            />
          </Card>
        )}

        {status === "ready" && n >= 2 && view === "raw" && (
          <RawCvCompare
            candidates={candidates}
            labels={labels}
            onRemove={n > 2 ? (id) => setIds(ids.filter((x) => x !== id)) : undefined}
            onStageChanged={onStageChanged}
          />
        )}

        {status === "ready" && n >= 2 && view === "scores" && (
          <>
            {lines.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-2.5">
                  <Icon name="compare" size={16} className="text-[var(--forest)]" />
                  <h2 className="text-[14px] font-semibold text-[var(--ink)]">At a glance</h2>
                </div>
                <ul className="space-y-1.5">
                  {lines.map((l, i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-[var(--ink)]">
                      <span className="mt-[9px] w-1 h-1 rounded-full bg-[var(--ink-faint)] shrink-0" />
                      {l}
                    </li>
                  ))}
                </ul>
                <p className="text-[11.5px] text-[var(--ink-faint)] mt-3">A summary of the numbers below - use it alongside your own judgement, not instead of it.</p>
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <div className="grid w-full" style={gridStyle(n)}>
                  {/* Header */}
                  <div className="sticky left-0 z-[1] bg-white px-4 pt-4 pb-4 flex items-end">
                    <p className="text-[11.5px] text-[var(--ink-faint)]">{n} candidates · best in each row highlighted</p>
                  </div>
                  {candidates.map((c, i) => (
                    <CandidateHeader
                      key={c.id}
                      c={c}
                      index={i}
                      label={labels[i]}
                      isLeader={leader.length === 1 && leader[0] === i}
                      canRemove={n > 2}
                      onRemove={() => setIds(ids.filter((id) => id !== c.id))}
                      onStageChanged={onStageChanged}
                    />
                  ))}

                  {/* Scores */}
                  <SectionRow n={n} title="Scores" />
                  {scoreRowDefs.map((row) => {
                    const values = candidates.map((c) => c[row.key]);
                    const best = winners(values);
                    return (
                      <Fragment key={row.key}>
                        <RowLabel hint={row.hint}>{row.label}</RowLabel>
                        {candidates.map((c, i) => (
                          <Cell key={c.id} best={best.includes(i)}>
                            <div title={row.rationale ? c.rationale?.[row.rationale] || undefined : undefined}>
                              <ScoreBar value={values[i]} best={best.includes(i)} />
                            </div>
                          </Cell>
                        ))}
                      </Fragment>
                    );
                  })}

                  {/* Required skills */}
                  {required.length > 0 && (
                    <>
                      <SectionRow
                        n={n}
                        title="Required skills"
                        extra={candidates.map((c, i) => {
                          const cov = coverage(required, i);
                          return cov.of ? `${cov.met} of ${cov.of} shown` : "";
                        })}
                      />
                      {required.map((row) => (
                        <Fragment key={row.skill}>
                          <RowLabel hint={row.importance && row.importance !== "Medium" ? `${row.importance} importance` : undefined}>{row.skill}</RowLabel>
                          {row.cells.map((cell, i) => (
                            <Cell key={i}>
                              <Pill
                                className={SKILL[cell.state]}
                                icon={cell.state === "missing" ? "x" : cell.state === "unknown" ? null : "check"}
                                title={cell.evidence ? `From the CV: “${cell.evidence}”` : undefined}
                              >
                                {cell.label}
                                {cell.stale ? " · a while ago" : ""}
                              </Pill>
                              {cell.evidence && (
                                <p className="text-[11.5px] italic text-[var(--ink-faint)] mt-1.5 line-clamp-2">“{cell.evidence}”</p>
                              )}
                            </Cell>
                          ))}
                        </Fragment>
                      ))}
                    </>
                  )}

                  {/* Preferred skills */}
                  {preferred.length > 0 && (
                    <>
                      <SectionRow
                        n={n}
                        title="Nice to have"
                        extra={candidates.map((c, i) => {
                          const cov = coverage(preferred, i);
                          return cov.of ? `${cov.met} of ${cov.of}` : "";
                        })}
                      />
                      {preferred.map((row) => (
                        <Fragment key={row.skill}>
                          <RowLabel>{row.skill}</RowLabel>
                          {row.cells.map((cell, i) => (
                            <Cell key={i}>
                              <Pill className={SKILL[cell.state]} icon={cell.state === "missing" ? "x" : cell.state === "unknown" ? null : "check"}>
                                {cell.label}
                              </Pill>
                            </Cell>
                          ))}
                        </Fragment>
                      ))}
                    </>
                  )}

                  {/* Must-haves */}
                  {mustHaves.length > 0 && (
                    <>
                      <SectionRow n={n} title="Must-haves" />
                      {mustHaves.map((row) => (
                        <Fragment key={row.requirement}>
                          <RowLabel>{row.requirement.replace(/^[a-z_]+:\s*/i, (m) => m.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()))}</RowLabel>
                          {row.cells.map((status, i) => (
                            <Cell key={i}>
                              {status ? (
                                <Pill className={MUST_HAVE[status]?.cls} icon={MUST_HAVE[status]?.icon}>{MUST_HAVE[status]?.label || status}</Pill>
                              ) : (
                                <span className="text-[12.5px] text-[var(--ink-faint)]">Not checked</span>
                              )}
                            </Cell>
                          ))}
                        </Fragment>
                      ))}
                    </>
                  )}

                  {/* Experience & pay */}
                  <SectionRow n={n} title="Experience and pay" />
                  {(() => {
                    const years = candidates.map((c) => c.relevantYears);
                    const best = winners(years);
                    return (
                      <>
                        <RowLabel hint={job?.minYears ? `Role asks for ${job.minYears}+` : undefined}>Relevant experience</RowLabel>
                        {candidates.map((c, i) => (
                          <Cell key={c.id} best={best.includes(i)}>
                            <p className="text-[13.5px] text-[var(--ink)]" title={c.rationale?.experience || undefined}>
                              {c.relevantYears != null ? `${c.relevantYears} yrs` : "–"}
                              {best.includes(i) && <BestTag />}
                            </p>
                            {c.totalYears != null && c.totalYears !== c.relevantYears && (
                              <p className="text-[11.5px] text-[var(--ink-faint)]">{c.totalYears} yrs in total</p>
                            )}
                          </Cell>
                        ))}
                      </>
                    );
                  })()}
                  <RowLabel>Career</RowLabel>
                  {candidates.map((c) => (
                    <Cell key={c.id}>
                      <p className="text-[13px] text-[var(--ink)]" title={c.rationale?.career || undefined}>
                        {c.career === "Positive" ? "Progressing" : c.career === "Regression" ? "Stepped down" : c.career === "Static" ? "Steady" : "Not enough history"}
                      </p>
                    </Cell>
                  ))}
                  <RowLabel hint="A rough guide, not an offer">Pay guide</RowLabel>
                  {candidates.map((c) => (
                    <Cell key={c.id}>
                      <p className="text-[13px] text-[var(--ink)] tabular-nums">{fmtPay(c.salary) || "–"}</p>
                    </Cell>
                  ))}

                  {/* Strengths & concerns */}
                  <SectionRow n={n} title="Strengths and concerns" />
                  <RowLabel>Strengths</RowLabel>
                  {candidates.map((c) => (
                    <Cell key={c.id}>
                      <Bullets items={[...c.standout, ...c.strengths].filter((v, i, a) => a.indexOf(v) === i)} />
                    </Cell>
                  ))}
                  <RowLabel>Concerns</RowLabel>
                  {candidates.map((c) => (
                    <Cell key={c.id}>
                      <Bullets items={[...c.redFlags, ...c.weaknesses]} tone="bad" />
                    </Cell>
                  ))}
                </div>
              </div>
            </Card>

            <p className="text-[12px] text-[var(--ink-faint)]">Hover a score for the reasoning behind it. Skill quotes are taken word for word from each CV.</p>
          </>
        )}
      </div>
    </main>
  );
}
