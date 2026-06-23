"use client";
import { useState, useEffect } from "react";

const STAGES = [
  "Reading CV",
  "Parsing job description",
  "Analysing candidate fit",
  "Generating score",
];

export default function Home() {
  const [file, setFile] = useState(null);
  const [jobText, setJobText] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!loading) { setStage(0); return; }
    const interval = setInterval(() => {
      setStage(prev => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 4000);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleAnalyse() {
    if (!file || !jobText.trim()) {
      setError("Please add a CV and paste a job description.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    setFeedback(null);
    setFeedbackSent(false);
    setShowUpgrade(false);

    const fd = new FormData();
    fd.append("cv", file);
    fd.append("jobText", jobText);
    fd.append("agencyId", "d6207b77-821d-4b93-8906-a9bfbcfd0fae");

    try {
      const res = await fetch("/api/run", { method: "POST", body: fd });
      const data = await res.json();
      // if (data.upgrade) { setShowUpgrade(true); return; }
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
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch (e) {
      setError("Network error. Please check your connection and try again.");
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
    } catch {}
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
      setError(null);
    } else {
      setError("Please drop a PDF file.");
    }
  }

  function ScoreRing({ score }) {
    const size = 120;
    const stroke = 10;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const fill = (score / 100) * circ;
    let colour = "#b00000";
    if (score >= 80) colour = "#0b6e4f";
    else if (score >= 60) colour = "#d97706";

    return (
      <div className="relative flex items-center justify-center"
        style={{ width: size, height: size }}>
        <svg width={size} height={size}
          style={{ transform: "rotate(-90deg)", position: "absolute" }}>
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke="#e7e5e0" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke={colour} strokeWidth={stroke}
            strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div className="relative text-center">
          <div className="text-3xl font-bold" style={{ color: colour }}>{score}</div>
          <div className="text-xs text-stone-400 leading-tight">out of 100</div>
        </div>
      </div>
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
          <a href="/history" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100 hidden sm:block">History</a>
          <a href="/bulk" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100 hidden sm:block">Bulk Upload</a>
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

          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-stone-900">Score a candidate</h1>
                <p className="text-stone-500 text-sm mt-0.5">Upload a CV and job spec. Get a match score in seconds.</p>
              </div>
              <a href="/bulk" className="text-xs border border-stone-300 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-50 shrink-0 ml-3">
                Bulk Upload
              </a>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center mb-5 transition-colors cursor-pointer ${dragOver ? "border-emerald-500 bg-emerald-50" : file ? "border-emerald-400 bg-emerald-50/50" : "border-stone-300 hover:border-stone-400 bg-stone-50"}`}
              onClick={() => document.getElementById("cv-input").click()}
            >
              <input id="cv-input" type="file" accept="application/pdf"
                className="hidden"
                onChange={e => { setFile(e.target.files?.[0] || null); setError(null); }} />
              {file ? (
                <div>
                  <div className="text-2xl mb-1">📄</div>
                  <p className="text-sm font-medium text-emerald-700 truncate px-4">{file.name}</p>
                  <p className="text-xs text-stone-400 mt-1">Click to change</p>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-1">📂</div>
                  <p className="text-sm font-medium text-stone-700">Drop CV here or click to upload</p>
                  <p className="text-xs text-stone-400 mt-1">PDF only</p>
                </div>
              )}
            </div>

            <label className="block text-sm font-medium text-stone-700 mb-2">Job description</label>
            <textarea
              value={jobText}
              onChange={e => setJobText(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={6}
              className="w-full border border-stone-300 rounded-xl p-3 text-sm mb-5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />

            {loading && (
              <div className="mb-4 bg-stone-50 rounded-xl p-4">
                {STAGES.map((s, i) => (
                  <div key={i} className={`flex items-center gap-3 py-1.5 transition-opacity ${i > stage ? "opacity-30" : ""}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs ${i < stage ? "bg-emerald-700 text-white" : i === stage ? "bg-emerald-200 text-emerald-700 animate-pulse" : "bg-stone-200"}`}>
                      {i < stage ? "✓" : ""}
                    </div>
                    <span className={`text-sm ${i === stage ? "text-stone-900 font-medium" : "text-stone-500"}`}>
                      {s}{i === stage ? "..." : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleAnalyse}
              disabled={loading}
              className={`w-full font-medium py-3 rounded-xl transition-all text-sm ${loading ? "bg-stone-200 text-stone-400 cursor-not-allowed" : "bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm hover:shadow-md"}`}
            >
              {loading ? "Analysing..." : "Analyse candidate"}
            </button>

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
            )}
          </div>

          <div>
            {!result && !loading && (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 h-full flex flex-col items-center justify-center text-center min-h-64">
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-stone-500 text-sm">Your candidate score will appear here.</p>
                <p className="text-stone-400 text-xs mt-1">Upload a CV and paste a job description to start.</p>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 h-full flex flex-col items-center justify-center text-center min-h-64">
                <div className="w-20 h-20 rounded-full border-4 border-stone-200 border-t-emerald-600 animate-spin mb-4" />
                <p className="text-stone-500 text-sm">Analysing...</p>
              </div>
            )}

            {result && (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 space-y-6">

                <div className="flex items-center gap-6 pb-5 border-b border-stone-100">
                  <ScoreRing score={result.match_score} />
                  <div>
                    <div className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">Match score</div>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${result.recommendation === "Strong match" ? "bg-emerald-100 text-emerald-800" : result.recommendation === "Worth reviewing" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                      {result.recommendation}
                    </div>
                    <p className="text-stone-500 text-xs mt-2 leading-relaxed max-w-48">{result.summary}</p>
                  </div>
                </div>

                {result.strengths?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Strengths</h3>
                    <ul className="space-y-2">
                      {result.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-stone-700">
                          <span className="mt-0.5 text-emerald-600 shrink-0 font-bold">✓</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.weaknesses?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Weaknesses</h3>
                    <ul className="space-y-2">
                      {result.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-stone-700">
                          <span className="mt-0.5 text-red-400 shrink-0 font-bold">✗</span>{w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!feedbackSent ? (
                  <div className="border-t border-stone-100 pt-4">
                    <p className="text-xs text-stone-400 mb-3">Did this match your expert read?</p>
                    <div className="flex gap-2">
                      <button onClick={() => submitFeedback("up")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${feedback === "up" ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}>
                        👍 Accurate
                      </button>
                      <button onClick={() => submitFeedback("down")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${feedback === "down" ? "bg-red-600 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}>
                        👎 Not quite
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700 font-medium pt-2 border-t border-stone-100">
                    ✓ Thanks — helps us improve
                  </p>
                )}

                <button
                  onClick={() => { setResult(null); setFile(null); setJobText(""); setFeedback(null); setFeedbackSent(false); }}
                  className="w-full text-sm text-stone-500 hover:text-stone-800 py-2 rounded-lg hover:bg-stone-50 transition-colors border border-stone-200">
                  ← Score another candidate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showUpgrade && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">Free trial complete</h2>
            <p className="text-stone-500 text-sm mb-6 leading-relaxed">
              You&apos;ve used your 3 free analyses. Upgrade to continue screening candidates — plans from £149/month.
            </p>
            <div className="space-y-3">
              <a href="YOUR-SOLO-STRIPE-LINK" className="block w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-3 rounded-xl text-sm transition-colors">
                Solo plan — £149/month
              </a>
              <a href="YOUR-TEAM-STRIPE-LINK" className="block w-full border border-stone-300 text-stone-700 font-medium py-3 rounded-xl text-sm hover:bg-stone-50 transition-colors">
                Team plan — £349/month
              </a>
            </div>
            <button onClick={() => setShowUpgrade(false)} className="mt-4 text-xs text-stone-400 hover:text-stone-600">
              Maybe later
            </button>
          </div>
        </div>
      )}
    </main>
  );
}