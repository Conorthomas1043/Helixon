"use client";

// The moment a recruiter earns a fee: when a candidate is moved to Placed,
// a card slides up ("Placed · Amy Clarke · Warehouse Team Leader at
// Northwind") with the next step, recording the fee. Kept professional - one
// card, no confetti - and shown finished for anyone who asks for less motion.
//
// Any page fires it with celebratePlacement(); the one listener is mounted
// by DashboardNav, which every dashboard page renders.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";

const EVENT = "helixon:placed";
const SHOW_MS = 9000;

/** @param {{ candidateId: string, name?: string | null, jobTitle?: string | null, company?: string | null }} detail */
export function celebratePlacement(detail) {
  if (typeof window === "undefined" || !detail?.candidateId) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

export default function PlacedMoment() {
  const [moment, setMoment] = useState(null);

  useEffect(() => {
    const onPlaced = (e) => setMoment({ ...e.detail, at: Date.now() });
    window.addEventListener(EVENT, onPlaced);
    return () => window.removeEventListener(EVENT, onPlaced);
  }, []);

  useEffect(() => {
    if (!moment) return undefined;
    const t = setTimeout(() => setMoment(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [moment]);

  if (!moment) return null;
  const role = [moment.jobTitle, moment.company && `at ${moment.company}`].filter(Boolean).join(" ");

  return (
    <div
      key={moment.at}
      role="status"
      className="placed-in print-hide fixed z-[1250] right-4 left-4 sm:left-auto sm:w-[380px] bottom-[calc(1.25rem+var(--tabbar-h))] rounded-card border border-[var(--mint-line)] bg-[var(--bg)] shadow-xl overflow-hidden"
    >
      <div className="flex gap-3.5 p-4 bg-[var(--mint)]">
        <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 text-[var(--forest)]" aria-hidden="true">
          <circle cx="22" cy="22" r="20" fill="none" stroke="var(--mint-line)" strokeWidth="3" />
          <circle className="placed-ring" cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" transform="rotate(-90 22 22)" />
          <path className="placed-tick" d="M14 22.5l5.5 5.5L30 17" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-13 font-semibold text-[var(--forest)]">Placed</p>
          <p className="text-16 font-semibold tracking-tight font-display text-[var(--ink)] truncate">{moment.name || "Your candidate"}</p>
          {role && <p className="text-14 text-[var(--ink-soft)] line-clamp-2">{role}</p>}
        </div>
        <button
          type="button"
          onClick={() => setMoment(null)}
          aria-label="Dismiss"
          className="w-9 h-9 -mr-1.5 -mt-1.5 rounded-btn flex items-center justify-center text-[var(--ink-soft)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-13 text-[var(--ink-soft)]">Nice work. Record the fee to raise the invoice.</p>
        <Link
          href={`/dashboard/candidates/${moment.candidateId}#placement`}
          onClick={() => setMoment(null)}
          className="shrink-0 inline-flex items-center gap-1 min-h-[36px] px-3 rounded-btn text-14 font-semibold bg-[var(--forest)] text-[var(--on-accent)]"
        >
          Record fee <Icon name="arrowRight" size={14} />
        </Link>
      </div>
    </div>
  );
}
