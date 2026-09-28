"use client";

// Pick any already-screened candidates to compare - not only people scored
// for the same role (that's the "Add a candidate" picker on the compare
// page). Searches the agency's candidate list by name.

import { useEffect, useState } from "react";
import { getCandidates } from "@/lib/dashboard-api";
import { Button, Input, Spinner, cx } from "./ui";

export default function CandidateChooser({ selected, max, onAdd, onCompare, compareLabel = "Compare" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  // Debounced search; empty search lists the most recently screened.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      getCandidates({ search: query.trim(), sortBy: "newest", pageSize: 12 })
        .then((r) => {
          if (!cancelled) {
            setResults(r.items || []);
            setError("");
          }
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

  const full = selected.length >= max;

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search candidates by name"
        aria-label="Search candidates"
      />

      {error && <p className="text-[12.5px] text-[#a83226]">{error}</p>}

      {results === null ? (
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)] py-3">
          <Spinner /> Loading candidates…
        </div>
      ) : results.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-soft)] py-3">{query ? "No candidates match that name." : "No screened candidates yet."}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-soft)] rounded-[12px] border border-[var(--border)] overflow-hidden">
          {results.map((c) => {
            const picked = selected.includes(c.id);
            return (
              <li key={c.id} className={cx("flex items-center gap-3 px-3.5 py-2.5 bg-white", picked && "bg-[#f4faf7]")}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-[var(--ink)] truncate">{c.fullName}</span>
                  <span className="block text-[12px] text-[var(--ink-faint)] truncate">
                    {[c.currentTitle, c.jobTitle && `screened for ${c.jobTitle}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {c.score != null && <span className="text-[12.5px] font-semibold tabular-nums text-[var(--ink-soft)] shrink-0">{c.score}</span>}
                <Button size="sm" variant={picked ? "ghost" : "secondary"} disabled={picked || full} onClick={() => onAdd(c.id)}>
                  {picked ? "Added" : "Add"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {onCompare && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[12px] text-[var(--ink-faint)]">
            {selected.length} of {max} chosen{full ? " - that's the most at once" : ""}
          </p>
          <Button variant="primary" disabled={selected.length < 2} onClick={onCompare} iconRight="arrowRight">
            {compareLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
