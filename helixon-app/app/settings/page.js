"use client";

import { useState, useEffect } from "react";

const AGENCY_ID = "d6207b77-821d-4b93-8906-a9bfbcfd0fae"; 

export default function Settings() {
  const [tone, setTone] = useState("professional");
  const [signature, setSignature] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load current settings when the page opens
useEffect(() => {
  fetch(`/api/agency-settings?agencyId=${AGENCY_ID}`)
    .then((r) => r.json())
    .then((d) => {
      if (d.ok) {
        setTone(d.settings?.tone || "professional");
        setSignature(d.settings?.signature || "");
        setCompanyName(d.settings?.company_name || d.name || "");
        setAgency(d); // save the full response so we can read intake_email
      }
      setLoading(false);
    });
}, []);

  async function save() {
    const res = await fetch("/api/agency-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencyId: AGENCY_ID,
        settings: { tone, signature, company_name: companyName },
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-400">Loading...</p>
      </main>
    );
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

      {/* Page content */}
      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Agency Settings</h1>
        <p className="text-stone-500 text-sm mb-8">
          These settings control how Helixon drafts emails on your behalf.
        </p>

        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">

          {/* Company name */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Agency name
            </label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="TalentCo Recruitment"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Email tone */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Email tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="professional">Professional</option>
              <option value="formal">Formal</option>
              <option value="conversational">Conversational and warm</option>
            </select>
          </div>

          {/* Email signature */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Email signature
            </label>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={"Best regards,\n[RECRUITER NAME]\nTalentCo Recruitment\n+44 7700 000000"}
              rows={4}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm
                resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-stone-400 mt-1">
              Use [RECRUITER NAME] as a placeholder — fill it in before sending.
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={save}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white
              font-medium py-3 rounded-xl text-sm transition-colors"
          >
            {saved ? "Saved!" : "Save settings"}
          </button>

          {/* Only show this if the agency has been given an intake email address */}
{agency?.intake_email && (
  <div className="mt-6 bg-stone-50 rounded-xl p-4 border border-stone-200">
    <h3 className="text-sm font-semibold text-stone-700 mb-1">
      Your CV intake email
    </h3>
    <p className="text-xs text-stone-500 mb-2">
      Forward CVs to this address and they appear in Helixon automatically.
      If the email subject includes a job title, they are scored against it too.
    </p>
    <div className="flex items-center gap-2">
      <code className="text-sm bg-white border border-stone-300 rounded px-3 py-1.5 flex-1 text-stone-800">
        {agency.intake_email}
      </code>
      <button
        onClick={() => navigator.clipboard.writeText(agency.intake_email)}
        className="text-xs text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded hover:bg-emerald-50 shrink-0"
      >
        Copy
      </button>
    </div>
  </div>
)}

        </div>
      </div>
    </main>
  );
}