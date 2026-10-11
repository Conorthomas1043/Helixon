"use client";

// The workspace tab strip and two split-view panes with sample candidates,
// for checking them by eye (the panes normally need a signed-in API).

import { useState } from "react";
import { WorkspaceTabStrip } from "@/components/workspace/WorkspaceTabs";
import CandidatePane from "@/app/dashboard/workspace/CandidatePane";
import CandidatePicker from "@/app/dashboard/workspace/CandidatePicker";
import { primeResource } from "@/lib/hooks/useResource";
import { buildReport } from "@/lib/screening/analysis-report";

const NOW = "2026-10-11T09:00:00.000Z";

function sample(id, { name, score, blind = false, aiWriting = null, title }) {
  const report = buildReport(
    {
      match_score: score,
      skill_score: score - 4,
      experience_score: score + 3,
      culture_score: score - 8,
      recommendation: score >= 80 ? "Shortlist" : "Review",
      summary: `${blind ? "This candidate" : name.split(" ")[0]} has strong hands-on data engineering experience and most of the must-haves.`,
      matched_skills: ["Python", "SQL", "Airflow"],
      missing_required: score >= 80 ? [] : ["dbt"],
      strengths: ["Six years building data pipelines", "Led a warehouse migration"],
      red_flags: score >= 80 ? [] : ["Short tenure at the last two employers"],
    },
    { name, current_title: title, current_employer: "Initech", ai_writing: aiWriting },
    { blind }
  );
  return {
    id,
    fullName: name,
    jobTitle: "Senior Data Engineer",
    stage: score >= 80 ? "Shortlisted" : "Screened",
    subStage: null,
    score,
    screenedBlind: blind,
    hasCvText: true,
    resume: { name: "cv.pdf", uploadedAt: NOW },
    email: blind ? null : `${name.split(" ")[0].toLowerCase()}@example.com`,
    phone: "07700 900123",
    linkedin: null,
    location: "Leeds",
    currentTitle: title,
    currentCompany: "Initech",
    recruiterName: "Ada Lovelace",
    source: "LinkedIn",
    nextAction: { label: "Call back about notice period", dueAt: NOW },
    matchSummary: "Strong pipeline work and a warehouse migration; dbt not shown.",
    strengths: ["Six years of Python", "Led a migration"],
    concerns: score >= 80 ? [] : ["dbt not shown"],
    otherRoles: [{ candidateId: "x", jobId: "y", jobTitle: "Analytics Engineer", client: "Acme", score: 71, stage: "Screened" }],
    notes: [{ id: "n1", author: "Ada Lovelace", authorId: "u", createdAt: NOW, body: "Keen to move, 1 month notice.", pinnedAt: null }],
    analysis: { scoreId: "s", jobId: "j", jobTitle: "Senior Data Engineer", jobClient: "Acme", analysedAt: NOW, report },
    job: null,
  };
}

const CANDIDATES = [
  sample("demo-a", {
    name: "Grace Hopper",
    score: 86,
    title: "Data Engineer",
    aiWriting: { likelihood: "high", signals: ["Stock phrasing in most bullets", "Achievements claimed with no figures, names or tools"] },
  }),
  sample("demo-b", { name: "Alan Turing", score: 64, title: "Analytics Engineer", blind: true }),
];

const CV_TEXT = "GRACE HOPPER\nData Engineer - Leeds\n\nEXPERIENCE\nInitech, Data Engineer (2020 - now)\n- Built Airflow pipelines in Python moving 2TB a day\n- Led the migration from Redshift to Snowflake\n\nSKILLS\nPython, SQL, Airflow, Snowflake";

const TABS = [
  { kind: "candidate", id: "demo-a", title: "Grace Hopper", openedAt: 1 },
  { kind: "candidate", id: "demo-b", title: "Alan Turing", openedAt: 2 },
  { kind: "job", id: "j1", title: "Senior Data Engineer", openedAt: 3 },
  { kind: "client", id: "c1", title: "Acme Analytics", openedAt: 4 },
];

export default function WorkspaceDemo() {
  // Samples go into the cache before the panes ask for them.
  useState(() => {
    if (typeof window === "undefined") return null;
    for (const c of CANDIDATES) primeResource(`candidate:${c.id}`, c);
    primeResource("cv-text:demo-a", { text: CV_TEXT });
    return null;
  });
  const [views, setViews] = useState({ "demo-a": "score", "demo-b": "profile" });
  const [tabs, setTabs] = useState(TABS);
  const [picked, setPicked] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <CandidatePicker exclude={["demo-a"]} onPick={setPicked} />
        <span className="text-sm text-[var(--ink-soft)]" data-testid="picked">{picked ? `Picked ${picked}` : "Nothing picked"}</span>
      </div>
      <div className="rounded-[12px] border border-[var(--border)] bg-white">
        <WorkspaceTabStrip tabs={tabs} activeKey="candidate:demo-a" onClose={(key) => setTabs((t) => t.filter((x) => `${x.kind}:${x.id}` !== key))} onCloseAll={() => setTabs([])} />
      </div>
      <div className="grid lg:h-[720px] grid-cols-1 gap-4 lg:grid-cols-2 lg:grid-rows-1">
        {CANDIDATES.map((c) => (
          <CandidatePane key={c.id} id={c.id} view={views[c.id]} onView={(v) => setViews((s) => ({ ...s, [c.id]: v }))} onClose={() => {}} />
        ))}
      </div>
    </div>
  );
}
