"use client";

import { useState, useEffect } from "react";

const AGENCY_ID = "d6207b77-821d-4b93-8906-a9bfbcfd0fae"; // replace with real auth later

export default function Shortlists() {
  const [shortlists, setShortlists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShortlists();
  }, []);

  async function loadShortlists() {
    const res = await fetch(`/api/shortlists?agencyId=${AGENCY_ID}`);
    const data = await res.json();
    if (data.ok) setShortlists(data.shortlists);
    setLoading(false);
  }

  async function createShortlist() {
    if (!newName.trim()) return;
    const res = await fetch("/api/shortlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyId: AGENCY_ID, name: newName }),
    });
    const data = await res.json();
    if (data.ok) {
      setNewName("");
      loadShortlists();
    }
  }

  // Colour-codes score numbers: green for high, amber for mid, red for low
  function scoreColour(s) {
    if (s >= 80) return "text-emerald-700";
    if (s >= 60) return "text-amber-600";
    return "text-red-600";
  }

  return (
    <main className="min-h-screen bg-stone-50">
      {/* Nav */}
      <nav className="w-full bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-stone-900">Helixon</a>
        <a href="/" className="text-sm text-stone-500 hover:text-stone-800">
          Back to scoring
        </a>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header row with create form */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-stone-900">Shortlists</h1>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New shortlist name..."
              onKeyDown={(e) => e.key === "Enter" && createShortlist()}
              className="text-sm border border-stone-300 rounded-lg px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
            />
            <button
              onClick={createShortlist}
              className="bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-800"
            >
              Create
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <p className="text-stone-400">Loading...</p>
        ) : shortlists.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
            <p className="text-stone-400 text-sm">No shortlists yet.</p>
            <p className="text-stone-400 text-xs mt-1">
              Create one above, then add candidates from the scoring page.
            </p>
          </div>
        ) : (
          /* List of shortlists */
          <div className="space-y-3">
            {shortlists.map((sl) => (
              <div key={sl.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                {/* Shortlist row — click to expand */}
                <button
                  onClick={() => setSelected(selected?.id === sl.id ? null : sl)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-stone-50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-stone-900">{sl.name}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {sl.shortlist_candidates?.length || 0} candidates
                      {sl.jobs?.title ? ` • ${sl.jobs.title}` : ""}
                    </p>
                  </div>
                  <span className="text-stone-400 text-sm">
                    {selected?.id === sl.id ? "∧" : "∨"}
                  </span>
                </button>

                {/* Expanded candidate table */}
                {selected?.id === sl.id && (
                  <div className="border-t border-stone-100">
                    {!sl.shortlist_candidates || sl.shortlist_candidates.length === 0 ? (
                      <p className="text-stone-400 text-sm p-4">
                        No candidates yet. Score a CV and add them from the results page.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-stone-100">
                            <th className="text-left p-3 text-xs text-stone-400 font-medium">Candidate</th>
                            <th className="text-left p-3 text-xs text-stone-400 font-medium">Score</th>
                            <th className="text-left p-3 text-xs text-stone-400 font-medium">Recommendation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Sort candidates by score descending */}
                          {sl.shortlist_candidates
                            .sort((a, b) => (b.scores?.match_score || 0) - (a.scores?.match_score || 0))
                            .map((sc, i) => (
                              <tr key={i} className="border-b border-stone-50 hover:bg-stone-50">
                                <td className="p-3 font-medium text-stone-800">
                                  {sc.candidates?.name || "Unknown"}
                                </td>
                                <td className={`p-3 font-bold ${scoreColour(sc.scores?.match_score || 0)}`}>
                                  {sc.scores?.match_score || "—"}
                                </td>
                                <td className="p-3 text-stone-500 text-xs">
                                  {sc.scores?.recommendation || "—"}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}