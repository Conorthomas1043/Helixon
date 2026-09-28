"use client";

// Pick already-screened candidates to compare - anyone in the agency, not
// only people scored for one role. Rows look like the Candidates list
// (avatar, role, stage, score); click to pick or unpick. People from the
// role being compared are offered first when there's one.

import { useEffect, useMemo, useState } from "react";
import { getCandidates } from "@/lib/dashboard-api";
import { scoreTone } from "../_lib/analyse";
import { Icon, Spinner, cx } from "./ui";
import { Avatar, PillButton, StagePill } from "./compareBits";

function Row({ c, picked, disabled, onToggle }) {
  const tone = scoreTone(c.score);
  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(c.id)}
        disabled={disabled && !picked}
        aria-pressed={picked}
        className={cx(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-45 disabled:cursor-not-allowed",
          picked ? "bg-[#f4faf7]" : "bg-white hover:bg-[var(--mist)]"
        )}
      >
        <span
          className={cx(
            "w-5 h-5 rounded-[6px] border flex items-center justify-center shrink-0",
            picked ? "bg-[var(--forest)] border-[var(--forest)] text-white" : "border-[var(--ink-mute)] bg-white"
          )}
          aria-hidden="true"
        >
          {picked && <Icon name="check" size={12} strokeWidth={2.6} />}
        </span>
        <Avatar name={c.name} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-[var(--ink)] truncate">{c.name}</span>
          <span className="block text-[12.5px] text-[var(--ink-soft)] truncate">
            {[c.currentTitle, c.jobTitle && `screened for ${c.jobTitle}`].filter(Boolean).join(" · ") || "No role on file"}
          </span>
        </span>
        <span className="hidden sm:block shrink-0">
          <StagePill stage={c.stage} />
        </span>
        <span className="w-12 text-right shrink-0">
          <span className="block text-[15px] font-semibold tabular-nums" style={{ color: tone.fg }}>
            {c.score ?? "–"}
          </span>
          {c.score != null && <span className="block text-[10.5px] text-[var(--ink-faint)]">{tone.label.replace(" match", "").replace("Worth a look", "Moderate")}</span>}
        </span>
      </button>
    </li>
  );
}

export default function CandidateChooser({ selected, max, onToggle, onCompare, pool = [], knownPeople = [] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [known, setKnown] = useState({});

  // Debounced search; an empty search lists the most recently screened.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      getCandidates({ search: query.trim(), sortBy: "newest", pageSize: 20 })
        .then((r) => {
          if (cancelled) return;
          const rows = (r.items || []).map((c) => ({
            id: c.id,
            name: c.fullName,
            currentTitle: c.currentTitle,
            jobTitle: c.jobTitle,
            stage: c.stage,
            score: c.score,
          }));
          setResults(rows);
          setKnown((k) => ({ ...k, ...Object.fromEntries(rows.map((row) => [row.id, row])) }));
          setError("");
        })
        .catch((err) => {
          if (!cancelled) setError(err.message || "Couldn't load candidates.");
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // People from the role being compared, shown first (not while searching).
  const poolRows = useMemo(
    () => (query.trim() ? [] : pool.filter((p) => !p.blind).map((p) => ({ ...p, jobTitle: null }))),
    [pool, query]
  );
  const poolIds = new Set(poolRows.map((p) => p.id));
  const otherRows = (results || []).filter((r) => !poolIds.has(r.id));

  const nameOf = (id) =>
    known[id]?.name || knownPeople.find((p) => p.id === id)?.name || pool.find((p) => p.id === id)?.name || "Candidate";
  const full = selected.length >= max;

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidates by name…"
          aria-label="Search candidates"
          className="w-full text-[14px] px-5 py-3 rounded-full border border-[var(--border)] bg-white text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)]"
        />
      </div>

      {error && <p className="text-[12.5px] text-[#a83226]">{error}</p>}

      {poolRows.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-faint)] mb-2 px-1">From this role</p>
          <ul className="divide-y divide-[var(--border-soft)] rounded-[14px] border border-[var(--border)] overflow-hidden">
            {poolRows.map((c) => (
              <Row key={c.id} c={c} picked={selected.includes(c.id)} disabled={full} onToggle={onToggle} />
            ))}
          </ul>
        </div>
      )}

      <div>
        {poolRows.length > 0 && (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-faint)] mb-2 px-1">Everyone else</p>
        )}
        {results === null ? (
          <div className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)] py-4 px-1">
            <Spinner /> Loading candidates…
          </div>
        ) : otherRows.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-soft)] py-4 px-1">{query ? "No candidates match that name." : poolRows.length ? "No one else yet." : "No screened candidates yet."}</p>
        ) : (
          <ul className="divide-y divide-[var(--border-soft)] rounded-[14px] border border-[var(--border)] overflow-hidden max-h-[420px] overflow-y-auto">
            {otherRows.map((c) => (
              <Row key={c.id} c={c} picked={selected.includes(c.id)} disabled={full} onToggle={onToggle} />
            ))}
          </ul>
        )}
      </div>

      {onCompare && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[var(--border-soft)]">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {selected.length === 0 ? (
              <p className="text-[12.5px] text-[var(--ink-faint)]">Choose 2 to {max} candidates.</p>
            ) : (
              selected.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-[var(--mint)] text-[12.5px] font-semibold text-[var(--forest-deep)]">
                  {nameOf(id)}
                  <button type="button" onClick={() => onToggle(id)} aria-label={`Remove ${nameOf(id)}`} className="p-0.5 rounded-full hover:bg-white/60">
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))
            )}
          </div>
          <PillButton primary disabled={selected.length < 2} onClick={onCompare} className="shrink-0">
            {selected.length >= 2 ? `Compare ${selected.length} candidates` : "Compare"}
            <Icon name="arrowRight" size={14} />
          </PillButton>
        </div>
      )}
    </div>
  );
}
