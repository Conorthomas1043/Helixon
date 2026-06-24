"use client";

export default function Landing() {
  const layers = [
    {
      num: "01",
      title: "Score any CV in 30 seconds",
      desc: "Upload a PDF, paste a job spec. Strengths, weaknesses, match score, recommendation.",
    },
    {
      num: "02",
      title: "Rank 80 CVs at once",
      desc: "Upload your whole inbox. Get a ranked shortlist sorted highest score first. Export to CSV.",
    },
    {
      num: "03",
      title: "Generate the client summary",
      desc: "One click. Client-ready candidate write-up. Edit it, copy it, send it.",
    },
    {
      num: "04",
      title: "Draft the email",
      desc: "Interview invite, shortlist update, rejection, feedback chase. Written for you. Editable before sending.",
    },
  ];

  return (
    <main className="min-h-screen bg-white">

      {/* ── Nav ── */}
      <nav className="border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-stone-900">Helixon</span>
        <div className="flex items-center gap-3">
          <a href="/login" className="text-sm text-stone-600 hover:text-stone-900">Login</a>
          <a
            href="/signup"
            className="text-sm bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-800"
          >
            Start free
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="inline-block bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          AI Recruitment OS
        </div>
        <h1 className="text-5xl font-bold text-stone-900 leading-tight mb-6">
          Score any CV against any role in under 30 seconds
        </h1>
        <p className="text-xl text-stone-500 mb-10 max-w-xl mx-auto">
          Helixon reads the CV, judges the fit like a senior recruiter, writes the candidate
          summary, and drafts the email. Your recruiters spend their time on the candidates
          worth calling.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href="/signup"
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium px-8 py-4 rounded-xl text-base transition-colors"
          >
            Start free — 3 analyses free
          </a>
          <a
            href="/"
            className="border border-stone-300 text-stone-700 font-medium px-8 py-4 rounded-xl text-base hover:bg-stone-50 transition-colors"
          >
            See it live
          </a>
        </div>
        <p className="text-xs text-stone-400 mt-4">No card required.</p>
      </section>

      {/* ── Four layers ── */}
      <section className="bg-stone-50 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-stone-900 text-center mb-3">
            From CV to drafted email in minutes
          </h2>
          <p className="text-stone-500 text-center mb-12">
            Four layers of the recruiter workflow. Automated.
          </p>
          <div className="space-y-4">
            {layers.map((l) => (
              <div
                key={l.num}
                className="flex items-start gap-6 bg-white rounded-2xl p-6 shadow-sm border border-stone-200"
              >
                <div className="text-3xl font-bold text-emerald-700 shrink-0 w-12">
                  {l.num}
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 mb-1">{l.title}</h3>
                  <p className="text-stone-500 text-sm">{l.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-stone-900 text-center mb-12">
            Built for recruiters who screen a lot
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                who: "Internal HR teams",
                pain: "Hiring for 10 different roles with no niche expertise in any of them.",
              },
              {
                who: "Generalist agencies",
                pain: "A new role type every week. Hard to be expert in all of them.",
              },
              {
                who: "High-volume recruiters",
                pain: "80 CVs land on a Monday. No time to read them all properly.",
              },
            ].map((c) => (
              <div key={c.who} className="bg-stone-50 rounded-2xl p-6 border border-stone-200">
                <h3 className="font-bold text-stone-900 mb-2">{c.who}</h3>
                <p className="text-stone-500 text-sm">{c.pain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="bg-stone-50 py-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-stone-900 text-center mb-4">
            Simple pricing
          </h2>
          <p className="text-stone-500 text-center mb-12">
            Start with 3 free analyses. No card required.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Solo plan */}
            <div className="bg-white border border-stone-200 rounded-2xl p-8">
              <h3 className="font-bold text-stone-900 mb-1">Solo</h3>
              <div className="text-4xl font-bold text-stone-900 mb-1">
                £249<span className="text-lg font-normal text-stone-400">/month</span>
              </div>
              <p className="text-stone-500 text-sm mb-6">One recruiter. Unlimited analyses.</p>
              <a
                href="/signup"
                className="block w-full text-center border border-emerald-700 text-emerald-700 font-medium py-3 rounded-xl hover:bg-emerald-50"
              >
                Start free trial
              </a>
            </div>
            {/* Team plan */}
            <div className="bg-white border-2 border-emerald-700 rounded-2xl p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Most popular
              </div>
              <h3 className="font-bold text-stone-900 mb-1">Team</h3>
              <div className="text-4xl font-bold text-stone-900 mb-1">
                £499<span className="text-lg font-normal text-stone-400">/month</span>
              </div>
              <p className="text-stone-500 text-sm mb-6">Up to 5 recruiters. Shared shortlists.</p>
              <a
                href="/signup"
                className="block w-full text-center bg-emerald-700 text-white font-medium py-3 rounded-xl hover:bg-emerald-800"
              >
                Start free trial
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-stone-200 py-8 text-center text-stone-400 text-sm">
        Helixon © 2026 •{" "}
        <a href="/privacy" className="hover:text-stone-600">Privacy Policy</a>
        {" "} • {" "}
        <a href="/dpa" className="hover:text-stone-600">DPA</a>
      </footer>

    </main>
  );
}