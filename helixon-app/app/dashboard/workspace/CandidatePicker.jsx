"use client";

// "Add a candidate" for the split view: type a name, pick from the matches.

import { useEffect, useId, useState } from "react";
import { Icon, Spinner, cx } from "@/components/ui";
import { getCandidates } from "@/lib/dashboard-api";
import { useResource } from "@/lib/hooks/useResource";

/** @param {{ exclude: string[], onPick: (id: string) => void }} props */
export default function CandidatePicker({ exclude, onPick }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  // The highlighted match, moved with the arrow keys.
  const [active, setActive] = useState(0);
  const listId = useId();

  // Searches once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, loading } = useResource(search.length >= 2 ? `workspace-picker:${search}` : null, () => getCandidates({ search, pageSize: 8 }));
  const results = (data?.items ?? []).filter((c) => !exclude.includes(c.id));
  const current = Math.min(active, Math.max(results.length - 1, 0));
  const showList = open && search.length >= 2 && !loading;

  function pick(id) {
    onPick(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative w-full sm:w-80">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Add a candidate
      </label>
      <div className="flex items-center gap-2 rounded-btn border border-[var(--border)] bg-[var(--bg)] px-3 focus-within:ring-2 focus-within:ring-[var(--forest)]">
        <Icon name="plus" size={14} className="text-[var(--ink-soft)]" />
        <input
          id={`${listId}-input`}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              if (results.length) setActive((current + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
            }
            if (e.key === "Enter" && results[current]) {
              e.preventDefault();
              pick(results[current].id);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Add a candidate by name…"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[current] ? `${listId}-${results[current].id}` : undefined}
          className="h-9 w-full min-w-0 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
        {loading && <Spinner size={14} />}
      </div>
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-btn border border-[var(--border)] bg-[var(--bg)] py-1 shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--ink-soft)]">No one matches &quot;{search}&quot;.</li>
          ) : (
            results.map((c, i) => (
              <li key={c.id} id={`${listId}-${c.id}`} role="option" aria-selected={i === current}>
                <button
                  type="button"
                  // Before the input's blur closes the list.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c.id)}
                  onMouseEnter={() => setActive(i)}
                  tabIndex={-1}
                  className={cx(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left focus-visible:outline-none",
                    i === current ? "bg-[var(--mist)]" : "hover:bg-[var(--mist)]"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--ink)]">{c.fullName}</span>
                    <span className="block truncate text-xs text-[var(--ink-soft)]">{[c.jobTitle, c.stage].filter(Boolean).join(" · ")}</span>
                  </span>
                  {c.score != null && <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--ink-soft)]">{c.score}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
