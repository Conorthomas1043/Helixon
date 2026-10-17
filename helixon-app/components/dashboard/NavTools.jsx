"use client";

// The nav's command palette (⌘K / Ctrl+K, or "/"): actions to run
// (lib/ui/commands.js) and search across candidates, jobs, clients and
// contacts (app/api/search); the notifications bell
// (app/api/notifications), and the background mailbox sync.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { timeAgo as fmtTimeAgo } from "@/lib/format";
import { reportQuietly } from "@/lib/report-error";
import { matchCommands } from "@/lib/ui/commands";
import { FUNNEL_ORDER, STAGE_LABELS } from "@/lib/candidates/stage-labels";
import { updateCandidateStage } from "@/lib/dashboard-api";
import { celebratePlacement } from "@/components/dashboard/PlacedMoment";

const timeAgo = (iso) => fmtTimeAgo(iso, { style: "compact" });

const KIND_LABEL = { candidate: "Candidate", job: "Job", client: "Client", contact: "Contact", action: "Action" };

// Recently opened candidates, jobs and clients - per browser, shown in the
// search box before anything's typed.
const RECENT_KEY = "helixon.recent";
const RECENT_MAX = 8;
const RECENT_PATHS = [
  [/^\/dashboard\/candidates\/([0-9a-f-]{36})$/, "candidate"],
  [/^\/dashboard\/jobs\/([0-9a-f-]{36})$/, "job"],
  [/^\/dashboard\/clients\/([0-9a-f-]{36})$/, "client"],
];

function readRecent() {
  try {
    const list = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function remember(entry) {
  try {
    const list = readRecent().filter((r) => r.href !== entry.href);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...list].slice(0, RECENT_MAX)));
  } catch {
    // Private mode or storage full - just don't remember.
  }
}

// Records the page being viewed once its heading has rendered.
function useRememberPage() {
  const pathname = usePathname();
  useEffect(() => {
    const match = RECENT_PATHS.find(([re]) => re.test(pathname || ""));
    if (!match) return undefined;
    const t = setTimeout(() => {
      const title = document.querySelector("main h1")?.textContent?.trim();
      if (title && title.length < 200) remember({ href: pathname, kind: match[1], id: pathname.split("/").pop(), title });
    }, 1500);
    return () => clearTimeout(t);
  }, [pathname]);
}

// "g" then a letter jumps to a page.
const GO_KEYS = {
  o: "/dashboard",
  a: "/analyse",
  c: "/dashboard/candidates",
  p: "/dashboard/pipeline",
  j: "/dashboard/jobs",
  l: "/dashboard/clients",
  i: "/dashboard/interviews",
  b: "/dashboard/business-development",
  t: "/dashboard/talent-pool",
  n: "/dashboard/analytics",
};
const GO_LABELS = { o: "Overview", a: "Analyse", c: "Candidates", p: "Pipeline", j: "Jobs", l: "Clients", i: "Interviews", b: "Business development", t: "Talent pool", n: "Analytics" };

