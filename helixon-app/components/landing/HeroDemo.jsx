"use client";
// The homepage hero's product moment: eight CVs for one role land as a pile,
// each is scanned and scored in turn, then they re-sort into a ranked
// shortlist with the reason behind each score. Sample data, not a live embed.
//
// The finished shortlist is what the server renders, so a visitor whose
// JavaScript never runs, or who asks for reduced motion, gets the result
// rather than an empty card. The run never blanks anything in front of the
// visitor: a card already on screen when the page hydrates (desktop)
// shuffles its finished list back into a pile and plays from there, and only
// a card still off screen (phones) is hidden first, to drop in when it
// scrolls into view. Replay shuffles the same way.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { m, useInView, useReducedMotion } from "motion/react";
import { scoreTone } from "@/components/landing/score-tone";
import { useHydrated } from "@/lib/hooks/useHydrated";

const ROLE = "Warehouse Team Leader";

// In upload order; the shortlist re-sorts them by score.
const CANDIDATES = [
  { id: "tom", name: "Tom Hughes", score: 73, note: "Strong ops, no team to lead yet" },
  { id: "amy", name: "Amy Clarke", score: 94, note: "6 years leading night shifts" },
  { id: "leah", name: "Leah Kaminski", score: 58, note: "Retail floor, not warehouse" },
  { id: "daniel", name: "Daniel Osei", score: 88, note: "FLT licence, runs the WMS" },
  { id: "marcus", name: "Marcus Webb", score: 52, note: "Three-month notice period" },
  { id: "priya", name: "Priya Shah", score: 81, note: "Stock control across 3 sites" },
  { id: "jordan", name: "Jordan Patel", score: 47, note: "No warehouse experience" },
  { id: "grace", name: "Grace Okafor", score: 69, note: "Good fit, shorter tenure" },
];
const RANKED = [...CANDIDATES].sort((a, b) => b.score - a.score);
const SHORTLIST = 3;

// Phases: "reset" (hidden starting frame, off screen only) → "pile" → "scan"
// → "rank" → "done".
const SHUFFLE_DELAY_MS = 700;
const PILE_MS = 900;
const SCAN_STEP_MS = 260;
const RANK_DELAY_MS = 350;
const RANK_MS = 1100;

// A little untidiness for the pile: each card's tilt and nudge.
const TILT = [-5, 3, -2, 6, 4, -6, 2, -3];
const NUDGE = [4, -6, 8, -2, -5, 6, -8, 3];

const SPRING = { type: "spring", stiffness: 260, damping: 30 };

function statusText(phase, scanned) {
  if (phase === "reset" || phase === "pile") return `${CANDIDATES.length} CVs dropped in`;
  if (phase === "scan") return `Scoring ${Math.min(scanned + 1, CANDIDATES.length)} of ${CANDIDATES.length}…`;
  if (phase === "rank") return "Ranking…";
  return `Ranked · ${SHORTLIST} to shortlist`;
}

function Doc({ candidate, scanning, scored }) {
  const tone = scoreTone(candidate.score);
  return (
    <div className="relative h-[104px] rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 overflow-hidden shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-full shrink-0 bg-[var(--mint-line)]" aria-hidden="true" />
        <span className="text-11 font-semibold truncate text-[var(--ink)]">{candidate.name.split(" ")[0]}</span>
      </div>
      <div className="mt-2 space-y-1.5" aria-hidden="true">
        <div className="h-1 rounded-full bg-[var(--border)] w-full" />
        <div className="h-1 rounded-full bg-[var(--border)] w-4/5" />
        <div className="h-1 rounded-full bg-[var(--border)] w-11/12" />
        <div className="h-1 rounded-full bg-[var(--border)] w-3/5" />
      </div>
      {scanning && <span className="scan-pass" aria-hidden="true" />}
      {scored && (
        <m.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
          className={`absolute bottom-1.5 right-1.5 text-12 font-semibold font-mono tabular-nums px-1.5 rounded-md bg-[var(--mist)] ${tone.text}`}
        >
          {candidate.score}
        </m.span>
      )}
    </div>
  );
}

function Row({ candidate, rank, showNote }) {
  const tone = scoreTone(candidate.score);
  const listed = rank <= SHORTLIST;
  return (
    <div className={`flex items-center gap-2.5 px-3 h-[38px] rounded-lg border ${listed ? "bg-[var(--mint)] border-[var(--mint-line)]" : "bg-[var(--bg)] border-[var(--border)]"}`}>
      <span className="w-4 text-11 font-semibold tabular-nums text-[var(--ink-faint)]">{rank}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-12 font-semibold truncate text-[var(--ink)]">{candidate.name}</span>
        {showNote && <span className="block text-11 leading-tight truncate text-[var(--ink-soft)]">{candidate.note}</span>}
      </span>
      <span className={`text-11 font-semibold ${tone.text}`}>{tone.label}</span>
      <span className={`w-6 text-right text-13 font-semibold font-mono tabular-nums ${tone.text}`}>{candidate.score}</span>
    </div>
  );
}

