"use client";
import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [jobText, setJobText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  async function handleAnalyse() {
    if (!file || !jobText.trim()) {
      alert("Please add a CV and paste a job description.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    setFeedback(null);
    setFeedbackSent(false);

    const fd = new FormData();
    fd.append("cv", file);
    fd.append("jobText", jobText);
    fd.append("agencyId", "d6207b77-821d-4b93-8906-a9bfbcfd0fae");

    try {
      const res = await fetch("/api/run", { method: "POST", body: fd });
      const data = await res.json();

      if (data.ok) {
        setResult(data.result);
        const entry = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          cvName: file.name,
          matchScore: data.result.match_score,
          recommendation: data.result.recommendation,
          summary: data.result.summary,
        };
        const history = JSON.parse(localStorage.getItem("analysisHistory") || "[]");
        history.unshift(entry);
        localStorage.setItem("analysisHistory", JSON.stringify(history.slice(0, 50)));
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback(rating) {
    setFeedback(rating);
    setFeedbackSent(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch (e) {}
  }

  function scoreColour(score) {
    if (score >= 80) return "text-emerald-700";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  }

  function badgeBg(rec) {
    if (rec === "Strong match") return "bg-emerald-100 text-emerald-800";
    if (rec === "Worth reviewing") return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  }

  return (
    <main className="min-h-screen bg-stone-50">

      <nav className="w-full bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-stone-900">Helixon</span>
          <span className="text-xs text-stone-400 hidden sm:inline">AI Recruitment OS</span>
        </div>
        <div className="flex items-center gap-2">
         <a href="/landing" className="text-sm text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-lg hover:bg-stone-100">
  About
</a>
<a href="/login" className="text-sm text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-lg hover:bg-stone-100">
  Login
</a>
<a href="/signup" className="text-sm bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-lg font-medium">
  Sign up
</a>
        </div>
      </nav>

      <div className="flex items-center justify-center p-6 pt-10">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-stone-200 p-8">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Score a candidate</h1>
              <p className="text-stone-500 text-sm mt-1">Upload a CV and paste a job description. Get a match score in seconds.</p>
            </div>
            <a href="/bulk" className="text-sm border border-stone-300 text-stone-700 px-4 py-2 rounded-lg hover:bg-stone-50 shrink-0 ml-4">
              Bulk Upload →
            </a>
          </div>

          <label className="block text-sm font-medium text-stone-700 mb-2">Candidate CV (PDF only)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm mb-1 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-stone-900 file:text-white cursor-pointer"
          />
          {file ? (
            <p className="text-xs text-stone-400 mb-5">Selected: {file.name}</p>
          ) : (
            <div className="mb-5" />
          )}

          <label className="block text-sm font-medium text-stone-700 mb-2">Job description</label>
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste the full job description here..."
            rows={6}
            className="w-full border border-stone-300 rounded-lg p-3 text-sm mb-6 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          {loading && (
            <div className="mb-4 space-y-1">
              {["Reading CV", "Analysing role", "Generating score"].map((stage, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-stone-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {stage}...
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleAnalyse}
            disabled={loading}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-3 rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? "Analysing..." : "Analyse"}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-8 border-t border-stone-200 pt-6">

              <div className="flex items-center gap-5 mb-4">
                <div className={`text-6xl font-bold ${scoreColour(result.match_score)}`}>
                  {result.match_score}
                </div>
                <div>
                  <div className="text-stone-400 text-sm mb-1">out of 100</div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badgeBg(result.recommendation)}`}>
                    {result.recommendation}
                  </span>
                </div>
              </div>

              <p className="italic text-stone-500 text-sm mb-5 leading-relaxed">{result.summary}</p>

              {result.strengths?.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-stone-800 mb-2 text-sm uppercase tracking-wide">Strengths</h3>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-stone-700">
                        <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.weaknesses?.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-stone-800 mb-2 text-sm uppercase tracking-wide">Weaknesses</h3>
                  <ul className="space-y-1">
                    {result.weaknesses.map((w, i) => (
                      <li key={i} className="flex gap-2 text-sm text-stone-700">
                        <span className="text-red-400 mt-0.5 shrink-0">✗</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!feedbackSent ? (
                <div className="border-t border-stone-100 pt-4">
                  <p className="text-sm text-stone-500 mb-3">Did this match your expert read?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => submitFeedback("up")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${feedback === "up" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                    >
                      👍 Yes, accurate
                    </button>
                    <button
                      onClick={() => submitFeedback("down")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${feedback === "down" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
                    >
                      👎 Not quite
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-stone-100 pt-4">
                  <p className="text-sm text-emerald-700 font-medium">✓ Thanks — that helps us improve</p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </main>
  );
}