"use client";

// Saved searches on the Candidates page: pick one (with how many people it
// matches now), save the current filters as a new one - optionally shared
// with the team and/or emailed daily with new matches - or remove yours.

import { useEffect, useRef, useState } from "react";
import { getSavedSearches, saveSearch, updateSavedSearch, deleteSavedSearch } from "@/lib/dashboard-api";
import { Button, Dialog, ErrorText, Field, Pill, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

export default function SavedSearches({ currentQuery, onApply }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [f, setF] = useState({ name: "", shared: false, alert: false });
  const [error, setError] = useState("");
  const ref = useRef(null);

  function load() {
    setList(null);
    getSavedSearches({ counts: true }).then(setList).catch(() => setList([]));
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveSearch({ ...f, params: Object.fromEntries(new URLSearchParams(currentQuery)) });
      setDialog(false);
      setF({ name: "", shared: false, alert: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function act(fn) {
    try {
      await fn();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const btn = "inline-flex items-center gap-1.5 text-13 font-semibold px-3 py-1.5 rounded-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open) load();
          setOpen(!open);
        }}
        className={btn}
        style={{ background: "var(--bg)", color: INK_MUTED, border: "1px solid var(--border)" }}
      >
        ★ Saved searches
      </button>
      {open && (
        <div className="absolute z-40 mt-2 w-80 right-0 rounded-xl bg-[var(--bg)] p-3 shadow-xl border border-[var(--border)]">
          {list === null ? (
            <p className="text-13 text-[var(--ink-soft)]">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-13 text-[var(--ink-soft)]">Nothing saved yet - set up filters or a search, then save it.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto -mx-1">
              {list.map((s) => (
                <li key={s.id} className="flex items-center gap-1 rounded-lg hover:bg-[var(--mist)] px-2 py-1.5">
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => {
                      setOpen(false);
                      onApply(new URLSearchParams(s.params).toString());
                    }}
                  >
                    <span className="block text-14 font-medium truncate text-[var(--ink)]">
                      {s.name} {s.count != null && <span className="text-12 tabular-nums text-[var(--ink-faint)]">({s.count})</span>}
                    </span>
                    <span className="block text-12 text-[var(--ink-faint)]">
                      {[s.mine ? null : "Shared by a teammate", s.shared && s.mine ? "Shared" : null, s.alert && s.mine ? "Daily email" : null].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                  {s.mine && (
                    <>
                      <button type="button" className="text-12 font-semibold px-1 text-[var(--forest)]" title={s.alert ? "Stop the daily email" : "Email me new matches each weekday"} onClick={() => act(() => updateSavedSearch(s.id, { alert: !s.alert }))}>
                        {s.alert ? "🔔" : "🔕"}
                      </button>
                      <button type="button" className="text-12 font-semibold px-1 text-[var(--ink-faint)]" aria-label={`Delete ${s.name}`} onClick={() => act(() => deleteSavedSearch(s.id))}>
                        ✕
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 pt-2 border-t border-t-[var(--border)]">
            <Button size="sm" variant="primary" disabled={!currentQuery} onClick={() => setDialog(true)} title={currentQuery ? undefined : "Set a search or filter first"}>
              Save current search
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {dialog && (
        <Dialog title="Save this search" onClose={() => setDialog(false)} busy={saving}>
          <form onSubmit={save} className="space-y-3">
            <Field label="Name">
              <TextInput required maxLength={120} value={f.name} onChange={(e) => setF((v) => ({ ...v, name: e.target.value }))} placeholder="e.g. Senior Java devs near Leeds" />
            </Field>
            <label className="flex items-center gap-2 text-14 text-[var(--ink)]">
              <input type="checkbox" checked={f.shared} onChange={(e) => setF((v) => ({ ...v, shared: e.target.checked }))} className="accent-[var(--forest)]" />
              Share with my team
            </label>
            <label className="flex items-center gap-2 text-14 text-[var(--ink)]">
              <input type="checkbox" checked={f.alert} onChange={(e) => setF((v) => ({ ...v, alert: e.target.checked }))} className="accent-[var(--forest)]" />
              Email me new matches each weekday morning
            </label>
            <p className="text-12 text-[var(--ink-faint)]">
              <Pill>{currentQuery.replace(/&/g, " · ").slice(0, 120)}</Pill>
            </p>
            <ErrorText>{error}</ErrorText>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              <Button variant="ghost" onClick={() => setDialog(false)}>Cancel</Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
