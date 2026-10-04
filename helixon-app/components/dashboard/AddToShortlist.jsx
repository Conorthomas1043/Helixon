"use client";

// "Add to shortlist" - a button that opens a small menu of the agency's
// shortlists (app/api/shortlists) plus a "New shortlist" field. Used on the
// candidate profile (one person) and the Candidates bulk bar (the
// selection). With one candidate, lists they're already on show a tick and
// clicking one takes them off it again.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getShortlists, createShortlist, addToShortlist, removeFromShortlist } from "@/lib/dashboard-api";
import { INK, INK_MUTED, INK_FAINT } from "@/lib/candidate-format";

export default function AddToShortlist({ candidateIds, jobId = null, defaultName = "", onChange, className = "", label = "Add to shortlist" }) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newName, setNewName] = useState(defaultName);
  const ref = useRef(null);
  const single = candidateIds.length === 1 ? candidateIds[0] : null;

  const load = useCallback(() => {
    setLists(null);
    getShortlists(single ? { candidateId: single } : {})
      .then(setLists)
      .catch(() => setLists([]));
  }, [single]);

  function toggleOpen() {
    if (!open) {
      load();
      setMessage("");
      setNewName(defaultName);
    }
    setOpen(!open);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle(list) {
    setBusy(true);
    setMessage("");
    try {
      if (single && list.containsCandidate) {
        await removeFromShortlist(list.id, single);
        setMessage(`Removed from ${list.name}`);
      } else {
        const res = await addToShortlist(list.id, candidateIds);
        setMessage(res.added ? `Added ${res.added} to ${list.name}` : `Already on ${list.name}`);
      }
      load();
      onChange?.();
    } catch (err) {
      setMessage(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function create(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMessage("");
    try {
      const list = await createShortlist({ name, jobId, candidateIds });
      setMessage(`Created ${list.name}`);
      setNewName("");
      load();
      onChange?.();
    } catch (err) {
      setMessage(err.message || "Couldn't create the shortlist.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="true"
        className={
          className ||
          "text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        }
        style={className ? undefined : { border: "1px solid var(--border)", color: INK }}
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Add to shortlist"
          className="absolute z-40 mt-2 w-72 rounded-[12px] bg-white p-3 shadow-xl right-0 sm:left-0 sm:right-auto"
          style={{ border: "1px solid var(--border)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: INK_FAINT }}>
            {candidateIds.length === 1 ? "Shortlists" : `Add ${candidateIds.length} people to`}
          </p>
          {lists === null ? (
            <p className="text-[12px] py-2" style={{ color: INK_MUTED }}>Loading…</p>
          ) : lists.length === 0 ? (
            <p className="text-[12px] py-1" style={{ color: INK_MUTED }}>No shortlists yet - name one below.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto -mx-1">
              {lists.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggle(l)}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-[8px] hover:bg-[var(--mist)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2"
                  >
                    <span className="w-4 text-[12px]" style={{ color: "var(--forest)" }} aria-hidden="true">
                      {l.containsCandidate ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium truncate" style={{ color: INK }}>{l.name}</span>
                      <span className="block text-[11px] truncate" style={{ color: INK_FAINT }}>
                        {[l.jobTitle, `${l.count} ${l.count === 1 ? "person" : "people"}`].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {l.containsCandidate && <span className="sr-only">(on this list - click to remove)</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={create} className="flex items-center gap-1.5 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={120}
              placeholder="New shortlist name"
              aria-label="New shortlist name"
              className="flex-1 min-w-0 text-[12px] px-2.5 py-1.5 rounded-[8px] focus-visible:outline focus-visible:outline-2"
              style={{ border: "1px solid var(--border)", color: INK }}
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-full disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "var(--forest)", color: "white" }}
            >
              Create
            </button>
          </form>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] min-h-[16px]" role="status" style={{ color: INK_MUTED }}>{message}</p>
            <Link href="/dashboard/shortlists" className="text-[11px] font-semibold underline shrink-0" style={{ color: "var(--forest)" }}>
              All shortlists
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
