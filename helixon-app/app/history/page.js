"use client";
import { useEffect, useMemo, useState } from "react";

// ── localStorage helpers (mirrors app/page.js) ──────────────────────────
function ls(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, val) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { }
}

function scoreColor(score) {
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return "#b45309";
  return "#dc2626";
}
function scoreBg(score) {
  if (score >= 80) return "var(--mint)";
  if (score >= 60) return "#fef3e8";
  return "#fef2f2";
}
function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// ── Toast ────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="px-4 py-2.5 rounded-[10px] text-xs font-semibold shadow-lg text-white" style={{ background: t.type === "error" ? "#dc2626" : "#13201b" }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
function useToast() {
  const [toasts, setToasts] = useState([]);
  function toast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }
  return { toasts, toast };
}

// ── Nav (matches app/page.js) ────────────────────────────────────────────
function Nav() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
        </a>
        <div className="hidden sm:flex items-center gap-0.5">
          {[["History", "/history"], ["Shortlists", "/shortlists"], ["Bulk Upload", "/bulk"], ["Pricing", "/landing#pricing"]].map(([label, href]) => (
            <a key={label} href={href} className="text-xs px-2.5 py-1.5 rounded-[8px] transition-colors font-medium"
              style={{ color: label === "Shortlists" ? "var(--forest)" : "#5a7a6a" }}>{label}</a>
          ))}
        </div>
        <button type="button" onClick={() => setMobileNavOpen(v => !v)} aria-expanded={mobileNavOpen} aria-label="Open menu"
          className="sm:hidden w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ color: "#13201b" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
          </svg>
        </button>
      </div>
      {mobileNavOpen && (
        <div className="sm:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
          {[["History", "/history"], ["Shortlists", "/shortlists"], ["Bulk Upload", "/bulk"], ["Pricing", "/landing#pricing"]].map(([label, href]) => (
            <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>{label}</a>
          ))}
        </div>
      )}
    </nav>
  );
}

