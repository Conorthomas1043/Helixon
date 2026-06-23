"use client";
import { useState } from "react";

export default function BulkPage() {
  const [jobText, setJobText] = useState("");
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
    if (dropped.length) {
      setFiles(dropped);
      setError(null);
    } else {
      setError("Please drop PDF files only.");
    }
  }

  async function handleAnalyse() {
    if (!files.length || !jobText.trim()) {
      setError("Please add at least one CV and paste a job description.");
      return;
    }
    setLoading(true);
    setResults([]);
    setError(null);
    setProgress(0);

    const form = new FormData();
    files.forEach((f) => form.append("cvs", f));
    form.append("jobText", jobText);
    form.append("agencyId", "d6207b77-821d-4b93-8906-a9bfbcfd0fae");

    try {
      const res = await fetch("/api/bulk", { method: "POST", body: form });
      const data = await res.json();
      if (data.ok) {
        setResults(data.results);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch (e) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function ScoreBadge({ score }) {
    let colour = "bg-red-100 text-red-700";
    if (score >= 80) colour = "bg-emerald-100 text-emerald-800";
    else if (score >= 60) colour = "bg-amber-100 text-amber-800";
    return (
      <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${colour}`}>
        {score}/100
      </span>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50">

      {/* Nav — identical to home */}
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
          <a href="/history" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100 hidden sm:block">History</a>
          <a href="/bulk" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg bg-stone-100 font-medium hidden sm:block">Bulk Upload</a>
          <a href="/landing" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100 hidden sm:block">About</a>
          <a href="/pricing" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100 hidden sm:block">Pricing</a>
          <a href="/login" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100">Login</a>
          <a href="/signup" className="text-sm bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-lg font-medium ml-1">
            Sign up
          </a>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* Left panel — inputs */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-stone-900">Bulk CV scoring</h1>
                <p className="text-stone-500 text-sm mt-0.5">
                  Upload multiple CVs and score them all against one job spec.
                </p>
              </div>
              <a href="/" className="text-xs border border-stone-300 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-50 shrink-0 ml-3">
                Single CV
              </a>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("bulk-input").click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center mb-5 transition-colors cursor-pointer ${
                dragOver
                  ? "border-emerald-500 bg-emerald-50"
                  : files.length
                  ? "border-emerald-400 bg-emerald-50/50"
                  : "border-stone-300 hover:border-stone-400 bg-stone-50"
              }`}
            >
              <input
                id="bulk-input"
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  setFiles(Array.from(e.target.files));
                  setError(null);
                }}
              />
              {files.length ? (
                <div>
                  <div className="text-2xl mb-1">📄</div>
                  <p className="text-sm font-medium text-emerald-700">
                    {files.length} PDF{files.length > 1 ? "s" : ""} selected
                  </p>
                  <ul className="mt-2 space-y-0.5 max-h-28 overflow-y-auto">
                    {files.map((f, i) => (
                      <li key={i} className="text-xs text-stone-500 truncate px-4">{f.name}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-stone-400 mt-2">Click to change</p>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-1">📂</div>
                  <p className="text-sm font-medium text-stone-700">Drop CVs here or click to upload</p>
                  <p className="text-xs text-stone-400 mt-1">PDF only · multiple files supported</p>
                </div>
              )}
            </div>

            <label className="block text-sm font-medium text-stone-700 mb-2">Job description</label>
            <textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={6}
              className="w-full border border-stone-300 rounded-xl p-3 text-sm mb-5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />

            {/* Loading stages */}
            {loading && (
              <div className="mb-4 bg-stone-50 rounded-xl p-4">
                <div className="flex items-center gap-3 py-1.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-700 animate-pulse shrink-0" />
                  <span className="text-sm text-stone-900 font-medium">
                    Scoring {files.length} CV{files.length > 1 ? "s" : ""}...
                  </span>
                </div>
                <div className="mt-3 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full animate-pulse w-2/3" />
                </div>
              </div>
            )}

            <button
              onClick={handleAnalyse}
              disabled={loading}
              className={`w-full font-medium py-3 rounded-xl transition-all text-sm ${
                loading
                  ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                  : "bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm hover:shadow-md"
              }`}
            >
              {loading
                ? `Scoring ${files.length} CV${files.length > 1 ? "s" : ""}...`
                : "Score all CVs"}
            </button>

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Right panel — results */}
          <div>
            {!results.length && !loading && (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 flex flex-col items-center justify-center text-center min-h-64">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-stone-500 text-sm">Ranked results will appear here.</p>
                <p className="text-stone-400 text-xs mt-1">Upload CVs and a job description to start.</p>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 flex flex-col items-center justify-center text-center min-h-64">
                <div className="w-20 h-20 rounded-full border-4 border-stone-200 border-t-emerald-600 animate-spin mb-4" />
                <p className="text-stone-500 text-sm">Analysing {files.length} candidate{files.length > 1 ? "s" : ""}...</p>
                <p className="text-stone-400 text-xs mt-1">This may take a moment for large batches.</p>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1 px-1">
                  <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
                    Results · {results.length} candidate{results.length > 1 ? "s" : ""}
                  </h2>
                  <button
                    onClick={() => { setResults([]); setFiles([]); setJobText(""); }}
                    className="text-xs text-stone-400 hover:text-stone-600"
                  >
                    ← Start over
                  </button>
                </div>

                {results.map((r, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{r.name || r.fileName}</p>
                        <p className="text-xs text-stone-400 truncate max-w-48">{r.fileName}</p>
                      </div>
                      <ScoreBadge score={r.match_score} />
                    </div>

                    <div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        r.recommendation === "Strong match"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.recommendation === "Worth reviewing"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        {r.recommendation}
                      </span>
                    </div>

                    <p className="text-xs text-stone-500 leading-relaxed">{r.summary}</p>

                    {r.strengths?.length > 0 && (
                      <ul className="space-y-1">
                        {r.strengths.slice(0, 2).map((s, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-stone-600">
                            <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>{s}
                          </li>
                        ))}
                      </ul>
                    )}

                    {r.weaknesses?.length > 0 && (
                      <ul className="space-y-1">
                        {r.weaknesses.slice(0, 1).map((w, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-stone-600">
                            <span className="text-red-400 font-bold shrink-0 mt-0.5">✗</span>{w}
                          </li>
                        ))}
                      </ul>
                    )}

                    {r.error && (
                      <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                        ⚠ Could not process this file
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}