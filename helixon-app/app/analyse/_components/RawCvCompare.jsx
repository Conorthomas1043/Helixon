"use client";

// "Raw CVs" view of the compare page: each candidate's CV exactly as it was
// read from their file, side by side.
//   - Jump to a section (Contact info, Strengths, Experience...) and every
//     CV scrolls to that part at once, highlighted.
//   - Find a word or phrase ("Salesforce", "team of") across all the CVs:
//     every match is highlighted and each CV steps through its own matches.
//   - "Scroll together" keeps the columns moving in step while reading.
//   - Move a candidate's stage or open their original file from the column.
// Display only: the CV text comes from /api/candidates/[id]/cv?format=text
// and nothing about the analysis changes.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, Icon, Spinner, Switch, cx } from "./ui";
import { Avatar, LETTERS, StagePicker, openOriginalCv } from "./compareBits";
import { CV_SECTIONS, parseCvSections, resolveSection, sectionLabel, sectionRange } from "../_lib/cvSections";

// id -> { status: "ready", text } | { status: "error", error }. No entry
// yet means still loading.
function useCvTexts(ids) {
  const [texts, setTexts] = useState({});
  const requested = useRef(new Set());
  const key = ids.join(",");

  useEffect(() => {
    for (const id of key.split(",").filter(Boolean)) {
      if (requested.current.has(id)) continue;
      requested.current.add(id);
      fetch(`/api/candidates/${id}/cv?format=text`, { credentials: "include" })
        .then(async (res) => {
          const body = await res.json().catch(() => null);
          setTexts((t) => ({
            ...t,
            [id]: res.ok && body?.text ? { status: "ready", text: body.text } : { status: "error", error: body?.error || "Couldn't load this CV." },
          }));
        })
        .catch(() => {
          requested.current.delete(id);
          setTexts((t) => ({ ...t, [id]: { status: "error", error: "Couldn't reach the server." } }));
        });
    }
  }, [key]);

  return texts;
}

