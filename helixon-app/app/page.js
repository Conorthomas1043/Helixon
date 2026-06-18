"use client";
import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [jobText, setJobText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleAnalyse() {
    if (!file || !jobText.trim()) {
      alert("Please add a CV and paste a job description.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    const fd = new FormData();
    fd.append("cv", file);
    fd.append("jobText", jobText);
    fd.append("agencyId", "YOUR-SEED-AGENCY-ID");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (data.ok) {
        setResult(data.result);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">
          Helixon
        </h1>
        <p className="text-stone-500 mb-6 text-sm">
          Score a candidate against a role in seconds.
        </p>

        <label className="block text-sm font-medium text-stone-700 mb-2">
          Candidate CV (PDF only)
        </label>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm mb-1 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-stone-900 file:text-white"
        />

        {file && (
          <p className="text-xs text-stone-400 mb-5">
            Selected: {file.name}
          </p>
        )}

        {!file && <div className="mb-5" />}

        <label className="block text-sm font-medium text-stone-700 mb-2">
          Job description
        </label>

        <textarea
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
          placeholder="Paste the full job description here..."
          rows={6}
          className="w-full border border-stone-300 rounded-lg p-3 text-sm mb-6 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <button
          onClick={handleAnalyse}
          disabled={loading}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-3 rounded-lg disabled:opacity-50"
        >
          {loading ? "Analysing..." : "Analyse"}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            Error: {error}
          </div>
        )}

        {result && (
          <div className="mt-8 border-t border-stone-200 pt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-6xl font-bold text-emerald-700">
                {result.match_score}
              </div>
              <div>
                <div className="text-stone-400 text-sm">out of 100</div>
                <div className="font-semibold text-stone-800">
                  {result.recommendation}
                </div>
              </div>
            </div>

            <p className="italic text-stone-500 text-sm mb-5">
              {result.summary}
            </p>

            {result.strengths?.length > 0 && (
              <>
                <h3 className="font-semibold text-stone-800 mb-2">
                  Strengths
                </h3>
                <ul className="list-disc ml-5 text-stone-700 text-sm mb-4 space-y-1">
                  {result.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}

            {result.weaknesses?.length > 0 && (
              <>
                <h3 className="font-semibold text-stone-800 mb-2">
                  Weaknesses
                </h3>
                <ul className="list-disc ml-5 text-stone-700 text-sm space-y-1">
                  {result.weaknesses.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
