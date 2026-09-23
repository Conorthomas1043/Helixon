"use client";

import { useEffect, useRef, useState } from "react";
import useReducedMotion from "@/lib/hooks/useReducedMotion";

// ═══════════════════════════════════════════════════════════════════════════
// Animated SVG illustrations for the How It Works steps.
//
// Progressive enhancement, same rule as the landing page: every element's
// base (un-animated) markup IS the finished frame. Motion is layered on with
// the Web Animations API only while the illustration is on screen, so SSR,
// no-JS, reduced motion and off-screen all show a complete illustration,
// and nothing burns CPU looping out of view.
//
// Animated parts are tagged declaratively:
//   data-illo  - the motion: grow (scaleX from the left), pop, drop, scan, ring
//   data-at    - seconds into the loop when the part starts entering
//   data-dur   - optional entry duration in seconds
// Every part holds its final state until EXIT_AT, then fades so the next
// loop starts from a clean sheet.
// ═══════════════════════════════════════════════════════════════════════════

function ReadJobIllustration() {
  return (
    <>
      {/* Job description sheet */}
      <rect x="52" y="14" width="112" height="122" rx="8" fill="white" stroke="var(--border)" />
      <rect x="64" y="26" width="52" height="7" rx="3.5" fill="var(--ink)" opacity="0.85" />
      <rect x="64" y="38" width="32" height="4" rx="2" fill="var(--ink-mute)" />

      {/* Highlighter marks sit behind the text lines they "pick out" */}
      <rect data-illo="grow" data-at="0.6" x="61" y="54" width="80" height="10" rx="3" fill="var(--mint)" />
      <rect data-illo="grow" data-at="1.6" x="61" y="84" width="66" height="10" rx="3" fill="#fbeed6" />

      {[57, 72, 87, 102, 117].map((y, i) => (
        <rect key={y} x="64" y={y} width={[74, 88, 60, 82, 48][i]} height="4" rx="2" fill="var(--ink-mute)" opacity="0.9" />
      ))}

      {/* Reading scan line - decorative only, hidden in the static frame */}
      <g data-illo="scan" data-at="0.2">
        <rect x="56" y="48" width="104" height="2" rx="1" fill="var(--forest)" opacity="0.5" />
      </g>

      {/* Extracted requirement chips */}
      <g data-illo="pop" data-at="1.1">
        <rect x="150" y="48" width="64" height="20" rx="10" fill="var(--forest)" />
        <text x="182" y="61.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="white" fontFamily="var(--font-body)">Required</text>
      </g>
      <g data-illo="pop" data-at="2.1">
        <rect x="150" y="78" width="60" height="20" rx="10" fill="var(--gold)" />
        <text x="180" y="91.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="white" fontFamily="var(--font-body)">Senior</text>
      </g>
      <g data-illo="pop" data-at="2.7">
        <rect x="18" y="98" width="48" height="20" rx="10" fill="white" stroke="var(--border)" />
        <text x="42" y="111.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--ink-soft)" fontFamily="var(--font-body)">Nice</text>
      </g>
    </>
  );
}

function UploadCvIllustration() {
  return (
    <>
      {/* Drop zone */}
      <rect x="40" y="76" width="160" height="60" rx="10" fill="var(--mint)" stroke="var(--forest)" strokeOpacity="0.35" strokeDasharray="5 4" />

      {/* The CV file drops in from above */}
      <g data-illo="drop" data-at="0.2">
        <path d="M100 30h30l12 12v44a4 4 0 01-4 4h-38a4 4 0 01-4-4V34a4 4 0 014-4z" fill="white" stroke="var(--border)" />
        <path d="M130 30v8a4 4 0 004 4h8" fill="none" stroke="var(--border)" />
        <circle cx="111" cy="48" r="5" fill="var(--ink-mute)" />
        <rect x="104" y="58" width="30" height="3.5" rx="1.75" fill="var(--ink-mute)" />
        <rect x="104" y="65" width="24" height="3.5" rx="1.75" fill="var(--ink-mute)" />
        <rect x="104" y="72" width="28" height="3.5" rx="1.75" fill="var(--ink-mute)" />
        <rect x="102" y="80" width="18" height="7" rx="2" fill="var(--signal)" />
        <text x="111" y="85.6" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="white" fontFamily="var(--font-body)">PDF</text>
      </g>

      {/* Parse progress */}
      <rect x="64" y="118" width="112" height="6" rx="3" fill="white" />
      <rect data-illo="grow" data-at="1.1" data-dur="1.4" x="64" y="118" width="112" height="6" rx="3" fill="var(--forest)" />

      {/* Parsed tick */}
      <g data-illo="pop" data-at="2.6">
        <circle cx="186" cy="121" r="8" fill="var(--forest)" />
        <path d="M182.5 121.2l2.3 2.3 4.4-4.6" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  );
}

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;
const SCORE = 87;