// Shortcuts that only work on some pages, listed in the "?" overlay there.
const PAGE_SHORTCUTS = [
  {
    match: /^\/dashboard\/candidates\/[^/]+$/,
    title: "On this candidate",
    keys: [
      ["j", "Next candidate"],
      ["k", "Previous candidate"],
      ["s", "Shortlist"],
      ["n", "Add a note"],
    ],
  },
  { match: /^\/analyse/, title: "On this page", keys: [["Ctrl/⌘ Enter", "Screen the CV"]] },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [help, setHelp] = useState(false);
  const pageShortcuts = PAGE_SHORTCUTS.find((p) => p.match.test(pathname || ""));
  useRememberPage();

  useEffect(() => {
    let pendingG = 0;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelp((v) => !v);
        return;
      }
      if (e.key === "Escape") setHelp(false);
      if (e.key === "g") {
        pendingG = Date.now();
        return;
      }
      if (pendingG && Date.now() - pendingG < 1200 && GO_KEYS[e.key]) {
        e.preventDefault();
        pendingG = 0;
        router.push(GO_KEYS[e.key]);
      } else {
        pendingG = 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!help) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: "rgba(19,32,27,0.4)" }} onMouseDown={(e) => e.target === e.currentTarget && setHelp(false)}>
      <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="w-full max-w-[420px] rounded-2xl bg-[var(--bg)] shadow-xl p-6">
        <h2 className="text-base font-semibold mb-4 text-[var(--ink)]">Keyboard shortcuts</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-14 text-[var(--ink-soft)]">
          <dt><kbd>Ctrl/⌘ K</kbd> or <kbd>/</kbd></dt>
          <dd>Search</dd>
          {Object.entries(GO_LABELS).map(([k, label]) => (
            <div key={k} className="contents">
              <dt><kbd>g</kbd> then <kbd>{k}</kbd></dt>
              <dd>{label}</dd>
            </div>
          ))}
          <dt><kbd>?</kbd></dt>
          <dd>This list</dd>
        </dl>
        {pageShortcuts && (
          <>
            <h3 className="text-14 font-semibold mt-5 mb-2 text-[var(--ink)]">{pageShortcuts.title}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-14 text-[var(--ink-soft)]">
              {pageShortcuts.keys.map(([k, label]) => (
                <div key={k} className="contents">
                  <dt><kbd>{k}</kbd></dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <button type="button" className="mt-5 text-13 font-semibold text-[var(--forest)]" onClick={() => setHelp(false)}>Close</button>
      </div>
    </div>
  );
}

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
  // "Move <candidate> to…": the candidate whose stages are listed, and the
  // outcome once one's picked ({ ok, text }).
  const [moving, setMoving] = useState(null);
  const [moved, setMoved] = useState(null);
  const inputRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults([]);
    setActive(0);
    setMoving(null);
    setMoved(null);
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

  const [recent, setRecent] = useState([]);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      setRecent(readRecent());
    }, 0);
    return () => clearTimeout(t);
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
        .catch(reportQuietly)
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  function go(r) {
    if (!r) return;
    if (r.pickStageFor) {
      setMoving(r.pickStageFor);
      setActive(0);
      inputRef.current?.focus();
      return;
    }
    if (r.toStage) {
      moveTo(moving, r.toStage);
      return;
    }
    close();
    router.push(r.href);
  }

  async function moveTo(candidate, stage) {
    try {
      await updateCandidateStage(candidate.id, stage);
      setMoved({ ok: true, text: `Moved ${candidate.title} to ${STAGE_LABELS[stage]}` });
      if (stage === "Placed") celebratePlacement({ candidateId: candidate.id, name: candidate.title });
      setTimeout(close, 1100);
    } catch {
      setMoved({ ok: false, text: `Couldn't move ${candidate.title}. Try again from their profile.` });
    }
  }

  // While typing: the matching actions (with "Screen a CV for" the first
  // job found), then what the search found. Before typing: the recently
  // viewed, then the everyday actions.
  const term = q.trim();
  const actions = matchCommands(term, term ? 4 : 3).map((c) => ({ kind: "action", id: c.id, title: c.title, subtitle: c.hint, href: c.href }));
  const firstJob = term.length >= 2 ? results.find((r) => r.kind === "job") : null;
  if (firstJob) actions.unshift({ kind: "action", id: `screen-${firstJob.id}`, title: `Screen a CV for ${firstJob.title}`, subtitle: "Opens Screen a CV with this job picked", href: `/analyse?jobId=${firstJob.id}` });
  const firstCandidate = term.length >= 2 ? results.find((r) => r.kind === "candidate") : null;
  if (firstCandidate) {
    actions.push({
      kind: "action",
      id: `move-${firstCandidate.id}`,
      title: `Move ${firstCandidate.title} to…`,
      subtitle: "Pick a stage",
      pickStageFor: firstCandidate,
    });
  }
  const found = term ? results : recent.map((r) => ({ ...r, subtitle: "Recently viewed" }));
  const stages = moving
    ? [...FUNNEL_ORDER, "Rejected"].map((st) => ({ kind: "action", id: `stage-${st}`, title: STAGE_LABELS[st], subtitle: `Move ${moving.title} here`, toStage: st }))
    : null;
  const shown = moved ? [] : stages ?? (term ? [...actions, ...(term.length >= 2 ? found : [])] : [...found, ...actions]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search (Ctrl+K)"
        title="Search candidates, jobs and clients (Ctrl+K)"
        className="flex items-center gap-2 h-8 px-2.5 rounded-full text-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] border border-[var(--border)] text-[var(--ink-soft)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden lg:inline text-12 px-1 rounded bg-[var(--mist)]">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4" style={{ background: "rgba(19,32,27,0.4)" }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div role="dialog" aria-modal="true" aria-label="Search" className="w-full max-w-[560px] rounded-2xl bg-[var(--bg)] shadow-xl overflow-hidden">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (moving) setMoving(null);
                  else close();
                }
                else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, shown.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") go(shown[active]);
              }}
              placeholder="Search, or type a command…"
              aria-label="Search or run a command"
              role="combobox"
              aria-expanded={shown.length > 0}
              aria-controls="search-results"
              aria-activedescendant={shown[active] ? `search-${shown[active].kind}-${shown[active].id}` : undefined}
              className="w-full px-5 py-4 text-15 outline-none focus-visible:shadow-[inset_0_-2px_0_var(--forest)] border-b border-b-[var(--border)] text-[var(--ink)]"
            />
            {moving && !moved && <p className="px-5 pt-3 text-13 font-medium text-[var(--ink-soft)]">Move {moving.title} to… <span className="text-[var(--ink-faint)]">(Esc to go back)</span></p>}
            {moved && (
              <p role="status" className={`px-5 py-4 text-14 font-medium ${moved.ok ? "text-[var(--forest)]" : "text-[var(--score-low)]"}`}>
                {moved.text}
              </p>
            )}
            <ul id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
              {q.trim().length >= 2 && !loading && shown.length === 0 && <li className="px-5 py-4 text-14 text-[var(--ink-faint)]">Nothing found for “{q.trim()}”.</li>}
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
                  className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer ${i === active ? "bg-[var(--mist)]" : "bg-transparent"}`}
                >
                  <span className={`text-12 font-medium w-16 shrink-0 ${r.kind === "action" ? "text-[var(--forest)]" : "text-[var(--ink-faint)]"}`}>{KIND_LABEL[r.kind]}</span>
                  <span className="min-w-0">
                    <span className="block text-14 font-semibold truncate text-[var(--ink)]">{r.title}</span>
                    {r.subtitle && <span className="block text-13 truncate text-[var(--ink-soft)]">{r.subtitle}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="px-5 py-2.5 border-t border-t-[var(--border-soft)] text-12 text-[var(--ink-faint)]">↑↓ to move · Enter to open · ? for shortcuts</p>
          </div>
        </div>
      )}
    </>
  );
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
      .catch(reportQuietly);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // A connected Gmail / Outlook syncs in the background while the dashboard
  // is open (the server skips it if it synced in the last 15 minutes).
  useEffect(() => {
    const sync = () =>
      fetch("/api/integrations/connections", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto" }),
      }).catch(reportQuietly);
    sync();
    const t = setInterval(sync, 15 * 60_000);
    return () => clearInterval(t);
  }, []);

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
    await fetch("/api/notifications", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(reportQuietly);
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
        className="relative w-8 h-8 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] border border-[var(--border)] text-[var(--ink-soft)]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {state.unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-12 font-bold flex items-center justify-center text-[var(--on-accent)] bg-[var(--score-low)]">
            {state.unread > 9 ? "9+" : state.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-80 rounded-xl bg-[var(--bg)] overflow-hidden" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 24px -12px rgba(19,32,27,0.25)" }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-b-[var(--border)]">
            <p className="text-13 font-semibold text-[var(--ink)]">Notifications</p>
            {state.unread > 0 && (
              <button
                type="button"
                className="text-12 font-semibold text-[var(--forest)]"
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
            {state.list.length === 0 && <li className="px-4 py-6 text-13 text-center text-[var(--ink-faint)]">Nothing yet. Signatures, bookings, applications and replies show up here.</li>}
            {state.list.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openItem(n)} className="w-full text-left px-4 py-2.5 flex gap-2 hover:bg-[var(--mist)]">
                  <span aria-hidden="true" className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-[var(--forest)]"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-14 text-[var(--ink)] ${n.read ? "font-normal" : "font-semibold"}`}>{n.title}</span>
                    {n.body && <span className="block text-13 truncate text-[var(--ink-soft)]">{n.body}</span>}
                  </span>
                  <span className="text-12 shrink-0 text-[var(--ink-faint)]">{timeAgo(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