export default function ShortlistsPage() {
  const { toasts, toast } = useToast();
  const [shortlist, setShortlist] = useState(undefined); // undefined = loading
  const [search, setSearch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setShortlist(ls("shortlist", []));
  }, []);

  function remove(entryId) {
    const next = ls("shortlist", []).filter((s) => s.entryId !== entryId);
    lsSet("shortlist", next);
    setShortlist(next);
    toast("Removed from shortlist");
  }

  function clearAll() {
    lsSet("shortlist", []);
    setShortlist([]);
    setConfirmClear(false);
    toast("Shortlist cleared");
  }

  async function copySummary(entry) {
    const lines = [
      `Candidate: ${entry.cvName}`,
      `Match score: ${entry.matchScore} — ${entry.recommendation}`,
      entry.summary ? `\nSummary: ${entry.summary}` : "",
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(lines);
    toast("Summary copied to clipboard");
  }

  async function copyAllForClient() {
    const list = filtered.map((e, i) =>
      `${i + 1}. ${e.cvName} — ${e.matchScore} (${e.recommendation})`
    ).join("\n");
    await navigator.clipboard.writeText(`Shortlisted candidates:\n\n${list}`);
    toast("Shortlist copied to clipboard");
  }

  const filtered = useMemo(() => {
    if (!shortlist) return [];
    let rows = [...shortlist];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((s) =>
        (s.cvName || "").toLowerCase().includes(q) ||
        (s.analysisName || "").toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    return rows;
  }, [shortlist, search]);

  const avgScore = useMemo(() => {
    if (!shortlist || shortlist.length === 0) return null;
    return Math.round(shortlist.reduce((s, e) => s + (e.matchScore || 0), 0) / shortlist.length);
  }, [shortlist]);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <Toast toasts={toasts} />
      <Nav />

      <div className="max-w-[1100px] mx-auto px-4 py-10">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              Shortlists
            </h1>
            <p className="text-xs" style={{ color: "#5a7a6a" }}>
              Candidates you've starred from History{shortlist && shortlist.length > 0 ? ` — ${shortlist.length} saved` : ""}.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {shortlist && shortlist.length > 0 && (
              <button type="button" onClick={copyAllForClient}
                className="text-xs font-semibold px-4 py-2.5 rounded-[10px] transition-colors"
                style={{ border: "1px solid var(--border)", color: "#5a7a6a" }}>
                Copy list for client
              </button>
            )}
            <a href="/history" className="text-xs font-semibold px-4 py-2.5 rounded-[10px] text-white" style={{ background: "var(--forest)" }}>
              Go to History
            </a>
          </div>
        </div>

        {avgScore !== null && (
          <div className="rounded-[14px] p-4 sm:p-5 mb-6 flex items-center justify-between"
            style={{ background: "white", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-wide font-medium mb-1" style={{ color: "#8aaa9a" }}>Shortlisted</p>
                <p className="text-xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#13201b" }}>{shortlist.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide font-medium mb-1" style={{ color: "#8aaa9a" }}>Average score</p>
                <p className="text-xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>{avgScore}</p>
              </div>
            </div>
            {!confirmClear ? (
              <button type="button" onClick={() => setConfirmClear(true)} className="text-[11px] font-medium" style={{ color: "#b0c4ba" }}>
                Clear shortlist
              </button>
            ) : (
              <span className="flex items-center gap-2 text-[11px]">
                <span style={{ color: "#5a7a6a" }}>Remove all?</span>
                <button type="button" onClick={clearAll} className="font-semibold" style={{ color: "#dc2626" }}>Yes</button>
                <button type="button" onClick={() => setConfirmClear(false)} style={{ color: "#5a7a6a" }}>Cancel</button>
              </span>
            )}
          </div>
        )}

        {shortlist && shortlist.length > 0 && (
          <div className="relative mb-6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8aaa9a" strokeWidth="2" strokeLinecap="round"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shortlisted candidates…"
              className="w-full text-xs pl-9 pr-4 py-2.5 rounded-[10px] outline-none transition-all"
              style={{ border: "1px solid var(--border)", background: "white", color: "#13201b" }}
              onFocus={(e) => (e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)")}
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
          </div>
        )}

        {shortlist === undefined && (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-[14px] animate-pulse" style={{ background: "white", border: "1px solid var(--border)" }} />)}
          </div>
        )}

        {shortlist && shortlist.length === 0 && (
          <div className="rounded-[16px] p-12 text-center" style={{ background: "white", border: "1px solid var(--border)" }}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-4 text-lg" style={{ background: "var(--mint)", color: "var(--forest)" }}>★</div>
            <p className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>Nothing shortlisted yet</p>
            <p className="text-xs mb-6" style={{ color: "#5a7a6a" }}>Star a candidate from History to save them here.</p>
            <a href="/history" className="inline-block text-xs font-semibold px-5 py-2.5 rounded-[10px] text-white" style={{ background: "var(--forest)" }}>View History</a>
          </div>
        )}

        {shortlist && shortlist.length > 0 && filtered.length === 0 && (
          <div className="rounded-[16px] p-10 text-center" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "#5a7a6a" }}>No shortlisted candidates match your search.</p>
          </div>
        )}

        <div className="space-y-2.5">
          {filtered.map((e) => (
            <div key={e.entryId} className="rounded-[14px] p-4 sm:p-5 flex items-center gap-4"
              style={{ background: "white", border: "1px solid var(--border)" }}>

              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
                style={{ background: scoreBg(e.matchScore || 0), color: scoreColor(e.matchScore || 0), fontFamily: "var(--font-mono)" }}>
                {e.matchScore ?? "—"}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: "#13201b" }}>{e.cvName}</p>
                <p className="text-[11px] truncate" style={{ color: "#5a7a6a" }}>
                  {e.analysisName ? `${e.analysisName} · ` : ""}{e.recommendation} · Added {formatDate(e.addedAt)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => copySummary(e)} aria-label="Copy summary"
                  className="hidden sm:flex w-8 h-8 rounded-[8px] items-center justify-center transition-colors text-xs"
                  style={{ background: "var(--mist)", color: "#5a7a6a" }}>
                  ⧉
                </button>
                <button type="button" onClick={() => remove(e.entryId)} aria-label="Remove from shortlist"
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors text-sm"
                  style={{ background: "var(--mint)", color: "var(--forest)" }}>
                  ★
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}