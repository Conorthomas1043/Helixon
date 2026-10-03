"use client";

// The nav's search (⌘K / Ctrl+K, or "/") across candidates, jobs, clients
// and contacts (app/api/search), and the notifications bell
// (app/api/notifications).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const KIND_LABEL = { candidate: "Candidate", job: "Job", client: "Client", contact: "Contact" };

function isTyping(el) {
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults([]);
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !isTyping(document.activeElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const term = q.trim();
    if (term.length < 2) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => {
          if (cancelled) return;
          setResults(d.results || []);
          setActive(0);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  function go(r) {
    if (!r) return;
    close();
    router.push(r.href);
  }

  const shown = q.trim().length >= 2 ? results : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search (Ctrl+K)"
        title="Search candidates, jobs and clients (Ctrl+K)"
        className="flex items-center gap-2 h-8 px-2.5 rounded-full text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
        style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden lg:inline text-[10px] px-1 rounded" style={{ background: "var(--mist)" }}>⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4" style={{ background: "rgba(19,32,27,0.4)" }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div role="dialog" aria-modal="true" aria-label="Search" className="w-full max-w-[560px] rounded-[16px] bg-white shadow-xl overflow-hidden">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, shown.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") go(shown[active]);
              }}
              placeholder="Search candidates, jobs, clients and contacts…"
              aria-label="Search"
              role="combobox"
              aria-expanded={shown.length > 0}
              aria-controls="search-results"
              aria-activedescendant={shown[active] ? `search-${shown[active].kind}-${shown[active].id}` : undefined}
              className="w-full px-5 py-4 text-[15px] outline-none"
              style={{ borderBottom: "1px solid var(--border)", color: "var(--ink)" }}
            />
            <ul id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
              {q.trim().length < 2 && <li className="px-5 py-4 text-[13px]" style={{ color: "var(--ink-faint)" }}>Type at least two letters. ↑↓ to move, Enter to open.</li>}
              {q.trim().length >= 2 && !loading && shown.length === 0 && <li className="px-5 py-4 text-[13px]" style={{ color: "var(--ink-faint)" }}>Nothing found for “{q.trim()}”.</li>}
              {shown.map((r, i) => (
                <li
                  key={`${r.kind}-${r.id}`}
                  id={`search-${r.kind}-${r.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(r);
                  }}
                  className="flex items-center gap-3 px-5 py-2.5 cursor-pointer"
                  style={{ background: i === active ? "var(--mist)" : "transparent" }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide w-16 shrink-0" style={{ color: "var(--ink-faint)" }}>{KIND_LABEL[r.kind]}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>{r.title}</span>
                    {r.subtitle && <span className="block text-[12px] truncate" style={{ color: "var(--ink-soft)" }}>{r.subtitle}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function NotificationsBell() {
  const router = useRouter();
  const [state, setState] = useState({ list: [], unread: 0, unavailable: false });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(() => {
    fetch("/api/notifications", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setState({ list: d.notifications || [], unread: d.unread || 0, unavailable: Boolean(d.unavailable) }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(body) {
    await fetch("/api/notifications", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  }

  function openItem(n) {
    setOpen(false);
    if (!n.read) {
      setState((s) => ({ ...s, unread: Math.max(0, s.unread - 1), list: s.list.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
      markRead({ ids: [n.id] });
    }
    if (n.href) router.push(n.href);
  }

  if (state.unavailable) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={state.unread ? `Notifications, ${state.unread} unread` : "Notifications"}
        className="relative w-8 h-8 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
        style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {state.unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: "var(--score-low)" }}>
            {state.unread > 9 ? "9+" : state.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-80 rounded-[12px] bg-white overflow-hidden" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 24px -12px rgba(19,32,27,0.25)" }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>Notifications</p>
            {state.unread > 0 && (
              <button
                type="button"
                className="text-[11px] font-semibold"
                style={{ color: "var(--forest)" }}
                onClick={() => {
                  setState((s) => ({ ...s, unread: 0, list: s.list.map((x) => ({ ...x, read: true })) }));
                  markRead({ all: true });
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {state.list.length === 0 && <li className="px-4 py-6 text-[12px] text-center" style={{ color: "var(--ink-faint)" }}>Nothing yet. Signatures, bookings, applications and replies show up here.</li>}
            {state.list.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openItem(n)} className="w-full text-left px-4 py-2.5 flex gap-2 hover:bg-[var(--mist)]">
                  <span aria-hidden="true" className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: n.read ? "transparent" : "var(--forest)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px]" style={{ color: "var(--ink)", fontWeight: n.read ? 400 : 600 }}>{n.title}</span>
                    {n.body && <span className="block text-[11.5px] truncate" style={{ color: "var(--ink-soft)" }}>{n.body}</span>}
                  </span>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--ink-faint)" }}>{timeAgo(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