const MIN_FIND = 2;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A line with every occurrence of the search term wrapped in <mark>.
function Highlighted({ line, re, current }) {
  if (!re) return line || " ";
  const parts = line.split(re);
  if (parts.length === 1) return line || " ";
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className={cx("rounded-[3px] px-0.5 text-[var(--ink)]", current ? "bg-[#f5c451]" : "bg-[#fbe7a6]")}>
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function CvColumn({ c, letter, name, entry, parsed, active, find, findStep, revealed, onReveal, onRemove, onStageChanged, registerScroller, onScroll }) {
  const scrollerRef = useRef(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    registerScroller(c.id, scrollerRef.current);
    return () => registerScroller(c.id, null);
  }, [c.id, registerScroller]);

  const hidden = c.blind && !revealed;
  const target = active && parsed ? resolveSection(parsed, active) : null;
  const range = target ? sectionRange(parsed, target.line) : null;
  const highlightContact = active === "contact" && parsed;
  const matchLines = find.lines;
  const currentMatch = matchLines.length ? matchLines[findStep % matchLines.length] : null;

  let status = c.currentTitle || " ";
  if (find.re && parsed && !hidden) {
    status = matchLines.length ? `${matchLines.length} match${matchLines.length === 1 ? "" : "es"} · showing ${(findStep % matchLines.length) + 1}` : "No matches";
  } else if (active && parsed) {
    status = target
      ? target.key === active
        ? `${sectionLabel(active)} · line ${target.line + 1}`
        : `No ${sectionLabel(active)} heading - showing ${sectionLabel(target.key)}`
      : `No ${sectionLabel(active)} section in this CV`;
  }

  async function openFile() {
    setOpening(true);
    await openOriginalCv(c);
    setOpening(false);
  }

  return (
    <div className="min-w-0 flex flex-col border-l first:border-l-0 border-[var(--border)]">
      <div className="px-4 py-3.5 border-b border-[var(--border)] bg-white space-y-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar letter={letter} size={32} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[var(--ink)] truncate">{hidden ? `Candidate ${letter}` : name}</p>
            <p className={cx("text-[12px] truncate", find.re && parsed && !hidden && !matchLines.length ? "text-[#8a5a12]" : "text-[var(--ink-soft)]")}>{status}</p>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(c.id)}
              aria-label={`Remove candidate ${letter} from the comparison`}
              className="p-1.5 -mr-1 rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--mist)] shrink-0"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <StagePicker candidateId={c.id} stage={c.stage} onChanged={(stage) => onStageChanged?.(c.id, stage)} />
          {c.hasCv && (
            <button type="button" onClick={openFile} disabled={opening} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--forest)] hover:underline disabled:opacity-50">
              <Icon name="external" size={12} />
              {opening ? "Opening…" : "Original file"}
            </button>
          )}
        </div>
      </div>

      <div ref={scrollerRef} onScroll={() => onScroll(c.id)} className="relative h-[68vh] overflow-y-auto bg-white px-4 py-3">
        {!entry ? (
          <div className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)] py-6">
            <Spinner /> Loading CV…
          </div>
        ) : entry.status === "error" ? (
          <p className="text-[13px] text-[var(--ink-soft)] py-6">{entry.error}</p>
        ) : hidden ? (
          <div className="py-12 text-center">
            <span className="mx-auto w-10 h-10 rounded-full bg-[var(--mist)] border border-[var(--border)] flex items-center justify-center text-[var(--ink-soft)]">
              <Icon name="eyeOff" size={18} />
            </span>
            <p className="text-[13.5px] text-[var(--ink)] font-semibold mt-3">Screened blind</p>
            <p className="text-[12.5px] text-[var(--ink-soft)] mt-1 max-w-[240px] mx-auto">Their CV shows their name and contact details.</p>
            <button
              type="button"
              onClick={onReveal}
              className="mt-4 inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-[var(--mist)]"
            >
              Show the CV
            </button>
          </div>
        ) : (
          <div className="text-[12.5px] leading-[1.6] text-[var(--ink)]">
            {parsed.lines.map((line, i) => {
              const isHeading = parsed.headings.has(i);
              const inSection = range && i >= range.start && i <= range.end;
              const contact = highlightContact && parsed.contactLines.has(i);
              return (
                <div
                  key={i}
                  data-line={i}
                  className={cx(
                    "px-1.5 -mx-1.5 rounded-[4px] whitespace-pre-wrap break-words min-h-[1.6em] transition-colors",
                    isHeading && "font-semibold text-[13px] mt-2",
                    inSection && "bg-[#f4faf7]",
                    target && i === target.line && "bg-[var(--mint)] text-[var(--forest-deep)]",
                    contact && "bg-[var(--mint)]",
                    currentMatch === i && "ring-1 ring-[#e0b43a]"
                  )}
                >
                  <Highlighted line={line} re={find.re} current={currentMatch === i} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RawCvCompare({ candidates, labels, onRemove, onStageChanged }) {
  const ids = useMemo(() => candidates.map((c) => c.id), [candidates]);
  const texts = useCvTexts(ids);
  const [active, setActive] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [findText, setFindText] = useState("");
  const [findStep, setFindStep] = useState(0);
  const [sync, setSync] = useState(false);
  const scrollers = useRef(new Map());
  // While one column (or a jump) is moving the others, ignore the scroll
  // events those moves fire, or the columns chase each other.
  const lock = useRef(null);
  const lockTimer = useRef(null);

  const registerScroller = useCallback((id, el) => {
    if (el) scrollers.current.set(id, el);
    else scrollers.current.delete(id);
  }, []);

  const parsedById = useMemo(() => {
    const out = {};
    for (const id of ids) if (texts[id]?.status === "ready") out[id] = parseCvSections(texts[id].text);
    return out;
  }, [ids, texts]);

  const isVisible = useCallback((c) => Boolean(parsedById[c.id]) && (!c.blind || revealed[c.id]), [parsedById, revealed]);

  // How many of the CVs each section can be found in (fallbacks count).
  const found = useMemo(() => {
    const out = {};
    for (const s of CV_SECTIONS) {
      out[s.key] = candidates.filter((c) => parsedById[c.id] && resolveSection(parsedById[c.id], s.key)).length;
    }
    return out;
  }, [candidates, parsedById]);

  // Find: the regex and, per CV, the lines that contain the term.
  const term = findText.trim();
  const findRe = useMemo(() => (term.length >= MIN_FIND ? new RegExp(`(${escapeRegExp(term)})`, "gi") : null), [term]);
  const findLines = useMemo(() => {
    const out = {};
    if (!findRe) return out;
    const test = new RegExp(escapeRegExp(term), "i");
    for (const c of candidates) {
      const parsed = parsedById[c.id];
      out[c.id] = parsed && isVisible(c) ? parsed.lines.map((l, i) => (test.test(l) ? i : -1)).filter((i) => i >= 0) : [];
    }
    return out;
  }, [findRe, term, candidates, parsedById, isVisible]);
  const cvsWithMatches = Object.values(findLines).filter((l) => l.length).length;
  const totalMatches = Object.values(findLines).reduce((sum, l) => sum + l.length, 0);

  const holdSync = useCallback((ms, who = "jump") => {
    lock.current = who;
    clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      lock.current = null;
    }, ms);
  }, []);

  const scrollColumnTo = useCallback((id, line) => {
    const el = scrollers.current.get(id);
    if (!el) return;
    const row = line != null ? el.querySelector(`[data-line="${line}"]`) : null;
    el.scrollTo({ top: row ? Math.max(0, row.offsetTop - 2) : 0, behavior: "smooth" });
  }, []);

  // Every CV to the section's heading.
  const jumpTo = useCallback(
    (key) => {
      holdSync(800);
      for (const c of candidates) {
        const parsed = parsedById[c.id];
        if (!parsed) continue;
        const target = key ? resolveSection(parsed, key) : null;
        scrollColumnTo(c.id, target?.line ?? null);
      }
    },
    [candidates, parsedById, scrollColumnTo, holdSync]
  );

  // Every CV to its own current match.
  const showMatches = useCallback(
    (step) => {
      holdSync(800);
      for (const c of candidates) {
        const lines = findLines[c.id] || [];
        if (lines.length) scrollColumnTo(c.id, lines[step % lines.length]);
      }
    },
    [candidates, findLines, scrollColumnTo, holdSync]
  );

  useEffect(() => {
    if (findRe) showMatches(findStep);
  }, [findRe, findStep, showMatches]);

  // Re-apply the section after a blind CV is revealed, so it lines up.
  useEffect(() => {
    if (active) jumpTo(active);
  }, [revealed, active, jumpTo]);

  function chooseSection(key) {
    setActive(key);
    jumpTo(key);
  }

  function onColumnScroll(sourceId) {
    if (!sync || (lock.current && lock.current !== sourceId)) return;
    const src = scrollers.current.get(sourceId);
    if (!src) return;
    holdSync(120, sourceId);
    const ratio = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
    for (const [id, el] of scrollers.current) {
      if (id === sourceId) continue;
      el.scrollTo({ top: ratio * (el.scrollHeight - el.clientHeight), behavior: "instant" });
    }
  }

  const n = candidates.length;
  const loaded = candidates.filter(isVisible).length;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <form
            className="flex items-center gap-2 flex-1 min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              if (findRe) setFindStep((s) => s + 1);
            }}
          >
            <input
              value={findText}
              onChange={(e) => {
                setFindText(e.target.value);
                setFindStep(0);
              }}
              placeholder="Find in all CVs - e.g. Salesforce, team of, GCSE…"
              aria-label="Find in all CVs"
              className="flex-1 min-w-0 text-[14px] px-5 py-2.5 rounded-full border border-[var(--border)] bg-white text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)]"
            />
            {findRe && (
              <>
                <span className="hidden sm:inline text-[12.5px] text-[var(--ink-soft)] whitespace-nowrap tabular-nums">
                  {totalMatches ? `${totalMatches} in ${cvsWithMatches} of ${n} CVs` : "No matches"}
                </span>
                <button
                  type="button"
                  onClick={() => setFindStep((s) => Math.max(0, s - 1))}
                  disabled={!totalMatches || findStep === 0}
                  aria-label="Previous match"
                  className="p-2 rounded-full border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-[var(--mist)] disabled:opacity-40"
                >
                  <Icon name="arrowRight" size={13} className="-rotate-90" />
                </button>
                <button
                  type="submit"
                  disabled={!totalMatches}
                  aria-label="Next match"
                  className="p-2 rounded-full border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-[var(--mist)] disabled:opacity-40"
                >
                  <Icon name="arrowRight" size={13} className="rotate-90" />
                </button>
              </>
            )}
          </form>
          <div className="shrink-0">
            <Switch id="sync-scroll" checked={sync} onChange={setSync} label="Scroll together" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">Jump every CV to</p>
            {active && (
              <button type="button" onClick={() => chooseSection(null)} className="text-[12px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                Back to top
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Jump to a CV section">
            {CV_SECTIONS.map((s) => {
              const count = found[s.key];
              const on = active === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => chooseSection(s.key)}
                  disabled={count === 0}
                  aria-pressed={on}
                  title={count === 0 ? `No ${s.label} section in these CVs` : `Found in ${count} of ${n}`}
                  className={cx(
                    "inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                    on ? "bg-[var(--forest)] border-[var(--forest)] text-white" : "bg-white border-[var(--border)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  )}
                >
                  {s.label}
                  {loaded > 0 && (
                    <span className={cx("text-[11px] font-medium px-1.5 rounded-full tabular-nums", on ? "bg-white/20 text-white" : "bg-[var(--mist)] text-[var(--ink-faint)]")}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(300px, 1fr))`, minWidth: `${n * 300}px` }}>
            {candidates.map((c, i) => (
              <CvColumn
                key={c.id}
                c={c}
                letter={LETTERS[i]}
                name={labels[i]}
                entry={texts[c.id]}
                parsed={parsedById[c.id]}
                active={active}
                find={{ re: findRe, lines: findLines[c.id] || [] }}
                findStep={findStep}
                revealed={!!revealed[c.id]}
                onReveal={() => setRevealed((r) => ({ ...r, [c.id]: true }))}
                onRemove={onRemove}
                onStageChanged={onStageChanged}
                registerScroller={registerScroller}
                onScroll={onColumnScroll}
              />
            ))}
          </div>
        </div>
      </Card>
      <p className="text-[12px] text-[var(--ink-faint)] px-1">
        The text as read from each uploaded CV - layout from the original file (columns, tables) may not carry over. Use &ldquo;Original file&rdquo; to see it exactly.
      </p>
    </div>
  );
}
