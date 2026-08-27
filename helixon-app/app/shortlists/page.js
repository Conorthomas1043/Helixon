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
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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
              style={{ color: label === "History" ? "var(--forest)" : "#5a7a6a" }}>{label}</a>
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

const BANDS = [
  { id: "all",    label: "All scores" },
  { id: "strong", label: "80–100 · Strong" },
  { id: "mid",    label: "60–79 · Consider" },
  { id: "low",    label: "Below 60" },
];
const SORTS = [
  { id: "recent",  label: "Most recent" },
  { id: "score",   label: "Highest score" },
  { id: "name",    label: "CV name (A–Z)" },
];

export default function HistoryPage() {
  const { toasts, toast } = useToast();
  const [history, setHistory]       = useState(undefined); // undefined = loading
  const [shortlistIds, setShortlistIds] = useState(new Set());
  const [search, setSearch]         = useState("");
  const [band, setBand]             = useState("all");
  const [sort, setSort]             = useState("recent");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    setHistory(ls("analysisHistory", []));
    const shortlist = ls("shortlist", []);
    setShortlistIds(new Set(shortlist.map((s) => s.entryId)));
  }, []);

  function refresh() {
    setHistory(ls("analysisHistory", []));
  }

  function toggleShortlist(entry) {
    const shortlist = ls("shortlist", []);
    const exists = shortlist.some((s) => s.entryId === entry.id);
    let next;
    if (exists) {
      next = shortlist.filter((s) => s.entryId !== entry.id);
      toast("Removed from shortlist");
    } else {
      next = [{
        entryId: entry.id,
        cvName: entry.cvName,
        analysisName: entry.analysisName || null,
        matchScore: entry.matchScore,
        recommendation: entry.recommendation,
        summary: entry.summary,
        addedAt: new Date().toISOString(),
      }, ...shortlist];
      toast("Added to shortlist ★");
    }
    lsSet("shortlist", next);
    setShortlistIds(new Set(next.map((s) => s.entryId)));
  }

  function deleteEntry(id) {
    const next = ls("analysisHistory", []).filter((h) => h.id !== id);
    lsSet("analysisHistory", next);
    // Keep shortlist entries even if the source analysis is deleted from
    // history - a recruiter may still want the shortlist record - but drop
    // the entryId link since it no longer resolves to a live analysis.
    setConfirmDeleteId(null);
    refresh();
    toast("Analysis deleted");
  }

  async function copySummary(entry) {
    const lines = [
      `Candidate: ${entry.cvName}`,
      `Match score: ${entry.matchScore} - ${entry.recommendation}`,
      entry.summary ? `\nSummary: ${entry.summary}` : "",
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(lines);
    toast("Summary copied to clipboard");
  }

  const filtered = useMemo(() => {
    if (!history) return [];
    let rows = [...history];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((h) =>
        (h.cvName || "").toLowerCase().includes(q) ||
        (h.analysisName || "").toLowerCase().includes(q) ||
        (h.summary || "").toLowerCase().includes(q)
      );
    }
    if (band !== "all") {
      rows = rows.filter((h) => {
        const s = h.matchScore || 0;
        if (band === "strong") return s >= 80;
        if (band === "mid") return s >= 60 && s < 80;
        return s < 60;
      });
    }
    if (sort === "recent") rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (sort === "score") rows.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    if (sort === "name") rows.sort((a, b) => (a.cvName || "").localeCompare(b.cvName || ""));
    return rows;
  }, [history, search, band, sort]);

  const stats = useMemo(() => {
    if (!history || history.length === 0) return null;
    const total = history.length;
    const avg = Math.round(history.reduce((s, h) => s + (h.matchScore || 0), 0) / total);
    const strong = history.filter((h) => (h.matchScore || 0) >= 80).length;
    return { total, avg, strong };
  }, [history]);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <Toast toasts={toasts} />
      <Nav />

      <div className="max-w-[1100px] mx-auto px-4 py-10">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              Analysis history
            </h1>
            <p className="text-xs" style={{ color: "#5a7a6a" }}>Every CV you've scored, searchable and filterable.</p>
          </div>
          <a href="/" className="text-xs font-semibold px-4 py-2.5 rounded-[10px] text-white shrink-0" style={{ background: "var(--forest)" }}>
            + New analysis
          </a>
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Total analyses", val: stats.total },
              { label: "Average score", val: stats.avg },
              { label: "Strong matches", val: stats.strong },
            ].map((m) => (
              <div key={m.label} className="card p-4" style={{ background: "white", border: "1px solid var(--border)", borderRadius: 14 }}>
                <p className="text-[10px] uppercase tracking-wide font-medium mb-1" style={{ color: "#8aaa9a" }}>{m.label}</p>
                <p className="text-xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#13201b" }}>{m.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
          <div className="relative flex-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8aaa9a" strokeWidth="2" strokeLinecap="round"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by CV name or analysis name…"
              className="w-full text-xs pl-9 pr-4 py-2.5 rounded-[10px] outline-none transition-all"
              style={{ border: "1px solid var(--border)", background: "white", color: "#13201b" }}
              onFocus={(e) => (e.target.style.boxShadow = "0 0 0 3px rgba(11,110,79,0.12)")}
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
          </div>
          <select value={band} onChange={(e) => setBand(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-[10px] outline-none"
            style={{ border: "1px solid var(--border)", background: "white", color: "#13201b" }}>
            {BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-[10px] outline-none"
            style={{ border: "1px solid var(--border)", background: "white", color: "#13201b" }}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* List */}
        {history === undefined && (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-[14px] animate-pulse" style={{ background: "white", border: "1px solid var(--border)" }} />)}
          </div>
        )}

        {history && history.length === 0 && (
          <div className="rounded-[16px] p-12 text-center" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>No analyses yet</p>
            <p className="text-xs mb-6" style={{ color: "#5a7a6a" }}>Run your first CV scan to see it show up here.</p>
            <a href="/" className="inline-block text-xs font-semibold px-5 py-2.5 rounded-[10px] text-white" style={{ background: "var(--forest)" }}>Score a candidate</a>
          </div>
        )}

        {history && history.length > 0 && filtered.length === 0 && (
          <div className="rounded-[16px] p-10 text-center" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "#5a7a6a" }}>No analyses match your filters.</p>
          </div>
        )}

        <div className="space-y-2.5">
          {filtered.map((h) => {
            const shortlisted = shortlistIds.has(h.id);
            return (
              <div key={h.id} className="rounded-[14px] p-4 sm:p-5 flex items-center gap-4"
                style={{ background: "white", border: "1px solid var(--border)" }}>

                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
                  style={{ background: scoreBg(h.matchScore || 0), color: scoreColor(h.matchScore || 0), fontFamily: "var(--font-mono)" }}>
                  {h.matchScore ?? "-"}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: "#13201b" }}>{h.cvName}</p>
                    {h.rerun && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--mist)", color: "#8aaa9a" }}>Re-run</span>
                    )}
                  </div>
                  <p className="text-[11px] truncate" style={{ color: "#5a7a6a" }}>
                    {h.analysisName ? `${h.analysisName} · ` : ""}{h.recommendation} · {formatDate(h.timestamp)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => toggleShortlist(h)} aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors text-sm"
                    style={{ background: shortlisted ? "var(--mint)" : "var(--mist)", color: shortlisted ? "var(--forest)" : "#b0c4ba" }}>
                    {shortlisted ? "★" : "☆"}
                  </button>
                  <button type="button" onClick={() => copySummary(h)} aria-label="Copy summary"
                    className="hidden sm:flex w-8 h-8 rounded-[8px] items-center justify-center transition-colors text-xs"
                    style={{ background: "var(--mist)", color: "#5a7a6a" }}>
                    ⧉
                  </button>
                  {confirmDeleteId === h.id ? (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => deleteEntry(h.id)} className="text-[10px] font-semibold px-2 py-1.5 rounded-[8px]" style={{ background: "#fef2f2", color: "#dc2626" }}>Confirm</button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-[10px] px-2 py-1.5" style={{ color: "#8aaa9a" }}>✕</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDeleteId(h.id)} aria-label="Delete analysis"
                      className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors text-xs"
                      style={{ background: "var(--mist)", color: "#b0c4ba" }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}