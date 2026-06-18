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
    setError(null);
    setResult(null);

    try {
      /**
       * ⚠️ TEMP PLACEHOLDER:
       * You should replace this with real PDF text extraction later.
       */
      const cvText = `Uploaded file: ${file.name}`;

      // 1. Extract CV
      const extractRes = await fetch("/api/extract-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cvText,
          agencyId: "d6207b77-821d-4b93-8906-a9bfbcfd0fae",
        }),
      });

      const extractData = await extractRes.json();

      if (!extractData.ok) {
        throw new Error(extractData.error || "CV extraction failed");
      }

      const candidateId = extractData.candidate.id;

      // 2. Score candidate
      const scoreRes = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          jobId: "cb84f43b-e7b9-4ce4-aca6-fc402d9cfde3", // replace later dynamically
          agencyId: "d6207b77-821d-4b93-8906-a9bfbcfd0fae",
        }),
      });

      const scoreData = await scoreRes.json();

      if (!scoreData.ok) {
        throw new Error(scoreData.error || "Scoring failed");
      }

      setResult(scoreData.score);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Helixon</h1>
        <p className="text-stone-500 mb-6 text-sm">
          Score a candidate against a role in seconds.
        </p>

        <label className="block text-sm font-medium text-stone-700 mb-2">
          Candidate CV (PDF only)
        </label>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
          className="block w-full text-sm mb-1 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-stone-900 file:text-white"
        />

        {file && (
          <p className="text-xs text-stone-400 mb-5">
            Selected: {file.name}
          </p>
        )}

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
          <p className="text-red-500 text-sm mt-4">{error}</p>
        )}

        {result && (
          <div className="mt-6 p-4 border rounded-lg bg-stone-50">
            <p className="font-semibold text-lg">
              Score: {result.match_score}
            </p>
            <p className="text-sm mt-1">
              {result.summary}
            </p>
            <p className="text-sm mt-2 font-medium">
              Recommendation: {result.recommendation}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}