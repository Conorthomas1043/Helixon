"use client";

// "Add a candidate" for the split view: type a name, pick from the matches.

import { useEffect, useId, useState } from "react";
import { Icon, Spinner } from "@/components/ui";
import { getCandidates } from "@/lib/dashboard-api";
import { useResource } from "@/lib/hooks/useResource";

/** @param {{ exclude: string[], onPick: (id: string) => void }} props */
export default function CandidatePicker({ exclude, onPick }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();

  // Searches once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, loading } = useResource(search.length >= 2 ? `workspace-picker:${search}` : null, () => getCandidates({ search, pageSize: 8 }));
  const results = (data?.items ?? []).filter((c) => !exclude.includes(c.id));

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
      <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-white px-3 focus-within:ring-2 focus-within:ring-[var(--forest)]">
        <Icon name="plus" size={14} className="text-[var(--ink-soft)]" />
        <input
          id={`${listId}-input`}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) pick(results[0].id);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Add a candidate by name…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && search.length >= 2}
          aria-controls={listId}
          className="h-9 w-full min-w-0 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
        {loading && <Spinner size={14} />}
      </div>
      {open && search.length >= 2 && !loading && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-[10px] border border-[var(--border)] bg-white py-1 shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--ink-soft)]">No one matches &quot;{search}&quot;.</li>
          ) : (
            results.map((c) => (
              <li key={c.id} role="option" aria-selected="false">
                <button
                  type="button"
                  // Before the input's blur closes the list.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[var(--mist)] focus-visible:bg-[var(--mist)] focus-visible:outline-none"
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
