"use client";
import { useState, useEffect } from "react";
 
const USERS = {
  Tanaka: "Founder1!",
  Conor: "Founder2!",
};
 
export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [stats, setStats] = useState(null);
  const [scores, setScores] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [selectedAgency, setSelectedAgency] = useState("all");
 
  useEffect(() => {
    const savedUser = sessionStorage.getItem("helixon_admin_user");
    const savedKey = sessionStorage.getItem("helixon_admin_key");
    if (savedUser && savedKey) {
      setCurrentUser(savedUser);
      setAuthed(true);
      fetchAll(savedKey);
    }
  }, []);
 
  function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    const expectedPassword = USERS[username];
    if (!expectedPassword) {
      setLoginError("Unknown username.");
      return;
    }
    if (password !== expectedPassword) {
      setLoginError("Incorrect password. Try again.");
      setPassword("");
      return;
    }
    const adminKey = "fiudohsofiuhdosfhuihf9uhe49ri2rh90230rq0ewfhfw0eh3208";
    sessionStorage.setItem("helixon_admin_user", username);
    sessionStorage.setItem("helixon_admin_key", adminKey);
    setCurrentUser(username);
    setAuthed(true);
    fetchAll(adminKey);
  }
 
  function handleLogout() {
    sessionStorage.removeItem("helixon_admin_user");
    sessionStorage.removeItem("helixon_admin_key");
    setAuthed(false);
    setUsername("");
    setPassword("");
    setCurrentUser("");
    setStats(null);
  }
 
  async function fetchAll(key) {
    setLoading(true);
    setError(null);
    const adminKey = key || sessionStorage.getItem("helixon_admin_key");
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setStats(data.stats);
      setScores(data.scores);
      setCandidates(data.candidates);
      setSubscriptions(data.subscriptions);
      setAgencies(data.agencies);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
 
  function agencyName(agencyId) {
    return agencies.find((a) => a.id === agencyId)?.name || "Unknown agency";
  }
 
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
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
 
  // Agency filter helpers
  const filteredScores = scores.filter((s) => {
    const agencyMatch =
      selectedAgency === "all" ||
      s.candidates?.agency_id === selectedAgency ||
      s.jobs?.agency_id === selectedAgency;
    const q = search.toLowerCase();
    const searchMatch =
      s.candidates?.name?.toLowerCase().includes(q) ||
      s.jobs?.title?.toLowerCase().includes(q) ||
      s.recommendation?.toLowerCase().includes(q);
    return agencyMatch && searchMatch;
  });
 
  const filteredCandidates = candidates.filter((c) => {
    const agencyMatch =
      selectedAgency === "all" || c.agency_id === selectedAgency;
    const searchMatch = c.name?.toLowerCase().includes(search.toLowerCase());
    return agencyMatch && searchMatch;
  });
 
  const TABS = ["overview", "agencies", "analyses", "candidates", "subscriptions"];
 
  // Per-agency stats
  function agencyStats(agencyId) {
    const agencyCandidates = candidates.filter((c) => c.agency_id === agencyId);
    const agencyScores = scores.filter(
      (s) =>
        s.candidates?.agency_id === agencyId ||
        s.jobs?.agency_id === agencyId
    );
    const avg =
      agencyScores.length > 0
        ? Math.round(
            agencyScores.reduce((a, b) => a + (b.match_score || 0), 0) /
              agencyScores.length
          )
        : 0;
    return {
      candidates: agencyCandidates.length,
      analyses: agencyScores.length,
      avgScore: avg,
      strongMatches: agencyScores.filter((s) => s.recommendation === "Strong match").length,
    };
  }
 
  // LOGIN SCREEN
  if (!authed) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-emerald-700 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">H</span>
            </div>
            <div>
              <p className="text-base font-bold text-stone-900">Helixon Admin</p>
              <p className="text-xs text-stone-400">Restricted access</p>
            </div>
          </div>
 
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoFocus
                required
                className="w-full border border-stone-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
 
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full border border-stone-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
 
            {loginError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {loginError}
              </div>
            )}
 
            <button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              Sign in
            </button>
          </form>
 
          <p className="text-xs text-stone-400 text-center mt-6">
            This area is restricted to Helixon administrators.
          </p>
        </div>
      </main>
    );
  }
 
  // DASHBOARD
  return (
    <main className="min-h-screen bg-stone-50">
 
      <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-emerald-700 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="text-base font-bold text-stone-900">Helixon</span>
          <span className="text-xs text-red-600 border border-red-200 bg-red-50 px-2 py-0.5 rounded-full font-medium">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 hidden sm:inline">
            Signed in as <span className="font-medium text-stone-600">{currentUser}</span>
          </span>
          <a href="/" className="text-sm text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100">
            Back to app
          </a>
          <button
            onClick={() => fetchAll()}
            className="text-sm border border-stone-300 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-50"
          >
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="text-sm bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100"
          >
            Sign out
          </button>
        </div>
      </nav>
 
      <div className="max-w-6xl mx-auto px-4 py-10">
 
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-900">Admin Dashboard</h1>
          <p className="text-stone-500 text-sm mt-1">All activity across Helixon</p>
        </div>
 
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
 
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 rounded-full border-4 border-stone-200 border-t-emerald-600 animate-spin" />
          </div>
        )}
 
        {!loading && stats && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {[
                { label: "Agencies", value: stats.totalAgencies, icon: "🏢" },
                { label: "Total analyses", value: stats.totalScores, icon: "📊" },
                { label: "Candidates", value: stats.totalCandidates, icon: "👤" },
                { label: "Avg match score", value: stats.avgScore, icon: "🎯" },
                { label: "Active subscriptions", value: stats.activeSubscriptions, icon: "💳" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className="text-2xl font-bold text-stone-900">{s.value}</div>
                  <div className="text-xs text-stone-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
 
            {/* Recommendation breakdown */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: "Strong matches", value: stats.strongMatches, colour: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                { label: "Worth reviewing", value: stats.worthReviewing, colour: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                { label: "Not a fit", value: stats.notAFit, colour: "text-red-700", bg: "bg-red-50 border-red-200" },
              ].map((s) => (
                <div key={s.label} className={`rounded-2xl border p-5 ${s.bg}`}>
                  <div className={`text-2xl font-bold ${s.colour}`}>{s.value}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
 
            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-white border border-stone-200 rounded-xl p-1 w-fit flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setSearch(""); setSelectedAgency("all"); }}
                  className={`text-sm px-4 py-1.5 rounded-lg font-medium capitalize transition-colors ${
                    tab === t ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
 
            {/* Agency filter + search bar (shown on analyses + candidates tabs) */}
            {(tab === "analyses" || tab === "candidates") && (
              <div className="flex gap-3 mb-4 flex-wrap">
                <select
                  value={selectedAgency}
                  onChange={(e) => setSelectedAgency(e.target.value)}
                  className="border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                >
                  <option value="all">All agencies</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent flex-1 max-w-sm"
                />
              </div>
            )}
 
            {/* OVERVIEW TAB */}
            {tab === "overview" && (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100">
                  <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">Recent analyses</h2>
                </div>
                <div className="divide-y divide-stone-100">
                  {scores.slice(0, 10).map((s) => (
                    <div key={s.id} className="px-6 py-4 flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-xs"
                        style={{ borderColor: scoreColour(s.match_score), color: scoreColour(s.match_score) }}
                      >
                        {s.match_score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">{s.candidates?.name || "Unknown"}</p>
                        <p className="text-xs text-stone-400 truncate">
                          {s.jobs?.title || "Unknown role"} · {formatDate(s.created_at)}
                        </p>
                        <p className="text-xs text-stone-300 truncate">
                          {agencyName(s.candidates?.agency_id || s.jobs?.agency_id)}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${recommendationStyle(s.recommendation)}`}>
                        {s.recommendation}
                      </span>
                    </div>
                  ))}
                  {scores.length === 0 && (
                    <p className="px-6 py-8 text-sm text-stone-400 text-center">No analyses yet</p>
                  )}
                </div>
              </div>
            )}
 
            {/* AGENCIES TAB */}
            {tab === "agencies" && (
              <div className="space-y-4">
                {agencies.length === 0 && (
                  <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
                    <p className="text-stone-400 text-sm">No agencies yet</p>
                  </div>
                )}
                {agencies.map((agency) => {
                  const as = agencyStats(agency.id);
                  return (
                    <div key={agency.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                      {/* Agency header */}
                      <div className="px-6 py-5 border-b border-stone-100 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 bg-emerald-700 rounded-md flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                                {agency.name?.charAt(0) || "A"}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-stone-900">{agency.name}</h3>
                          </div>
                          <p className="text-xs text-stone-400">{agency.intake_email}</p>
                          <p className="text-xs text-stone-300 mt-0.5">Since {formatDate(agency.created_at)}</p>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-center shrink-0">
                          {[
                            { label: "Candidates", value: as.candidates },
                            { label: "Analyses", value: as.analyses },
                            { label: "Avg score", value: as.avgScore },
                            { label: "Strong matches", value: as.strongMatches },
                          ].map((stat) => (
                            <div key={stat.label}>
                              <p className="text-lg font-bold text-stone-900">{stat.value}</p>
                              <p className="text-xs text-stone-400">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
 
                      {/* Agency candidates */}
                      <div>
                        <div className="px-6 py-3 bg-stone-50 border-b border-stone-100">
                          <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Candidates</p>
                        </div>
                        {candidates.filter((c) => c.agency_id === agency.id).length === 0 && (
                          <p className="px-6 py-4 text-xs text-stone-400">No candidates yet</p>
                        )}
                        {candidates
                          .filter((c) => c.agency_id === agency.id)
                          .slice(0, 5)
                          .map((c) => {
                            const candidateScore = scores.find(
                              (s) => s.candidates?.name === c.name
                            );
                            return (
                              <div key={c.id} className="px-6 py-3 flex items-center gap-4 border-b border-stone-50">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-stone-800 truncate">{c.name}</p>
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {c.extracted?.skills?.slice(0, 4).map((skill, i) => (
                                      <span key={i} className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {candidateScore && (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div
                                      className="w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-xs"
                                      style={{
                                        borderColor: scoreColour(candidateScore.match_score),
                                        color: scoreColour(candidateScore.match_score),
                                      }}
                                    >
                                      {candidateScore.match_score}
                                    </div>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${recommendationStyle(candidateScore.recommendation)}`}>
                                      {candidateScore.recommendation}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        {candidates.filter((c) => c.agency_id === agency.id).length > 5 && (
                          <p className="px-6 py-3 text-xs text-stone-400">
                            +{candidates.filter((c) => c.agency_id === agency.id).length - 5} more candidates
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
 
            {/* ANALYSES TAB */}
            {tab === "analyses" && (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100">
                  <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
                    All analyses ({filteredScores.length})
                  </h2>
                </div>
                <div className="divide-y divide-stone-100">
                  {filteredScores.map((s) => (
                    <div key={s.id} className="px-6 py-4 flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-xs"
                        style={{ borderColor: scoreColour(s.match_score), color: scoreColour(s.match_score) }}
                      >
                        {s.match_score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">{s.candidates?.name || "Unknown"}</p>
                        <p className="text-xs text-stone-400 truncate">
                          {s.jobs?.title || "Unknown role"} · {formatDate(s.created_at)}
                        </p>
                        <p className="text-xs text-stone-300 truncate">
                          {agencyName(s.candidates?.agency_id || s.jobs?.agency_id)}
                        </p>
                        {s.result?.summary && (
                          <p className="text-xs text-stone-500 mt-0.5 truncate">{s.result.summary}</p>
                        )}
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${recommendationStyle(s.recommendation)}`}>
                        {s.recommendation}
                      </span>
                    </div>
                  ))}
                  {filteredScores.length === 0 && (
                    <p className="px-6 py-8 text-sm text-stone-400 text-center">No results</p>
                  )}
                </div>
              </div>
            )}
 
            {/* CANDIDATES TAB */}
            {tab === "candidates" && (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100">
                  <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
                    All candidates ({filteredCandidates.length})
                  </h2>
                </div>
                <div className="divide-y divide-stone-100">
                  {filteredCandidates.map((c) => (
                    <div key={c.id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-stone-900">{c.name}</p>
                          <p className="text-xs text-stone-300 mt-0.5">{agencyName(c.agency_id)}</p>
                          <p className="text-xs text-stone-400 mt-0.5">{formatDate(c.created_at)}</p>
                          {c.extracted?.skills?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {c.extracted.skills.slice(0, 5).map((skill, i) => (
                                <span key={i} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-stone-400 shrink-0">
                          {c.extracted?.years_experience ? `${c.extracted.years_experience} yrs exp` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredCandidates.length === 0 && (
                    <p className="px-6 py-8 text-sm text-stone-400 text-center">No candidates found</p>
                  )}
                </div>
              </div>
            )}
 
            {/* SUBSCRIPTIONS TAB */}
            {tab === "subscriptions" && (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100">
                  <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
                    Subscriptions ({subscriptions.length})
                  </h2>
                </div>
                <div className="divide-y divide-stone-100">
                  {subscriptions.map((s) => (
                    <div key={s.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{s.user_id || "Unknown user"}</p>
                        <p className="text-xs text-stone-400 mt-0.5">Since {formatDate(s.created_at)}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        s.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                  {subscriptions.length === 0 && (
                    <p className="px-6 py-8 text-sm text-stone-400 text-center">No subscriptions yet</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}