"use client";
// app/employee/cold-calls/CallListPanel.jsx
// The shared "who to call" list on the cold calls page: import contacts from
// a CSV, see everyone still to call with their number, claim a contact so
// nobody else rings them, and log the outcome (which ticks them off).
// API: app/api/employee/call-list. Parsing: lib/csv.js.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { contactsFromCsv, downloadCsv } from "@/lib/csv";

const CLAIM_TTL_MS = 30 * 60 * 1000; // keep in sync with lib/employee-call-list.js
const PAGE = 100;

const FIELD_LABELS = { contact_name: "Name", first_name: "First name", last_name: "Last name", company: "Company", phone: "Phone", email: "Email", notes: "Notes" };

function personName(p) {
  return p?.full_name || p?.display_name || "someone";
}

function activeClaim(row, now) {
  return row.claimed_by && row.claimed_at && now - new Date(row.claimed_at).getTime() < CLAIM_TTL_MS;
}

function timeAgo(iso, now) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

async function post(body) {
  const res = await fetch("/api/employee/call-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Something went wrong.");
  return data;
}

const btn = "text-xs font-semibold px-2.5 py-1.5 rounded-lg transition disabled:opacity-50";

export default function CallListPanel({ employee, onLogCall, refreshKey }) {
  const [list, setList] = useState({ pending: [], done: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | open | mine
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [showDone, setShowDone] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [preview, setPreview] = useState(null); // { fileName, contacts, skipped, duplicates, mapping, hasHeader, headers }
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/employee/call-list", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Could not load the call list.");
      setList({ pending: data.pending || [], done: data.done || [] });
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load, whenever the page logs a call, and every 30s so claims by
  // teammates show up without a refresh.
  useEffect(() => {
    const first = setTimeout(load, 0);
    const poll = setInterval(() => {
      load();
      setNow(Date.now()); // lets stale claims expire on screen
    }, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
    };
  }, [load, refreshKey]);

  const counts = useMemo(() => {
    const today = new Date().toDateString();
    return {
      pending: list.pending.length,
      doneToday: list.done.filter((r) => r.status === "done" && r.completed_at && new Date(r.completed_at).toDateString() === today).length,
    };
  }, [list]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.pending.filter((row) => {
      const claimed = activeClaim(row, now);
      if (filter === "open" && claimed && row.claimed_by !== employee?.id) return false;
      if (filter === "mine" && !(claimed && row.claimed_by === employee?.id)) return false;
      if (!q) return true;
      return [row.contact_name, row.company, row.phone, row.email, row.batch_label].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [list.pending, filter, query, now, employee?.id]);

  async function act(row, action) {
    setBusyId(row.id);
    setError("");
    try {
      const data = await post({ action, id: row.id });
      if (action === "delete" || action === "skip") {
        setList((l) => ({ pending: l.pending.filter((r) => r.id !== row.id), done: action === "skip" ? [data.row, ...l.done] : l.done }));
      } else if (action === "reopen") {
        setList((l) => ({ pending: [...l.pending, data.row], done: l.done.filter((r) => r.id !== row.id) }));
      } else {
        setList((l) => ({ ...l, pending: l.pending.map((r) => (r.id === row.id ? data.row : r)) }));
      }
      return data.row;
    } catch (err) {
      setError(err.message);
      load();
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function logOutcome(row) {
    // Claim first so teammates see it's taken while the form is open.
    if (!(activeClaim(row, now) && row.claimed_by === employee?.id)) {
      const claimed = await act(row, "claim");
      if (!claimed) return;
    }
    onLogCall(row);
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNotice("");
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is over 5MB - split it into smaller CSVs.");
      return;
    }
    const text = await file.text();
    const result = contactsFromCsv(text);
    if (!result.contacts.length) {
      setError(
        result.skipped
          ? `No rows with a phone number found in ${file.name}. Make sure there's a column called "Phone" (or Mobile / Number).`
          : `${file.name} looks empty.`
      );
      return;
    }
    setPreview({ ...result, fileName: file.name, batchLabel: file.name.replace(/\.[^.]+$/, "") });
  }

  async function confirmImport() {
    setImporting(true);
    setError("");
    try {
      const data = await post({ action: "import", contacts: preview.contacts, batchLabel: preview.batchLabel });
      setNotice(
        `Added ${data.inserted} contact${data.inserted === 1 ? "" : "s"} to the list` +
          (data.alreadyListed ? ` (${data.alreadyListed} already on it, skipped).` : ".")
      );
      setPreview(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    downloadCsv("call-list-template.csv", [
      { Name: "Jo Smith", Company: "Acme Recruitment", Phone: "07700 900123", Email: "jo@acme.example", Notes: "Met at expo" },
    ]);
  }

  return (
    <section className="rounded-[16px] mb-6 overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }} aria-label="Call list">
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Call list
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
            <b style={{ color: "var(--ink)" }}>{counts.pending}</b> to call · <b style={{ color: "var(--forest)" }}>{counts.doneToday}</b> done today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={downloadTemplate} className={btn} style={{ color: "var(--ink-soft)" }}>
            Template
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={btn} style={{ background: "var(--mint)", color: "var(--forest)" }}>
            Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={onFile} />
        </div>
      </div>

      {(error || notice) && (
        <div
          className="mx-5 mt-4 rounded-lg px-3 py-2 text-xs"
          style={error ? { background: "#fdf1f0", color: "#c0392b", border: "1px solid #f4d4d2" } : { background: "var(--mint)", color: "var(--forest)" }}
          role={error ? "alert" : "status"}
        >
          {error || notice}
        </div>
      )}

      {preview && (
        <div className="mx-5 mt-4 rounded-[12px] p-4" style={{ background: "var(--mist)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {preview.contacts.length} contact{preview.contacts.length === 1 ? "" : "s"} ready to import from {preview.fileName}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
            {preview.skipped > 0 && `${preview.skipped} row${preview.skipped === 1 ? "" : "s"} without a phone number skipped. `}
            {preview.duplicates > 0 && `${preview.duplicates} duplicate number${preview.duplicates === 1 ? "" : "s"} removed. `}
            {preview.hasHeader
              ? `Columns used: ${Object.keys(preview.mapping).map((f) => FIELD_LABELS[f]).join(", ")}.`
              : "No header row found - reading columns as Name, Company, Phone."}
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full text-xs" style={{ background: "white" }}>
              <thead>
                <tr style={{ color: "var(--ink-faint)" }}>
                  {["Name", "Company", "Phone", "Email"].map((h) => (
                    <th key={h} className="text-left font-semibold px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.contacts.slice(0, 5).map((c, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border-soft)", color: "var(--ink)" }}>
                    <td className="px-3 py-1.5">{c.contact_name || "-"}</td>
                    <td className="px-3 py-1.5">{c.company || "-"}</td>
                    <td className="px-3 py-1.5 tabular-nums">{c.phone}</td>
                    <td className="px-3 py-1.5">{c.email || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.contacts.length > 5 && (
            <p className="text-[11px] mt-1.5" style={{ color: "var(--ink-faint)" }}>…and {preview.contacts.length - 5} more</p>
          )}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2">
            <label className="flex-1">
              <span className="block text-[11px] font-medium mb-1" style={{ color: "var(--ink-soft)" }}>List name (optional)</span>
              <input
                type="text"
                value={preview.batchLabel}
                onChange={(e) => setPreview((p) => ({ ...p, batchLabel: e.target.value }))}
                className="w-full bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={confirmImport} disabled={importing} className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: "var(--forest)", color: "white" }}>
                {importing ? "Importing…" : `Import ${preview.contacts.length}`}
              </button>
              <button type="button" onClick={() => setPreview(null)} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--ink-soft)" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pt-4 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-1.5">
          {[
            ["all", "Everyone"],
            ["open", "Not claimed"],
            ["mine", "My calls"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setFilter(value); setShown(PAGE); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition"
              style={filter === value ? { background: "var(--forest)", color: "white" } : { background: "white", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
          placeholder="Search name, company or number"
          className="sm:ml-auto w-full sm:w-64 bg-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2"
          style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
        />
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--ink-faint)" }}>Loading…</p>
        ) : list.pending.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Nobody on the list yet.</p>
            <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
              Import a CSV with a Phone column (Name and Company help too) - everyone on the team will see it here.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--ink-faint)" }}>No contacts match.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-soft)]">
            {visible.slice(0, shown).map((row) => {
              const claimed = activeClaim(row, now);
              const mine = claimed && row.claimed_by === employee?.id;
              const takenByOther = claimed && !mine;
              const busy = busyId === row.id;
              return (
                <li key={row.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                        {row.contact_name || row.company || "Unnamed contact"}
                      </p>
                      {mine && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>You&apos;re calling</span>
                      )}
                      {takenByOther && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fdf5e9", color: "#b8791f" }}>
                          {personName(row.claimer)} is calling
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-faint)" }}>
                      {[row.contact_name && row.company, row.email, row.batch_label && `List: ${row.batch_label}`].filter(Boolean).join(" · ")}
                    </p>
                    {row.notes && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--ink-soft)" }}>{row.notes}</p>}
                  </div>
                  <a
                    href={`tel:${row.phone.replace(/[^\d+]/g, "")}`}
                    className="text-sm font-semibold tabular-nums shrink-0 hover:underline"
                    style={{ color: takenByOther ? "var(--ink-faint)" : "var(--forest)" }}
                  >
                    {row.phone}
                  </a>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" disabled={busy || takenByOther} onClick={() => logOutcome(row)} className={btn} style={{ background: "var(--forest)", color: "white" }}>
                      Log outcome
                    </button>
                    {mine ? (
                      <button type="button" disabled={busy} onClick={() => act(row, "release")} className={btn} style={{ color: "var(--ink-soft)" }}>
                        Release
                      </button>
                    ) : (
                      <button type="button" disabled={busy || takenByOther} onClick={() => act(row, "claim")} className={btn} style={{ color: "var(--ink-soft)" }}>
                        Claim
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => act(row, "skip")} className={btn} style={{ color: "var(--ink-faint)" }} title="Take off the list without logging a call">
                      Skip
                    </button>
                    {row.uploaded_by === employee?.id && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => confirm("Delete this contact from the list?") && act(row, "delete")}
                        className={btn}
                        style={{ color: "#e0554f" }}
                        aria-label="Delete contact"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {visible.length > shown && (
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-2 w-full text-xs font-semibold py-2 rounded-lg" style={{ background: "var(--mist)", color: "var(--ink-soft)" }}>
            Show {Math.min(PAGE, visible.length - shown)} more of {visible.length - shown}
          </button>
        )}

        {list.done.length > 0 && (
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
            <button type="button" onClick={() => setShowDone((v) => !v)} className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }} aria-expanded={showDone}>
              {showDone ? "▾" : "▸"} Recently done ({list.done.length})
            </button>
            {showDone && (
              <ul className="mt-2 space-y-1.5">
                {list.done.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate" style={{ color: "var(--ink-soft)" }}>
                      <span style={{ color: "var(--ink)" }}>{row.contact_name || row.company || row.phone}</span>
                      {" · "}
                      {row.status === "skipped" ? "Skipped" : "Called"} by {personName(row.completer)}
                      {row.completed_at ? ` ${timeAgo(row.completed_at, now)}` : ""}
                    </span>
                    <button type="button" disabled={busyId === row.id} onClick={() => act(row, "reopen")} className="shrink-0 font-semibold" style={{ color: "var(--forest)" }}>
                      Put back
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
