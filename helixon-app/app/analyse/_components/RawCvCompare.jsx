"use client";

// "Raw CVs" view of the compare page: each candidate's CV exactly as it was
// read from their file, side by side. Pick a section - Contact info,
// Strengths, Experience, Education... - and every CV scrolls to that part at
// once, with it highlighted. Display only: the CV text comes from
// /api/candidates/[id]/cv?format=text and nothing about the analysis changes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Icon, Spinner, cx } from "./ui";
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

function CvColumn({ c, label, entry, parsed, active, revealed, onReveal, onRemove, registerScroller }) {
  const scrollerRef = useRef(null);

  useEffect(() => {
    registerScroller(c.id, scrollerRef.current);
    return () => registerScroller(c.id, null);
  }, [c.id, registerScroller]);

  const target = active && parsed ? resolveSection(parsed, active) : null;
  const range = target ? sectionRange(parsed, target.line) : null;
  const highlightContact = active === "contact" && parsed;

  return (
    <div className="min-w-0 flex flex-col border-l first:border-l-0 border-[var(--border)]">
      <div className="px-4 py-3 border-b border-[var(--border)] bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-full bg-[var(--ink)] text-white text-[12px] font-semibold flex items-center justify-center shrink-0">
            {label}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{c.blind && !revealed ? "Screened blind" : c.name}</p>
            <p className="text-[11.5px] text-[var(--ink-faint)] truncate">
              {active && parsed
                ? target
                  ? target.key === active
                    ? `${sectionLabel(active)} · line ${target.line + 1}`
                    : `No ${sectionLabel(active)} heading - showing ${sectionLabel(target.key)}`
                  : `No ${sectionLabel(active)} section in this CV`
                : c.currentTitle || " "}
            </p>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(c.id)}
              aria-label={`Remove candidate ${label} from the comparison`}
              className="p-1 -mr-1 rounded text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--mist)] shrink-0"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollerRef} className="relative h-[68vh] overflow-y-auto bg-white px-4 py-3" style={{ scrollBehavior: "smooth" }}>
        {!entry ? (
          <div className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)] py-6">
            <Spinner /> Loading CV…
          </div>
        ) : entry.status === "error" ? (
          <p className="text-[13px] text-[var(--ink-soft)] py-6">{entry.error}</p>
        ) : c.blind && !revealed ? (
          <div className="py-10 text-center">
            <Icon name="eyeOff" size={20} className="mx-auto text-[var(--ink-faint)]" />
            <p className="text-[13px] text-[var(--ink)] font-medium mt-2">This candidate was screened blind</p>
            <p className="text-[12.5px] text-[var(--ink-soft)] mt-1 max-w-[240px] mx-auto">Their CV shows their name and contact details.</p>
            <Button size="sm" className="mt-3" onClick={onReveal}>
              Show the CV
            </Button>
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
                    contact && "bg-[var(--mint)]"
                  )}
                >
                  {line || " "}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RawCvCompare({ candidates, labels, onRemove }) {
  const ids = useMemo(() => candidates.map((c) => c.id), [candidates]);
  const texts = useCvTexts(ids);
  const [active, setActive] = useState(null);
  const [revealed, setRevealed] = useState({});
  const scrollers = useRef(new Map());

  const registerScroller = useCallback((id, el) => {
    if (el) scrollers.current.set(id, el);
    else scrollers.current.delete(id);
  }, []);

  const parsedById = useMemo(() => {
    const out = {};
    for (const id of ids) if (texts[id]?.status === "ready") out[id] = parseCvSections(texts[id].text);
    return out;
  }, [ids, texts]);

  const visible = useCallback((c) => texts[c.id]?.status === "ready" && (!c.blind || revealed[c.id]), [texts, revealed]);

  // How many of the CVs each section can be found in (fallbacks count).
  const found = useMemo(() => {
    const out = {};
    for (const s of CV_SECTIONS) {
      out[s.key] = candidates.filter((c) => parsedById[c.id] && resolveSection(parsedById[c.id], s.key)).length;
    }
    return out;
  }, [candidates, parsedById]);

  // Scroll every CV so the section's heading sits at the top of its column.
  const jumpTo = useCallback(
    (key) => {
      for (const c of candidates) {
        const el = scrollers.current.get(c.id);
        const parsed = parsedById[c.id];
        if (!el || !parsed) continue;
        const target = key ? resolveSection(parsed, key) : null;
        const line = target ? el.querySelector(`[data-line="${target.line}"]`) : null;
        el.scrollTo({ top: line ? Math.max(0, line.offsetTop - 2) : 0, behavior: "smooth" });
      }
    },
    [candidates, parsedById]
  );

  // Re-apply after a blind CV is revealed, so it lines up with the rest.
  useEffect(() => {
    if (active) jumpTo(active);
  }, [revealed, active, jumpTo]);

  function choose(key) {
    setActive(key);
    jumpTo(key);
  }

  const n = candidates.length;
  const loadedCount = candidates.filter(visible).length;

  return (
    <div className="space-y-3">
      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <p className="text-[12.5px] text-[var(--ink-soft)]">
            <span className="font-semibold text-[var(--ink)]">Jump every CV to</span> - each one scrolls to that section.
          </p>
          {active && (
            <button type="button" onClick={() => choose(null)} className="text-[12px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] shrink-0">
              Back to top
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Jump to a CV section">
          {CV_SECTIONS.map((s) => {
            const count = found[s.key];
            const on = active === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => choose(s.key)}
                disabled={count === 0}
                aria-pressed={on}
                title={count === 0 ? `No ${s.label} section found in these CVs` : `Found in ${count} of ${n}`}
                className={cx(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  on
                    ? "bg-[var(--forest)] border-[var(--forest)] text-white"
                    : "bg-white border-[var(--border)] text-[var(--ink)] hover:border-[var(--forest)] hover:text-[var(--forest)]"
                )}
              >
                {s.label}
                {loadedCount > 0 && (
                  <span className={cx("text-[11px] tabular-nums", on ? "text-white/80" : "text-[var(--ink-faint)]")}>
                    {count}/{n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(300px, 1fr))`, minWidth: `${n * 300}px` }}>
            {candidates.map((c, i) => (
              <CvColumn
                key={c.id}
                c={c}
                label={labels[i]}
                entry={texts[c.id]}
                parsed={parsedById[c.id]}
                active={active}
                revealed={!!revealed[c.id]}
                onReveal={() => setRevealed((r) => ({ ...r, [c.id]: true }))}
                onRemove={onRemove}
                registerScroller={registerScroller}
              />
            ))}
          </div>
        </div>
      </Card>
      <p className="text-[11.5px] text-[var(--ink-faint)] px-1">
        The text as read from each uploaded CV. Layout from the original file (columns, tables) may not carry over.
      </p>
    </div>
  );
}
