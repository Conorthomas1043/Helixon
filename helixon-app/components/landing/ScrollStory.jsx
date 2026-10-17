"use client";
// "How it works" told as you scroll: four steps, from the pile of CVs to a
// placement. Sample data throughout, not a live embed.
//
// On a wide screen the steps scroll past on the left while a pinned panel on
// the right shows the active step's product view, each one animating in.
// Narrower screens show each step's view under its text, playing once as it
// scrolls into view. The server renders that stacked version with every
// view finished, which is also what a visitor gets without JavaScript or
// with reduced motion; the pinned panel only appears once the page has
// hydrated.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import CountUp from "@/components/dashboard/CountUp";
import { scoreTone } from "@/components/landing/score-tone";
import { useHydrated } from "@/lib/hooks/useHydrated";
import useScrollEntrance from "@/lib/hooks/useScrollEntrance";

const EASE = [0.16, 1, 0.3, 1];
const ROLE = "Warehouse Team Leader";

// A view's stage: "final" (finished, no motion), "start" (its first frame,
// shown only while off screen) or "play" (animating from start to final).
function reveal(stage, delay = 0, from = { opacity: 0, y: 10 }) {
  return {
    initial: stage === "play" ? from : false,
    animate: stage === "start" ? from : { opacity: 1, x: 0, y: 0, scale: 1 },
    transition: stage === "start" ? { duration: 0 } : { duration: 0.5, delay, ease: EASE },
  };
}

// True once `ms` have passed in the "play" stage, and at once in "final".
// A view plays at most once per mount (inline views latch, the pinned panel
// remounts per step), so the timer never needs resetting.
function useAfter(stage, ms) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (stage !== "play") return undefined;
    const t = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(t);
  }, [stage, ms]);
  return stage === "final" || (stage === "play" && elapsed);
}

function Panel({ title, badge, children }) {
  return (
    <div className="h-full flex flex-col rounded-panel border border-[var(--border)] bg-[var(--bg)] shadow-[var(--shadow-raise)] overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--border-soft)] bg-[var(--mist)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--border)]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--border)]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--border)]" />
        <span className="ml-2 min-w-0 flex-1 truncate text-11 text-[var(--ink-faint)]">{title}</span>
        {badge && <span className="text-11 font-semibold px-2 py-0.5 rounded-full shrink-0 bg-[var(--mint)] text-[var(--forest)]">{badge}</span>}
      </div>
      <div className="flex-1 p-5 sm:p-6">{children}</div>
    </div>
  );
}

/* ── 01 Upload ──────────────────────────────────────────────────────────── */

const FILES = [
  ["Amy Clarke - CV.pdf", "212 KB"],
  ["Daniel Osei - CV.docx", "48 KB"],
  ["Priya Shah - CV.pdf", "190 KB"],
  ["Tom Hughes - CV.pdf", "301 KB"],
  ["Grace Okafor - CV.docx", "56 KB"],
];

function UploadView({ stage }) {
  const done = useAfter(stage, 1100);
  return (
    <Panel title={`Screen · ${ROLE}`} badge="Bulk upload">
      <m.div {...reveal(stage, 0, { opacity: 0, scale: 0.97 })} className="rounded-xl border-[1.5px] border-dashed border-[var(--mint-line)] bg-[var(--mint)] px-4 py-5 text-center">
        <svg className="mx-auto mb-2 text-[var(--forest)]" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4m0 0L7 9m5-5 5 5" />
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        <p className="text-13 font-semibold text-[var(--ink)]">Drop up to 50 CVs</p>
        <p className="text-12 text-[var(--ink-soft)]">PDF or Word, any layout</p>
      </m.div>
      <ul className="mt-4 space-y-1.5">
        {FILES.map(([name, size], i) => (
          <m.li
            key={name}
            {...reveal(stage, 0.25 + i * 0.12, { opacity: 0, y: -14 })}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--mist)]"
          >
            <svg className="shrink-0 text-[var(--ink-faint)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
            <span className="min-w-0 flex-1 truncate text-12 text-[var(--ink)]">{name}</span>
            <span className="text-11 tabular-nums text-[var(--ink-faint)]">{size}</span>
            <svg className="shrink-0 text-[var(--forest)]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </m.li>
        ))}
      </ul>
      <div className="mt-4">
        <div className="h-1.5 rounded-full overflow-hidden bg-[var(--border-soft)]">
          <m.div
            className="h-full rounded-full bg-[var(--forest)] origin-left"
            initial={stage === "play" ? { scaleX: 0 } : false}
            animate={{ scaleX: stage === "start" ? 0 : 1 }}
            transition={stage === "start" ? { duration: 0 } : { duration: 1.2, ease: EASE, delay: 0.2 }}
          />
        </div>
        <p className="mt-1.5 text-12 tabular-nums text-[var(--ink-faint)]">
          <CountUp value={done ? 24 : 0} duration={700} /> of 24 CVs uploaded
        </p>
      </div>
    </Panel>
  );
}

