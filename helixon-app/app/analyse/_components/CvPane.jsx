"use client";

// The CV beside its report: a side panel with the candidate's CV text, the
// lines each score rests on highlighted and tagged with the skill they show.
// Opened from the report rail, or from a quote ("Show in CV"), which scrolls
// that line into view. A modal panel: Escape and the backdrop close it, Tab
// stays inside, and focus returns to whatever opened it.

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Spinner, cx } from "./ui";
import { trapTab } from "@/lib/ui/focus-trap";
import { highlightSegments, quoteRanges } from "../_lib/cvHighlight";

function useCvText(candidateId) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let live = true;
    fetch(`/api/candidates/${candidateId}/cv?format=text`, { credentials: "include" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!live) return;
        setState(res.ok && body?.text ? { status: "ready", text: body.text } : { status: "error", error: body?.error || "Couldn't load this CV." });
      })
      .catch(() => live && setState({ status: "error", error: "Couldn't reach the server." }));
    return () => {
      live = false;
    };
  }, [candidateId]);
  return state;
}

export default function CvPane({ candidateId, name, quotes = [], focusSkill = null, onClose }) {
  const ref = useRef(null);
  const closeRef = useRef(null);
  const cv = useCvText(candidateId);
  const [entered, setEntered] = useState(false);

  const segments = useMemo(() => {
    if (cv.status !== "ready") return [];
    return highlightSegments(cv.text, quoteRanges(cv.text, quotes));
  }, [cv, quotes]);
  const found = segments.filter((s) => s.skill).length;

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const t = requestAnimationFrame(() => setEntered(true));
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") trapTab(e, ref.current);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener("keydown", onKey);
      if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus();
    };
  }, [onClose]);

  // Bring the line a "Show in CV" asked for into view once the text is in.
  useEffect(() => {
    if (cv.status !== "ready" || !focusSkill) return;
    const el = ref.current?.querySelector(`[data-skill="${CSS.escape(focusSkill)}"]`);
    el?.scrollIntoView({ block: "center" });
  }, [cv.status, focusSkill]);

  return (
    <div
      className={cx("fixed inset-0 z-50 flex justify-end transition-colors duration-200 motion-reduce:transition-none", entered ? "bg-[var(--ink)]/40" : "bg-transparent")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cv-pane-title"
        className={cx(
          "h-full w-full sm:w-[520px] flex flex-col bg-[var(--bg)] border-l border-[var(--border)] shadow-xl",
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
          entered ? "translate-x-0" : "translate-x-full motion-reduce:translate-x-0",
        )}
      >
        <div className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-[var(--border-soft)]">
          <div className="min-w-0 flex-1">
            <h2 id="cv-pane-title" className="text-16 font-semibold tracking-tight text-[var(--ink)] font-display truncate">
              {name ? `${name}'s CV` : "The CV"}
            </h2>
            {cv.status === "ready" && (
              <p className="text-13 text-[var(--ink-faint)]">
                {found > 0 ? `${found} line${found === 1 ? "" : "s"} the score rests on, highlighted` : "As read from their file"}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close the CV"
            className="w-11 h-11 -mr-2 rounded-btn flex items-center justify-center text-[var(--ink-soft)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {cv.status === "loading" && (
            <p className="flex items-center gap-2 text-14 text-[var(--ink-soft)]">
              <Spinner size={14} /> Loading the CV…
            </p>
          )}
          {cv.status === "error" && <p className="text-14 text-[var(--ink-soft)]">{cv.error}</p>}
          {cv.status === "ready" && (
            <div className="whitespace-pre-wrap break-words text-14 leading-relaxed text-[var(--ink)]">
              {segments.map((s, i) =>
                s.skill ? (
                  <mark
                    key={i}
                    data-skill={s.skill}
                    className={cx(
                      "rounded px-0.5 -mx-0.5 bg-[var(--mint)] text-[var(--ink)] [box-decoration-break:clone]",
                      s.skill === focusSkill && "ring-2 ring-[var(--forest)]",
                    )}
                  >
                    {s.text}
                    <span className="ml-1 align-middle inline-flex items-center gap-1 px-1.5 rounded-full text-11 font-semibold bg-[var(--forest)] text-[var(--on-accent)] whitespace-nowrap">
                      <Icon name="check" size={10} strokeWidth={3} />
                      {s.skill}
                    </span>
                  </mark>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
