"use client";
import { useState, useEffect } from "react";

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("analysisHistory") || "[]");
    setHistory(stored);
  }, []);

  function clearHistory() {
    if (confirm("Clear all history? This can't be undone.")) {
      localStorage.removeItem("analysisHistory");
      setHistory([]);
    }
  }

  function deleteEntry(id) {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    localStorage.setItem("analysisHistory", JSON.stringify(updated));
  }

  const FILTERS = ["All", "Strong match", "Worth reviewing", "Likely not a fit"];

  const filtered = history.filter((h) => {
    const matchesSearch =
      h.cvName.toLowerCase().includes(search.toLowerCase()) ||
      h.summary?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || h.recommendation === filter;
    return matchesSearch && matchesFilter;
  });

  function recommendationStyle(rec) {
    if (rec === "Strong match") return "bg-emerald-100 text-emerald-800";
    if (rec === "Worth reviewing") return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  }

  function scoreColour(score) {
    if (score >= 80) return "#0b6e4f";
    if (score >= 60) return "#d97706";
    return "#b00000";
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) +
      " · " +
      d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }

  return (
    <main className="min-h-screen bg-stone-50">

      <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-emerald-700 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="text-base font-bold text-stone-900">Helixon</span>
          <span className="text-xs text-stone-400 hidden sm:inline border border-stone-200 px-2 py-0.5 rounded-full">
            AI Recruitment OS
          </span>
        </div>
        <div className="flex items-center gap-1">
          <a href="/history" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg bg-stone-100 font-medium hidden sm:block">History</a>
          <a href="/bulk" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100 hidden sm:block">Bulk Upload</a>
          <a href="/landing" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100 hidden sm:block">About</a>
          <a href="/pricing" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100 hidden sm:block">Pricing</a>
          <a href="/login" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100">Login</a>
          <a href="/signup" className="text-sm bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-lg font-medium ml-1">Sign up</a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Analysis history</h1>
            <p className="text-stone-500 text-sm mt-0.5">
              {history.length} candidate{history.length !== 1 ? "s" : ""} scored · stored locally in your browser
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="text-xs border border-stone-300 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-50">+ New analysis</a>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50">
                Clear all
              </button>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4 space-y-3">
            <input
              type="text"
              placeholder="Search by CV name or summary..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <div className="flex gap-2 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    filter === f ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {f === "All" ? `All (${history.length})` : `${f} (${history.filter((h) => h.recommendation === f).length})`}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.length === 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-stone-500 text-sm font-medium">No analyses yet</p>
            <p className="text-stone-400 text-xs mt-1 mb-5">Score your first candidate to see results here.</p>
            <a href="/" className="inline-block bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">Score a candidate</a>
          </div>
        )}

        {history.length > 0 && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
            <div className="text-3xl mb-3">🔍</div>
            <p className="text-stone-500 text-sm">No results match your search.</p>
            <button onClick={() => { setSearch(""); setFilter("All"); }} className="mt-3 text-xs text-emerald-700 hover:underline">
              Clear filters
            </button>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex items-start justify-between gap-4">

                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-sm"
                  style={{ borderColor: scoreColour(entry.matchScore), color: scoreColour(entry.matchScore) }}
                >
                  {entry.matchScore}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-stone-900 truncate">{entry.cvName}</p>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${recommendationStyle(entry.recommendation)}`}>
                      {entry.recommendation}
                    </span>
                  </div>
                  {entry.summary && (
                    <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">{entry.summary}</p>
                  )}
                  <p className="text-xs text-stone-400 mt-1.5">{formatDate(entry.timestamp)}</p>
                </div>

                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-stone-300 hover:text-red-400 transition-colors shrink-0 text-xl leading-none"
                  title="Delete"
                >
                  &times;
                </button>

              </div>
            </div>
          ))}
        </div>

        {history.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-stone-200 p-5 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-stone-900">{history.length}</p>
              <p className="text-xs text-stone-400 mt-0.5">Total scored</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">
                {Math.round(history.reduce((a, b) => a + b.matchScore, 0) / history.length)}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">Avg score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">
                {history.filter((h) => h.recommendation === "Strong match").length}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">Strong matches</p>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}