function ScoreIllustration() {
  return (
    <>
      {/* Score ring */}
      <circle cx="72" cy="70" r={RING_R} fill="none" stroke="var(--mint)" strokeWidth="8" />
      <circle
        data-illo="ring" data-at="0.3" data-dur="1.6"
        cx="72" cy="70" r={RING_R}
        fill="none" stroke="var(--score-strong)" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - SCORE / 100)}
        transform="rotate(-90 72 70)"
        data-from={RING_C}
      />
      <g data-illo="pop" data-at="1.4">
        <text x="72" y="75" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-display)">{SCORE}</text>
      </g>

      {/* Breakdown bars */}
      {[
        { y: 44, w: 70, color: "var(--score-strong)" },
        { y: 62, w: 58, color: "var(--score-strong)" },
        { y: 80, w: 36, color: "var(--score-mid)" },
      ].map((b, i) => (
        <g key={b.y}>
          <rect x="120" y={b.y - 8} width={[34, 26, 30][i]} height="3.5" rx="1.75" fill="var(--ink-mute)" />
          <rect x="120" y={b.y} width="80" height="6" rx="3" fill="var(--mist)" />
          <rect data-illo="grow" data-at={0.9 + i * 0.35} x="120" y={b.y} width={b.w} height="6" rx="3" fill={b.color} />
        </g>
      ))}

      {/* Verdict pill - the one place the signal accent belongs */}
      <g data-illo="pop" data-at="2.4">
        <rect x="120" y="100" width="80" height="22" rx="11" fill="var(--signal-soft)" />
        <circle cx="132" cy="111" r="3" fill="var(--signal)" />
        <text x="164" y="114.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-body)">Strong match</text>
      </g>
    </>
  );
}

const LOOP = 6.4;
const EXIT_AT = 5.6;
const EXIT_END = 6.0;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// Builds one loop's keyframes for a part: hidden until `at`, enters over
// `dur`, holds, then fades out between EXIT_AT and EXIT_END.
function keyframesFor(el) {
  const kind = el.dataset.illo;
  const at = Number(el.dataset.at) || 0;
  const dur = Number(el.dataset.dur) || (kind === "scan" ? 2.4 : kind === "grow" ? 0.9 : 0.5);
  const o = (t) => Math.min(t / LOOP, 1);

  if (kind === "scan") {
    return [
      { offset: 0, opacity: 0, transform: "translateY(0)" },
      { offset: o(at), opacity: 0, transform: "translateY(0)" },
      { offset: o(at + 0.2), opacity: 1, transform: "translateY(0)", easing: "ease-in-out" },
      { offset: o(at + dur - 0.2), opacity: 1, transform: "translateY(74px)" },
      { offset: o(at + dur), opacity: 0, transform: "translateY(78px)" },
      { offset: 1, opacity: 0, transform: "translateY(78px)" },
    ];
  }

  let hidden, shown;
  if (kind === "ring") {
    hidden = { strokeDashoffset: `${el.dataset.from}px` };
    shown = { strokeDashoffset: `${el.getAttribute("stroke-dashoffset")}px` };
  } else if (kind === "grow") {
    hidden = { transform: "scaleX(0)" };
    shown = { transform: "scaleX(1)" };
  } else if (kind === "drop") {
    hidden = { opacity: 0, transform: "translateY(-46px)" };
    shown = { opacity: 1, transform: "translateY(0)" };
  } else {
    hidden = { opacity: 0, transform: "scale(0.6)" };
    shown = { opacity: 1, transform: "scale(1)" };
  }

  return [
    { offset: 0, opacity: 0, ...hidden },
    { offset: o(at), opacity: 1, ...hidden, easing: EASE },
    { offset: o(at + dur), opacity: 1, ...shown },
    { offset: o(EXIT_AT), opacity: 1, ...shown, easing: "ease-in" },
    { offset: o(EXIT_END), opacity: 0, ...shown },
    { offset: 1, opacity: 0, ...hidden },
  ];
}

const ILLUSTRATIONS = {
  read: { Art: ReadJobIllustration, label: "A job description being read, with required and senior-level criteria picked out" },
  upload: { Art: UploadCvIllustration, label: "A PDF CV dropping into an upload area and being parsed" },
  score: { Art: ScoreIllustration, label: "A match score of 87 filling in, with a breakdown and a strong match verdict" },
};

export default function StepIllustration({ kind }) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting), { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    const animations = [...el.querySelectorAll("[data-illo]")].map((part) =>
      part.animate(keyframesFor(part), { duration: LOOP * 1000, iterations: Infinity })
    );
    return () => animations.forEach((a) => a.cancel());
  }, [playing, reducedMotion]);

  const { Art, label } = ILLUSTRATIONS[kind];
  return (
    <div
      ref={ref}
      className="illo rounded-[12px] overflow-hidden"
      style={{ background: "var(--mist)", border: "1px solid var(--border-soft)" }}
    >
      <svg viewBox="0 0 240 150" className="block w-full h-auto" role="img" aria-label={label}>
        <Art />
      </svg>
    </div>
  );
}