/* ── 02 Score ───────────────────────────────────────────────────────────── */

const CHECKS = [
  { skill: "Leading a shift team", status: "Shown in CV", tone: "good", quote: "Led a night shift of 14 pickers" },
  { skill: "Warehouse management system", status: "Expert", tone: "good" },
  { skill: "Counterbalance licence", status: "Missing", tone: "bad" },
];

function ScoreRing({ stage }) {
  const go = useAfter(stage, 350);
  const r = 30;
  return (
    <div className="relative w-[76px] h-[76px] shrink-0">
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--border-soft)" strokeWidth="6" />
        <m.circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="var(--forest)"
          strokeWidth="6"
          strokeLinecap="round"
          transform="rotate(-90 38 38)"
          initial={stage === "play" ? { pathLength: 0 } : false}
          animate={{ pathLength: stage === "start" ? 0 : 0.88 }}
          transition={stage === "start" ? { duration: 0 } : { duration: 1.1, ease: EASE, delay: 0.35 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-20 font-semibold font-mono tabular-nums text-[var(--forest)]">
        <CountUp value={go ? 88 : 0} duration={1000} />
      </span>
    </div>
  );
}

function ScoreView({ stage }) {
  return (
    <Panel title={`Analysis · ${ROLE}`} badge="Strong match">
      <div className="flex items-center gap-4">
        <ScoreRing stage={stage} />
        <div className="min-w-0">
          <p className="text-15 font-semibold text-[var(--ink)]">Amy Clarke</p>
          <p className="text-12 text-[var(--ink-faint)]">Shift Manager · Northgate Logistics</p>
        </div>
      </div>
      <div className="relative mt-5 rounded-xl border border-[var(--border)] p-3.5 overflow-hidden">
        <p className="text-11 font-semibold uppercase tracking-widest mb-2 text-[var(--ink-faint)]">Her CV</p>
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full w-11/12 bg-[var(--border)]" />
          <m.p {...reveal(stage, 0.9, { opacity: 0 })} className="text-12 rounded px-1.5 py-0.5 -mx-1.5 bg-[var(--mint)] text-[var(--ink)]">
            &ldquo;Led a night shift of 14 pickers&rdquo;
          </m.p>
          <div className="h-1.5 rounded-full w-4/5 bg-[var(--border)]" />
          <div className="h-1.5 rounded-full w-3/5 bg-[var(--border)]" />
        </div>
        {stage === "play" && <span className="scan-pass scan-pass--slow" />}
      </div>
      <ul className="mt-4 divide-y divide-[var(--border-soft)]">
        {CHECKS.map((c, i) => (
          <m.li key={c.skill} {...reveal(stage, 0.7 + i * 0.25, { opacity: 0, x: 12 })} className="flex items-center justify-between gap-3 py-2">
            <span className="text-13 text-[var(--ink)]">{c.skill}</span>
            <span
              className={`inline-flex items-center gap-1 text-11 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap border ${
                c.tone === "good" ? "bg-[var(--mint)] text-[var(--forest)] border-[var(--mint-line)]" : "bg-[var(--ui-danger-soft)] text-[var(--score-low)] border-[var(--danger-line)]"
              }`}
            >
              <span aria-hidden="true">{c.tone === "good" ? "✓" : "✕"}</span>
              {c.status}
            </span>
          </m.li>
        ))}
      </ul>
    </Panel>
  );
}

/* ── 03 Rank ────────────────────────────────────────────────────────────── */

const POOL = [
  { id: "tom", name: "Tom Hughes", score: 73, note: "No team to lead yet" },
  { id: "amy", name: "Amy Clarke", score: 94, note: "6 years leading night shifts" },
  { id: "leah", name: "Leah Kaminski", score: 58, note: "Retail, not warehouse" },
  { id: "daniel", name: "Daniel Osei", score: 88, note: "FLT licence, runs the WMS" },
  { id: "priya", name: "Priya Shah", score: 81, note: "Stock control across 3 sites" },
  { id: "grace", name: "Grace Okafor", score: 69, note: "Shorter tenure" },
];
const POOL_RANKED = [...POOL].sort((a, b) => b.score - a.score);

function RankView({ stage }) {
  const sorted = useAfter(stage, 700);
  const rows = sorted ? POOL_RANKED : POOL;
  return (
    <Panel title={`Shortlist · ${ROLE}`} badge={`${POOL.length} ranked`}>
      <ul className="space-y-1.5">
        {rows.map((c, i) => {
          const tone = scoreTone(c.score);
          const listed = sorted && i < 3;
          return (
            <m.li
              key={c.id}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 32, delay: sorted ? i * 0.04 : 0 }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors duration-500 ${listed ? "bg-[var(--mint)] border-[var(--mint-line)]" : "bg-[var(--bg)] border-[var(--border)]"}`}
            >
              <span className="w-4 text-11 font-semibold tabular-nums text-[var(--ink-faint)]">{sorted ? i + 1 : "–"}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-13 font-semibold truncate text-[var(--ink)]">{c.name}</span>
                <span className="block text-11 truncate text-[var(--ink-soft)]">{c.note}</span>
              </span>
              {listed && (
                <m.span
                  initial={stage === "play" ? { opacity: 0, scale: 0.8 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="hidden sm:inline text-11 font-semibold px-2 py-0.5 rounded-full bg-[var(--bg)] text-[var(--forest)] border border-[var(--mint-line)]"
                >
                  Shortlist
                </m.span>
              )}
              <span className={`w-7 text-right text-14 font-semibold font-mono tabular-nums ${tone.text}`}>{c.score}</span>
            </m.li>
          );
        })}
      </ul>
      <p className="mt-4 text-12 text-[var(--ink-faint)]">Same spec for everyone, so the order holds up.</p>
    </Panel>
  );
}

/* ── 04 Act ─────────────────────────────────────────────────────────────── */

const SHORTLISTED = [
  { name: "Amy Clarke", score: 94, feedback: "Interview" },
  { name: "Daniel Osei", score: 88, feedback: "Interview" },
  { name: "Priya Shah", score: 81, feedback: "Maybe" },
];
const STAGES = ["Screened", "Shortlisted", "Interview", "Offer", "Placed"];

function ActView({ stage }) {
  return (
    <Panel title="Client shortlist · Northgate Logistics" badge="Shared">
      <ul className="space-y-2">
        {SHORTLISTED.map((c, i) => (
          <li key={c.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--mist)]">
            <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-11 font-semibold bg-[var(--mint)] text-[var(--forest)]">
              {c.name.split(" ").map((p) => p[0]).join("")}
            </span>
            <span className="min-w-0 flex-1 truncate text-13 font-semibold text-[var(--ink)]">{c.name}</span>
            <m.span
              {...reveal(stage, 0.5 + i * 0.3, { opacity: 0, scale: 0.8 })}
              className={`text-11 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${c.feedback === "Interview" ? "bg-[var(--mint)] text-[var(--forest)]" : "bg-[var(--ui-warn-soft)] text-[var(--ui-warn)]"}`}
            >
              Client: {c.feedback}
            </m.span>
            <span className={`w-6 text-right text-13 font-semibold font-mono tabular-nums ${scoreTone(c.score).text}`}>{c.score}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 mb-2 text-11 font-semibold uppercase tracking-widest text-[var(--ink-faint)]">Amy Clarke</p>
      <ol className="grid grid-cols-5 gap-1.5">
        {STAGES.map((s, i) => (
          <m.li
            key={s}
            {...reveal(stage, 1.4 + i * 0.22, { opacity: 0, y: 6 })}
            className={`text-center rounded-md py-1.5 text-11 font-semibold truncate ${i === STAGES.length - 1 ? "bg-[var(--forest)] text-[var(--on-accent)]" : "bg-[var(--mint)] text-[var(--forest)]"}`}
          >
            {s}
          </m.li>
        ))}
      </ol>
      <m.p {...reveal(stage, 2.6)} className="mt-4 inline-flex items-center gap-2 text-13 font-semibold text-[var(--ink)]">
        <span className="w-2 h-2 rounded-full bg-[var(--forest)]" aria-hidden="true" />
        Placed · fee invoiced from the same desk
      </m.p>
    </Panel>
  );
}

/* ── The story ──────────────────────────────────────────────────────────── */

const STEPS = [
  {
    key: "upload",
    title: "Drop in the whole pile",
    body: "Up to 50 CVs for one role, PDF or Word, tables and columns included. No renaming, no sorting first.",
    View: UploadView,
  },
  {
    key: "score",
    title: "Every CV read against the same spec",
    body: "Each requirement checked, with the line in the CV that proves it and what still needs asking. Under a minute a CV.",
    View: ScoreView,
  },
  {
    key: "rank",
    title: "A ranked shortlist, with the reasons",
    body: "Strongest first, and every score explains itself. One weak CV never holds up the rest of the batch.",
    View: RankView,
  },
  {
    key: "act",
    title: "Shortlist, share, place",
    body: "Send the shortlist to your client, get their feedback in a tap, and take the candidate through to placement in the same place.",
    View: ActView,
  },
];

// A step's view under its text: finished as rendered, replayed once as it
// scrolls into view if it started off screen.
function InlineView({ View }) {
  const ref = useRef(null);
  const phase = useScrollEntrance(ref, { offset: "15%" });
  const stage = phase === "static" ? "final" : phase === "armed" ? "start" : "play";
  return (
    <div ref={ref} aria-hidden="true">
      <View stage={stage} />
    </div>
  );
}

export default function ScrollStory() {
  const hydrated = useHydrated();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const stepRefs = useRef([]);

  // The step crossing the middle of the screen is the active one.
  useEffect(() => {
    if (!hydrated || typeof IntersectionObserver === "undefined") return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number(e.target.dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    stepRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [hydrated]);

  const ActiveView = STEPS[active].View;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
      <ol className="relative">
        {/* The progress rail beside the steps, filling as they pass. */}
        <span className="absolute left-[15px] top-2 bottom-2 w-0.5 rounded-full bg-[var(--border)]" aria-hidden="true" />
        {hydrated && (
          <m.span
            className="hidden lg:block absolute left-[15px] top-2 bottom-2 w-0.5 rounded-full bg-[var(--forest)] origin-top"
            initial={false}
            animate={{ scaleY: (active + 1) / STEPS.length }}
            transition={{ duration: 0.6, ease: EASE }}
            aria-hidden="true"
          />
        )}
        {STEPS.map((s, i) => {
          const current = hydrated && i === active;
          const passed = hydrated && i < active;
          return (
            <li
              key={s.key}
              ref={(el) => { stepRefs.current[i] = el; }}
              data-step={i}
              className="relative pl-12 pb-14 last:pb-0 lg:pb-0 lg:min-h-[72vh] lg:flex lg:flex-col lg:justify-center"
            >
              <span
                className={`absolute left-0 top-0 lg:top-1/2 lg:-translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-13 font-semibold tabular-nums border-2 transition-colors duration-300 ${
                  current
                    ? "bg-[var(--forest)] border-[var(--forest)] text-[var(--on-accent)]"
                    : passed
                      ? "bg-[var(--mint)] border-[var(--forest)] text-[var(--forest)]"
                      : "bg-[var(--bg)] border-[var(--border)] text-[var(--ink-faint)]"
                }`}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              {/* Steps other than the active one recede in colour, not opacity,
                  so their text keeps 4.5:1 contrast. */}
              <div className={hydrated && !current ? "lg:[&_*]:text-[var(--ink-faint)]" : ""}>
                <h3 className="text-20 sm:text-24 font-semibold tracking-tight mb-2 text-[var(--ink)] font-display text-balance transition-colors duration-500">{s.title}</h3>
                <p className="text-16 leading-relaxed max-w-md text-[var(--ink-soft)] transition-colors duration-500">{s.body}</p>
              </div>
              <div className={`mt-6 ${hydrated ? "lg:hidden" : ""}`}>
                <InlineView View={s.View} />
              </div>
            </li>
          );
        })}
      </ol>

      {hydrated && (
        <div className="hidden lg:block" aria-hidden="true">
          <div className="sticky top-[calc(50vh-15rem)]">
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={STEPS[active].key}
                initial={{ opacity: 0, y: 28, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -28, scale: 0.98 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <ActiveView stage={reduce ? "final" : "play"} />
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
