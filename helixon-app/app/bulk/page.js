"use client";
import { useState } from "react";
// MOCK DATA — swap this for the real API call when Conor is ready
const MOCK_RESULTS = [
  { fileName: "jane_smith.pdf", name: "Jane Smith", match_score: 91,
    recommendation: "Strong match", strengths: ["5 years React", "SaaS background"],
    weaknesses: ["No TypeScript listed"], summary: "Strong frontend fit." },
  { fileName: "tom_lee.pdf", name: "Tom Lee", match_score: 74,
    recommendation: "Worth reviewing", strengths: ["Solid JavaScript", "Good CSS"],
    weaknesses: ["Limited React depth", "No production SaaS"],
    summary: "Solid candidate worth a call." },
  { fileName: "ava_khan.pdf", name: "Ava Khan", match_score: 52,
    recommendation: "Worth reviewing", strengths: ["Frontend experience"],
    weaknesses: ["Junior level", "No relevant industry"], summary: "Borderline fit." },
  { fileName: "sam_ortiz.pdf", name: "Sam Ortiz", match_score: 31,
    recommendation: "Likely not a fit", strengths: ["Enthusiasm"],
    weaknesses: ["Too junior", "Wrong tech stack"], summary: "Not ready for this role." },
];
export default function BulkUpload() {
  const [files, setFiles] = useState([]);
  const [jobText, setJobText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  function addFiles(e) {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = ""; // reset so same file can be re-added
  }
  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }
  async function handleAnalyse() {
    if (files.length === 0 || !jobText.trim()) {
      alert("Please add at least one CV and paste a job description.");
      return;
    }
    setLoading(true);
    setResults(null);
    setError(null);
    // ===== SWAP THIS BLOCK WHEN CONOR'S BACKEND IS READY =====
    // For now: simulate a 2-second delay and use mock data
    await new Promise(r => setTimeout(r, 2000));
    setResults(MOCK_RESULTS);
    setLoading(false);
    // ===== REAL FETCH (uncomment when Conor ships /api/run-bulk) =====
    // try {
    //   const fd = new FormData();
    //   files.forEach(f => fd.append("cvs", f));
    //   fd.append("jobText", jobText);
    //   fd.append("agencyId", "d6207b77-821d-4b93-8906-a9bfbcfd0fae");
    //   const res = await fetch("/api/run-bulk", { method: "POST", body: fd });
    //   const data = await res.json();
    //   if (data.ok) setResults(data.results);
    //   else setError(data.error);
    // } catch(e) {
    //   setError("Network error. Please try again.");
    // } finally {
    //   setLoading(false);
    // }
  }
  function exportCSV() {
    if (!results) return;
    const header = "Name,Score,Recommendation,Top Strength\n";
    const rows = results.map(r =>
      `"${r.name}",${r.match_score},"${r.recommendation}","${r.strengths[0] || ""}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "helixon-shortlist.csv"; a.click();
  }
  function scoreColour(score) {
    if (score >= 80) return "text-emerald-700 font-bold";
    if (score >= 60) return "text-amber-600 font-bold";
    return "text-red-600 font-bold";
  }
  function badgeColour(rec) {
    if (rec === "Strong match") return "bg-emerald-100 text-emerald-800";
    if (rec === "Worth reviewing") return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  }
  return (
    <main className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <a href="/" className="text-sm text-stone-500 hover:text-stone-800">
            ‹ Back to single CV
          </a>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 mb-6">
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Bulk Screening</h1>
          <p className="text-stone-500 mb-6">Upload multiple CVs and rank them all at once.</p>
          {/* File picker */}
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Candidate CVs (PDF — select multiple)
          </label>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={addFiles}
            className="block w-full text-sm mb-2 file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0 file:bg-stone-900 file:text-white"
          />
          {/* Selected files list */}
          {files.length > 0 && (
            <div className="mb-6 space-y-1">
              {files.map((f, i) => (
                <div key={i}
                  className="flex items-center justify-between bg-stone-50
                    border border-stone-200 rounded-lg px-3 py-2 text-sm">
                  <span className="text-stone-700 truncate">{f.name}</span>
                  <button onClick={() => removeFile(i)}
                    className="text-stone-400 hover:text-red-500 ml-2 shrink-0">
                    5
                  </button>
                </div>
              ))}
              <p className="text-xs text-stone-400 mt-1">
                {files.length} CV{files.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          )}
          {/* Job description */}
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Job description
          </label>
          <textarea
            value={jobText}
            onChange={e => setJobText(e.target.value)}
            placeholder="Paste the full job description here..."
            className="w-full h-36 border border-stone-300 rounded-lg p-3 text-sm mb-6"
          />
          <button
            onClick={handleAnalyse}
            disabled={loading}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white
              font-medium py-3 rounded-lg disabled:opacity-50"
          >
            {loading
              ? `Scoring ${files.length} CVs... (this takes a moment)`
              : `Score ${files.length || "all"} CVs`}
          </button>
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </div>
        {/* Results */}
        {results && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-stone-900">
                Ranked Shortlist — {results.length} candidates
              </h2>
              <button
                onClick={exportCSV}
                className="text-sm border border-stone-300 text-stone-700
                  px-4 py-2 rounded-lg hover:bg-stone-50"
              >
                Export CSV
              </button>
            </div>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i}
                  className="border border-stone-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                    className="w-full flex items-center gap-4 p-4 text-left
                      hover:bg-stone-50"
                  >
                    <span className="text-stone-400 font-mono text-sm w-6">
                      {i + 1}
                    </span>
                    <span className={`text-2xl w-12 text-right ${scoreColour(r.match_score)}`}>
                      {r.match_score}
                    </span>
                    <span className="font-medium text-stone-800 flex-1">
                      {r.name || r.fileName}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${badgeColour(r.recommendation)}`}>
                      {r.recommendation}
                    </span>
                    <span className="text-stone-400 text-sm">
                      {expandedRow === i ? "s" : "t"}
                    </span>
                  </button>
                  {expandedRow === i && (
                    <div className="px-4 pb-4 border-t border-stone-100 pt-3">
                      <p className="text-sm italic text-stone-600 mb-3">{r.summary}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-stone-500 mb-1">
                            STRENGTHS
                          </p>
                          <ul className="text-sm text-stone-700 space-y-1">
                            {r.strengths.map((s, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="text-emerald-600">3</span>{s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-stone-500 mb-1">
                            WEAKNESSES
                          </p>
                          <ul className="text-sm text-stone-700 space-y-1">
                            {r.weaknesses.map((w, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="text-red-400">7</span>{w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}