export default function HeroDemo() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const [phase, setPhase] = useState("done");
  const [scanned, setScanned] = useState(0);
  const [played, setPlayed] = useState(false);

  // Decide once, before the browser paints the hydrated card: off screen,
  // hide it to drop in later; on screen, shuffle the finished list after a
  // beat, so the visitor sees the result first and then how it was reached.
  useLayoutEffect(() => {
    if (reduce) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const { top, bottom } = el.getBoundingClientRect();
    if (top >= window.innerHeight || bottom <= 0) {
      setPhase("reset");
      return undefined;
    }
    const t = setTimeout(() => setPhase("pile"), SHUFFLE_DELAY_MS);
    return () => clearTimeout(t);
    // Only ever on the first render; Replay restarts it later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let t;
    if (phase === "reset" && inView) t = setTimeout(() => setPhase("pile"), 80);
    else if (phase === "pile") t = setTimeout(() => { setScanned(0); setPhase("scan"); }, PILE_MS);
    else if (phase === "scan") {
      t = scanned < CANDIDATES.length
        ? setTimeout(() => setScanned((n) => n + 1), SCAN_STEP_MS)
        : setTimeout(() => setPhase("rank"), RANK_DELAY_MS);
    } else if (phase === "rank") t = setTimeout(() => { setPhase("done"); setPlayed(true); }, RANK_MS);
    return () => clearTimeout(t);
  }, [phase, scanned, inView]);

  function replay() {
    setScanned(0);
    setPhase("pile");
  }

  const asList = phase === "rank" || phase === "done";
  const order = asList ? RANKED : CANDIDATES;

  return (
    <div
      ref={ref}
      role="figure"
      aria-label={`Example: ${CANDIDATES.length} CVs for one role, scored against the same spec and ranked`}
      className="relative w-full max-w-md mx-auto lg:mx-0 rounded-panel border border-[var(--border)] bg-[var(--bg)] shadow-[var(--shadow-raise)] p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-13 font-semibold truncate text-[var(--ink)]">{ROLE}</span>
        <span className="text-11 font-semibold px-2 py-0.5 rounded-full shrink-0 bg-[var(--mint)] text-[var(--forest)]">Example role</span>
      </div>
      <p className="text-12 mb-4 flex items-center gap-1.5 text-[var(--ink-faint)]">
        {!asList && phase !== "reset" && <span className="pulse-dot w-[6px] h-[6px] rounded-full bg-[var(--signal)] inline-block" aria-hidden="true" />}
        {statusText(phase, scanned)}
      </p>

      <div className={`min-h-[338px] ${asList ? "flex flex-col gap-1.5" : "grid grid-cols-4 gap-2.5 content-center"}`}>
        {order.map((c, i) => {
          const uploadIndex = CANDIDATES.indexOf(c);
          const loose = phase === "reset" || phase === "pile";
          return (
            // Position only: animating size too stretched the text while a
            // CV card turned into a list row.
            <m.div
              key={c.id}
              layout="position"
              initial={false}
              animate={
                phase === "reset"
                  ? { opacity: 0, y: -28, rotate: 0 }
                  : { opacity: 1, y: loose ? NUDGE[uploadIndex] : 0, rotate: loose ? TILT[uploadIndex] : 0 }
              }
              transition={{
                ...SPRING,
                opacity: { duration: phase === "reset" ? 0 : 0.35, delay: phase === "pile" ? uploadIndex * 0.07 : 0 },
                y: { ...SPRING, delay: phase === "pile" ? uploadIndex * 0.07 : 0 },
                layout: { ...SPRING, delay: asList ? i * 0.03 : 0 },
              }}
            >
              {asList ? (
                <Row candidate={c} rank={i + 1} showNote={phase === "done"} />
              ) : (
                <Doc candidate={c} scanning={phase === "scan" && scanned === uploadIndex} scored={phase === "scan" && uploadIndex < scanned} />
              )}
            </m.div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 min-h-[44px]">
        <p className="text-12 text-[var(--ink-faint)]">One spec, every CV, ranked with the reason.</p>
        {/* Only once hydrated: without JavaScript the button would do nothing. */}
        {phase === "done" && hydrated && !reduce && (
          <button
            type="button"
            onClick={replay}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-btn text-12 font-semibold text-[var(--forest)] hover:bg-[var(--mint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forest)]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            {played ? "Replay" : "Watch it run"}
          </button>
        )}
      </div>
    </div>
  );
}
