"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import posthog from "posthog-js";
import CandidateResult from "@/components/CandidateResult";
import DashboardNav from "@/components/DashboardNav";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_LOADING_MS = 900;
const SCORING_VERSION = "2026-07-v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEEDBACK_DOWN_REASONS = [
  "Missed a key skill",
  "Got seniority wrong",
  "Missed a red flag",
  "Score too high",
  "Score too low",
  "Other",
];

const STAGES = [
  "Reading CV",
  "Parsing job description",
  "Analysing candidate fit",
  "Generating score",
];

const STAGE_DETAILS = [
  {
    detail:
      "Extracting text, contact details, and section structure",
    reveals: ["contact"],
  },
  {
    detail:
      "Identifying must-haves vs nice-to-haves in the role",
    reveals: ["skills"],
  },
  {
    detail:
      "Comparing skills, seniority, and experience against the role",
    reveals: ["experience", "education"],
  },
  {
    detail:
      "Weighing the evidence into a final, explainable score",
    reveals: ["score"],
  },
];

const EXTRACTED_FIELDS = [
  { key: "contact", label: "Contact details" },
  { key: "skills", label: "Skills" },
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "score", label: "Match score" },
];

const THIN_CV_BYTES = 15 * 1024;

function isLikelyThinCv(file) {
  return !!file && file.size > 0 && file.size < THIN_CV_BYTES;
}

const ACCEPTED_CV_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ACCEPTED_CV_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
];

const ACCEPTED_CV_INPUT_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ACCEPTED_JOB_TYPES = [
  ...ACCEPTED_CV_TYPES,
  "text/plain",
];

const ACCEPTED_JOB_EXTENSIONS = [
  ...ACCEPTED_CV_EXTENSIONS,
  ".txt",
];

const ACCEPTED_JOB_INPUT_ACCEPT =
  ACCEPTED_CV_INPUT_ACCEPT +
  ",.txt,text/plain";

const PRESET_JOBS = [
  {
    id: "sales-exec",
    title: "Sales Executive",
    tag: "Sales",
    level: "Mid-level",
    highlights: [
      "2+ yrs B2B sales",
      "Quota track record",
      "Outbound prospecting",
    ],
    text: `We're looking for a Sales Executive to join a fast-growing team.

- 2+ years B2B sales experience
- Track record of hitting quota
- Strong communication and negotiation skills
- Comfortable with outbound prospecting`,
  },
  {
    id: "sales-sdr",
    title: "SDR / BDR",
    tag: "Sales",
    level: "Entry-level",
    highlights: [
      "0-2 yrs experience",
      "High-volume outreach",
      "Pipeline generation",
    ],
    text: `We're hiring a Sales/Business Development Representative to generate pipeline.

- 0-2 years in outbound sales or customer-facing work
- Comfortable with high-volume cold outreach (calls, email, LinkedIn)
- Organised, target-driven, coachable
- Strong written and verbal communication`,
  },
  {
    id: "software-eng",
    title: "Software Engineer",
    tag: "Engineering",
    level: "Mid-level",
    highlights: [
      "3+ yrs experience",
      "JS/TypeScript",
      "Ships production code",
    ],
    text: `Seeking a Software Engineer to join our product team.

- 3+ years professional software development experience
- Proficiency in JavaScript/TypeScript
- Experience shipping and maintaining production code
- Comfortable working in an agile team`,
  },
  {
    id: "software-eng-sr",
    title: "Senior Software Engineer",
    tag: "Engineering",
    level: "Senior",
    highlights: [
      "6+ yrs experience",
      "System design",
      "Mentors juniors",
    ],
    text: `Seeking a Senior Software Engineer to help lead our product team.

- 6+ years professional software development experience
- Strong system design and architecture skills
- Experience mentoring junior engineers
- Track record of owning projects end to end`,
  },
  {
    id: "ops-manager",
    title: "Operations Manager",
    tag: "Operations",
    level: "Senior",
    highlights: [
      "5+ yrs managing teams",
      "Process improvement",
      "P&L ownership",
    ],
    text: `Operations Manager needed to run day-to-day operations.

- 5+ years managing operational teams
- Process improvement experience
- Budget and P&L ownership
- Strong stakeholder management`,
  },
  {
    id: "customer-success",
    title: "Customer Success Manager",
    tag: "Customer Success",
    level: "Mid-level",
    highlights: [
      "2+ yrs in CS/AM",
      "SaaS preferred",
      "Owns renewals",
    ],
    text: `Customer Success Manager to own our key accounts.

- 2+ years in a CS or account management role
- SaaS experience preferred
- Excellent stakeholder management
- Comfortable owning renewals and upsell conversations`,
  },
];

const PRESET_CATEGORIES = [
  "All",
  ...Array.from(
    new Set(PRESET_JOBS.map((p) => p.tag))
  ),
];

function findDuplicateCv(file) {
  if (!file) return null;

  const history = ls(
    "analysisHistory",
    []
  );

  return history.find(
    (h) => h.cvName === file.name
  ) || null;
}

function isAcceptedCvFile(file) {
  if (!file) return false;

  if (ACCEPTED_CV_TYPES.includes(file.type)) {
    return true;
  }

  const name = (
    file.name || ""
  ).toLowerCase();

  return ACCEPTED_CV_EXTENSIONS.some(
    (ext) => name.endsWith(ext)
  );
}

function isAcceptedJobFile(file) {
  if (!file) return false;

  if (
    ACCEPTED_JOB_TYPES.includes(file.type)
  ) {
    return true;
  }

  const name = (
    file.name || ""
  ).toLowerCase();

  return ACCEPTED_JOB_EXTENSIONS.some(
    (ext) => name.endsWith(ext)
  );
}

function formatBytes(bytes) {
  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)}MB`;
}

function ls(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value =
      localStorage.getItem(key);

    return value !== null
      ? JSON.parse(value)
      : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {
    // Ignore localStorage failures.
  }
}

function exportRecruiterData() {
  const payload = {
    exportedAt:
      new Date().toISOString(),
    analysisHistory: ls(
      "analysisHistory",
      []
    ),
    shortlist: ls(
      "shortlist",
      []
    ),
    jobTemplates: ls(
      "jobTemplates",
      []
    ),
    feedbackCount: ls(
      "feedbackCount",
      0
    ),
  };

  const blob = new Blob(
    [
      JSON.stringify(
        payload,
        null,
        2
      ),
    ],
    {
      type: "application/json",
    }
  );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;

  a.download = `helixon-data-export-${Date.now()}.json`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

function clearAllRecruiterData() {
  [
    "analysisHistory",
    "shortlist",
    "jobTemplates",
    "feedbackCount",
  ].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore localStorage failures.
    }
  });
}

function Toast({ toasts }) {
  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toastItem) => (
        <div
          key={toastItem.id}
          className={`px-4 py-2.5 rounded-[10px] text-xs font-semibold shadow-lg transition-all ${
            toastItem.type === "success"
              ? "bg-[#0b6e4f] text-white"
              : toastItem.type === "error"
                ? "bg-red-600 text-white"
                : "bg-[#13201b] text-white"
          }`}
        >
          {toastItem.message}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] =
    useState([]);

  function toast(
    message,
    type = "success"
  ) {
    const id =
      Date.now() + Math.random();

    setToasts((current) => [
      ...current,
      {
        id,
        message,
        type,
      },
    ]);

    setTimeout(() => {
      setToasts((current) =>
        current.filter(
          (item) =>
            item.id !== id
        )
      );
    }, 2500);
  }

  return {
    toasts,
    toast,
  };
}

function ComparePanel({
  result,
  compareResult,
  onClose,
}) {
  const rows = [
    {
      label: "Overall",
      a: result.match_score,
      b: compareResult.match_score,
    },
    {
      label: "Skills",
      a: result.skill_score ?? 0,
      b: compareResult.skill_score ?? 0,
    },
    {
      label: "Experience",
      a: result.experience_score ?? 0,
      b:
        compareResult.experience_score ??
        0,
    },
  ];

  return (
    <div className="card px-6 py-5 mt-3">
      <div className="flex items-center justify-between mb-4">
        <h3
          style={{
            fontFamily:
              "var(--font-display)",
          }}
          className="text-xs font-semibold text-[#13201b] tracking-tight"
        >
          Comparing candidates
        </h3>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close comparison"
          className="text-[10px] text-[#5a7a6a] hover:text-[#13201b] transition-colors px-2 py-1 rounded-lg hover:bg-[#f3f6f4]"
        >
          ✕ Close
        </button>
      </div>

      <div className="flex gap-4 mb-4 text-[10px]">
        <span className="flex items-center gap-1.5 text-[#5a7a6a]">
          <span className="w-2 h-2 rounded-full bg-[#0b6e4f] inline-block" />
          {result.blind_mode
            ? "Candidate A"
            : result.name ||
              "Candidate A"}
        </span>

        <span className="flex items-center gap-1.5 text-[#5a7a6a]">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          {compareResult.blind_mode
            ? "Candidate B"
            : compareResult.name ||
              "Candidate B"}
        </span>
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-[10px] text-[#5a7a6a] mb-1.5">
              <span>{row.label}</span>

              <span className="flex gap-3">
                <span className="text-[#0b6e4f] font-semibold">
                  {row.a}
                </span>

                <span className="text-blue-500 font-semibold">
                  {row.b}
                </span>
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-[#e8f3ee] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0b6e4f] transition-all duration-700"
                style={{
                  width: `${row.a}%`,
                }}
              />
            </div>

            <div className="h-1.5 rounded-full bg-blue-50 overflow-hidden mt-1">
              <div
                className="h-full rounded-full bg-blue-400 transition-all duration-700"
                style={{
                  width: `${row.b}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPanel({
  version,
  onCleared,
}) {
  const [data, setData] =
    useState(undefined);

  const [
    confirmingClear,
    setConfirmingClear,
  ] = useState(false);

  useEffect(() => {
    const history = ls(
      "analysisHistory",
      []
    );

    const total =
      history.length;

    if (total === 0) {
      setData({
        empty: true,
      });
      return;
    }

    let scoreSum = 0;
    let strong = 0;

    const bandCounts = [
      0,
      0,
      0,
      0,
    ];

    for (const historyItem of history) {
      const score =
        historyItem.matchScore ||
        0;

      scoreSum += score;

      if (
        historyItem.recommendation ===
        "Strong match"
      ) {
        strong++;
      }

      if (score < 40) {
        bandCounts[0]++;
      } else if (score < 60) {
        bandCounts[1]++;
      } else if (score < 80) {
        bandCounts[2]++;
      } else {
        bandCounts[3]++;
      }
    }

    const avgScore =
      Math.round(
        scoreSum / total
      );

    const shortlist =
      ls(
        "shortlist",
        []
      ).length;

    const bands = [
      {
        label: "0–40",
        count: bandCounts[0],
      },
      {
        label: "40–60",
        count: bandCounts[1],
      },
      {
        label: "60–80",
        count: bandCounts[2],
      },
      {
        label: "80–100",
        count: bandCounts[3],
      },
    ];

    setData({
      total,
      avgScore,
      strong,
      shortlist,
      bands,
    });
  }, [version]);

  if (data === undefined) {
    return (
      <div
        className="card p-7 mb-6 animate-pulse"
        aria-hidden="true"
      >
        <div className="h-4 w-28 rounded bg-[#e8ede9] mb-5" />

        <div className="grid grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map(
            (index) => (
              <div
                key={index}
                className="bg-[#f3f6f4] rounded-[10px] p-4 h-16"
              />
            )
          )}
        </div>

        <div className="h-14 rounded bg-[#f3f6f4]" />
      </div>
    );
  }

  if (data.empty) {
    return null;
  }

  const {
    total,
    avgScore,
    strong,
    shortlist,
    bands,
  } = data;

  const maxBand = Math.max(
    ...bands.map(
      (band) => band.count
    ),
    1
  );

  return (
    <div className="card p-7 mb-6">
      <div className="flex items-start justify-between mb-5">
        <h2
          style={{
            fontFamily:
              "var(--font-display)",
          }}
          className="text-sm font-semibold text-[#13201b] tracking-tight"
        >
          Your activity
        </h2>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={
              exportRecruiterData
            }
            className="text-[10px] font-medium transition-colors"
            style={{
              color: "#5a7a6a",
            }}
          >
            Export my data
          </button>

          {!confirmingClear ? (
            <button
              type="button"
              onClick={() =>
                setConfirmingClear(
                  true
                )
              }
              className="text-[10px] font-medium transition-colors"
              style={{
                color: "#b0c4ba",
              }}
            >
              Delete my data
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px]">
              <span
                style={{
                  color: "#5a7a6a",
                }}
              >
                Delete everything?
              </span>

              <button
                type="button"
                onClick={() => {
                  clearAllRecruiterData();
                  setConfirmingClear(
                    false
                  );
                  onCleared?.();
                }}
                className="font-semibold"
                style={{
                  color: "var(--score-low)",
                }}
              >
                Yes
              </button>

              <button
                type="button"
                onClick={() =>
                  setConfirmingClear(
                    false
                  )
                }
                style={{
                  color: "#5a7a6a",
                }}
              >
                Cancel
              </button>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Analyses",
            val: total,
          },
          {
            label: "Avg score",
            val: avgScore,
          },
          {
            label: "Strong match",
            val: strong,
          },
          {
            label: "Shortlisted",
            val: shortlist,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="bg-[#f3f6f4] rounded-[10px] p-4"
          >
            <p className="text-[10px] text-[#5a7a6a] mb-1 uppercase tracking-wide font-medium">
              {metric.label}
            </p>

            <p
              style={{
                fontFamily:
                  "var(--font-mono)",
              }}
              className="text-2xl font-semibold text-[#13201b]"
            >
              {metric.val}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[10px] font-semibold text-[#5a7a6a] uppercase tracking-widest mb-3">
        Score distribution
      </p>

      <div className="flex gap-2 items-end h-14">
        {bands.map((band) => (
          <div
            key={band.label}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{
                height: `${Math.round(
                  (band.count /
                    maxBand) *
                    48
                )}px`,
                minHeight: band.count
                  ? 4
                  : 0,
                background:
                  band.label ===
                    "80–100" ||
                  band.label ===
                    "60–80"
                    ? "#0b6e4f"
                    : "#e3e8e5",
              }}
            />

            <span className="text-[9px] text-[#5a7a6a]">
              {band.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaleCandidatesBanner({
  version,
}) {
  const [stale, setStale] =
    useState(null);

  const [
    dismissed,
    setDismissed,
  ] = useState(false);

  useEffect(() => {
    const history = ls(
      "analysisHistory",
      []
    );

    const now = Date.now();

    const SEVEN_DAYS =
      7 *
      24 *
      60 *
      60 *
      1000;

    const staleOnes =
      history.filter(
        (historyItem) => {
          if (!historyItem.timestamp) {
            return false;
          }

          const age =
            now -
            new Date(
              historyItem.timestamp
            ).getTime();

          const strong =
            historyItem.recommendation ===
              "Strong match" ||
            (historyItem.matchScore ||
              0) >= 75;

          return (
            strong &&
            age > SEVEN_DAYS
          );
        }
      );

    setStale(staleOnes);
  }, [version]);

  if (
    dismissed ||
    !stale ||
    stale.length === 0
  ) {
    return null;
  }

  return (
    <div
      className="card px-5 py-3.5 mb-6 flex items-center gap-3"
      style={{
        background: "#fef3e8",
        border:
          "1px solid #fbdcb4",
      }}
    >
      <span
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs"
        style={{
          background: "#fde3bd",
          color: "#b45309",
        }}
        aria-hidden="true"
      >
        ⏰
      </span>

      <p
        className="flex-1 text-xs"
        style={{
          color: "#92400e",
        }}
      >
        <span className="font-semibold">
          {stale.length} strong{" "}
          {stale.length ===
          1
            ? "match hasn't"
            : "matches haven't"}
        </span>{" "}
        been followed up on in over a
        week
        {stale[0]?.cvName
          ? ` - including ${stale[0].cvName}`
          : ""}
        . Worth a nudge before they go
        cold.
      </p>

      <button
        type="button"
        onClick={() =>
          setDismissed(true)
        }
        aria-label="Dismiss stale candidates notice"
        className="shrink-0 text-[11px] px-2 py-1 rounded-md transition-colors"
        style={{
          color: "#b45309",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

function FeedbackTrustNote({
  version,
}) {
  const [count, setCount] =
    useState(0);

  useEffect(() => {
    setCount(
      ls("feedbackCount", 0)
    );
  }, [version]);

  if (!count) {
    return null;
  }

  return (
    <p
      className="text-[10px] mt-2"
      style={{
        color: "#8aaa9a",
      }}
    >
      You&apos;ve rated{" "}
      {count} analys
      {count === 1 ? "is" : "es"} -
      thanks, this helps improve
      future scoring.
    </p>
  );
}

function EmptyScoreRing() {
  return (
    <div className="relative w-[72px] h-[72px] rounded-full overflow-hidden">
      <div
        className="scan-sweep"
        aria-hidden="true"
      />

      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="36"
          cy="36"
          r="28"
          stroke="#e3e8e5"
          strokeWidth="7"
          fill="none"
        />

        <circle
          cx="36"
          cy="36"
          r="28"
          stroke="#0b6e4f"
          strokeWidth="7"
          fill="none"
          strokeDasharray="176"
          strokeDashoffset="132"
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          opacity="0.25"
        />

        <text
          x="36"
          y="41"
          textAnchor="middle"
          style={{
            fontFamily:
              "var(--font-mono)",
            fontSize: 13,
            fontWeight: 600,
            fill: "#c8d8ce",
          }}
        >
          -
        </text>
      </svg>
    </div>
  );
}

function UploadIcon({
  className,
}) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line
        x1="12"
        y1="3"
        x2="12"
        y2="15"
      />
    </svg>
  );
}

const WIZARD_STEPS = [
  "Name",
  "Job",
  "Upload",
  "Scan",
];

function WizardProgress({
  step,
}) {
  return (
    <div className="flex items-center gap-2 mb-8 w-full max-w-xs mx-auto">
      {WIZARD_STEPS.map(
        (label, index) => (
          <div
            key={label}
            className="flex items-center gap-2 flex-1"
          >
            <div
              className="h-1.5 flex-1 rounded-full overflow-hidden transition-colors duration-300"
              style={{
                background:
                  index <= step
                    ? "var(--forest)"
                    : "var(--border)",
              }}
            />
          </div>
        )
      )}
    </div>
  );
}

function AnalysisFlow({
  analysisName,
  setAnalysisName,
  jobText,
  setJobText,
  jobFile,
  onJobFileChange,
  onJobFileDrop,
  jobClientEmail,
  setJobClientEmail,
  file,
  onFileChange,
  onDrop,
  error,
  setError,
  loading,
  stage,
  onStartScan,
  onFinish,
}) {
  const [step, setStep] =
    useState(0);

  const [
    selectedPreset,
    setSelectedPreset,
  ] = useState(null);

  const [
    jobMode,
    setJobMode,
  ] = useState(null);

  const [
    activeCategory,
    setActiveCategory,
  ] = useState("All");

  const [
    jobDragOver,
    setJobDragOver,
  ] = useState(false);

  const [
    transitioning,
    setTransitioning,
  ] = useState(false);

  function goTo(next) {
    setTransitioning(
      true
    );

    setTimeout(() => {
      setStep(next);
      setTransitioning(
        false
      );
    }, 200);
  }

  function pickPreset(preset) {
    setSelectedPreset(
      preset.id
    );

    setJobText(preset.text);

    onJobFileChange(null);
  }

  function chooseMode(mode) {
    setJobMode(mode);

    if (mode !== "preset") {
      setSelectedPreset(
        null
      );
    }

    if (mode !== "upload") {
      onJobFileChange(null);
    }
  }

  const canContinueFromJob =
    jobMode === "upload"
      ? !!jobFile
      : jobText.trim()
          .length > 0;

  function enterScanning() {
    goTo(3);

    setTimeout(
      () => onStartScan(),
      220
    );
  }

  const filteredPresets =
    activeCategory ===
    "All"
      ? PRESET_JOBS
      : PRESET_JOBS.filter(
          (preset) =>
            preset.tag ===
            activeCategory
        );

  return (
    <>
      {/* Same persistent nav every other dashboard page uses (Overview,
          Analyse, Candidates, etc.) - previously missing here, so
          actually running an analysis dropped you into an isolated
          full-screen wizard with no way back to the dashboard short of
          the browser back button. */}
      <DashboardNav />

      <main
        className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6 transition-all duration-200"
        style={{
          background:
            "var(--mist)",
          opacity:
            transitioning
              ? 0
              : 1,
          transform:
            transitioning
              ? "translateY(8px)"
              : "translateY(0)",
        }}
      >
      {step < 3 && (
        <div className="fixed top-[72px] left-0 right-0">
          <WizardProgress
            step={step}
          />
        </div>
      )}

      {step === 0 && (
        <div className="w-full max-w-md text-center">
          <div
            className="w-8 h-8 rounded-[9px] flex items-center justify-center mx-auto mb-8"
            style={{
              background:
                "var(--forest)",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="4"
                y="9"
                width="12"
                height="4.5"
                rx="2.25"
                fill="white"
                opacity="0.55"
              />
              <rect
                x="12"
                y="15.5"
                width="12"
                height="4.5"
                rx="2.25"
                fill="white"
              />
              <circle
                cx="22.5"
                cy="10.5"
                r="1.8"
                fill="var(--signal)"
              />
            </svg>
          </div>

          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{
              color: "#8aaa9a",
            }}
          >
            Step 1 of 4
          </p>

          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3"
            style={{
              color: "#13201b",
              fontFamily:
                "var(--font-display)",
            }}
          >
            Name this analysis
          </h1>

          <p
            className="text-xs mb-9 leading-relaxed"
            style={{
              color: "#5a7a6a",
            }}
          >
            e.g. the role or client it&apos;s
            for - this helps you find it later
            in your History.
          </p>

          <input
            autoFocus
            value={analysisName}
            onChange={(event) =>
              setAnalysisName(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                  "Enter" &&
                analysisName.trim()
              ) {
                goTo(1);
              }
            }}
            placeholder="e.g. Senior Sales Exec - Acme Ltd"
            className="w-full text-sm text-center px-4 py-3.5 rounded-[10px] outline-none transition-all mb-6"
            style={{
              border:
                "1px solid var(--border)",
              background:
                "white",
              color: "#13201b",
              fontFamily:
                "var(--font-body)",
            }}
            onFocus={(event) =>
              (event.target.style.boxShadow =
                "0 0 0 3px rgba(11,110,79,0.12)")
            }
            onBlur={(event) =>
              (event.target.style.boxShadow =
                "none")
            }
          />

          <button
            type="button"
            onClick={() =>
              analysisName.trim() &&
              goTo(1)
            }
            disabled={
              !analysisName.trim()
            }
            className="w-full font-semibold py-3.5 rounded-[10px] text-xs transition-all text-white"
            style={{
              background:
                analysisName.trim()
                  ? "var(--forest)"
                  : "var(--border)",
              color:
                analysisName.trim()
                  ? "white"
                  : "#8aaa9a",
              cursor:
                analysisName.trim()
                  ? "pointer"
                  : "not-allowed",
              boxShadow:
                analysisName.trim()
                  ? "0 4px 14px -4px rgba(11,110,79,0.4)"
                  : "none",
            }}
          >
            Continue →
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="w-full max-w-2xl">
          <button
            type="button"
            onClick={() =>
              goTo(0)
            }
            className="text-[11px] font-medium mb-6 flex items-center gap-1 transition-colors"
            style={{
              color: "#5a7a6a",
            }}
          >
            ← Back
          </button>

          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{
              color: "#8aaa9a",
            }}
          >
            Step 2 of 4 ·{" "}
            {analysisName}
          </p>

          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2"
            style={{
              color: "#13201b",
              fontFamily:
                "var(--font-display)",
            }}
          >
            How do you want to add the role?
          </h1>

          <p
            className="text-xs mb-7"
            style={{
              color: "#5a7a6a",
            }}
          >
            Pick a preset role, upload the job
            spec you already have, or write
            your own.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-7">
            {[
              {
                id: "preset",
                label: "Preset role",
                sub: `${PRESET_JOBS.length} templates`,
                icon: "📋",
              },
              {
                id: "upload",
                label: "Upload spec",
                sub: "PDF, Word or .txt",
                icon: "📤",
              },
              {
                id: "custom",
                label: "Write my own",
                sub: "Paste or type",
                icon: "✎",
              },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  chooseMode(
                    option.id
                  )
                }
                className="text-center p-4 rounded-[12px] transition-all"
                style={{
                  border: `1.5px solid ${
                    jobMode ===
                    option.id
                      ? "var(--forest)"
                      : "var(--border)"
                  }`,
                  background:
                    jobMode ===
                    option.id
                      ? "#f0f9f4"
                      : "white",
                }}
              >
                <span
                  className="text-lg block mb-1.5"
                  aria-hidden="true"
                >
                  {option.icon}
                </span>

                <p
                  className="text-xs font-semibold"
                  style={{
                    color:
                      "#13201b",
                  }}
                >
                  {option.label}
                </p>

                <p
                  className="text-[10px] mt-0.5"
                  style={{
                    color:
                      "#8aaa9a",
                  }}
                >
                  {option.sub}
                </p>
              </button>
            ))}
          </div>

          {jobMode ===
            "preset" && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-1.5 mb-4">
                {PRESET_CATEGORIES.map(
                  (category) => (
                    <button
                      key={
                        category
                      }
                      type="button"
                      onClick={() =>
                        setActiveCategory(
                          category
                        )
                      }
                      className="text-[10px] font-semibold px-3 py-1.5 rounded-full transition-all"
                      style={{
                        background:
                          activeCategory ===
                          category
                            ? "var(--forest)"
                            : "var(--mint)",
                        color:
                          activeCategory ===
                          category
                            ? "white"
                            : "var(--forest)",
                      }}
                    >
                      {category}
                    </button>
                  )
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {filteredPresets.map(
                  (preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        pickPreset(
                          preset
                        )
                      }
                      className="text-left p-4 rounded-[12px] transition-all"
                      style={{
                        border: `1.5px solid ${
                          selectedPreset ===
                          preset.id
                            ? "var(--forest)"
                            : "var(--border)"
                        }`,
                        background:
                          selectedPreset ===
                          preset.id
                            ? "#f0f9f4"
                            : "white",
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background:
                              "var(--mint)",
                            color:
                              "var(--forest)",
                          }}
                        >
                          {preset.tag}
                        </span>

                        <span
                          className="text-[9px]"
                          style={{
                            color:
                              "#8aaa9a",
                          }}
                        >
                          {preset.level}
                        </span>
                      </div>

                      <p
                        className="text-xs font-semibold mb-2"
                        style={{
                          color:
                            "#13201b",
                        }}
                      >
                        {preset.title}
                      </p>

                      <ul className="space-y-1">
                        {preset.highlights.map(
                          (
                            highlight
                          ) => (
                            <li
                              key={
                                highlight
                              }
                              className="text-[10px] flex items-start gap-1.5"
                              style={{
                                color:
                                  "#5a7a6a",
                              }}
                            >
                              <span
                                style={{
                                  color:
                                    "var(--forest)",
                                }}
                              >
                                ✓
                              </span>
                              {highlight}
                            </li>
                          )
                        )}
                      </ul>

                      {selectedPreset ===
                        preset.id && (
                        <p
                          className="text-[10px] mt-2 font-medium"
                          style={{
                            color:
                              "var(--forest)",
                          }}
                        >
                          ✓ Selected - you can
                          still edit it below
                        </p>
                      )}
                    </button>
                  )
                )}
              </div>

              {selectedPreset && (
                <textarea
                  value={jobText}
                  onChange={(event) =>
                    setJobText(
                      event.target.value
                    )
                  }
                  rows={6}
                  placeholder="Edit the preset job description here…"
                  className="w-full p-3.5 text-xs mt-4 resize-none outline-none rounded-[10px] transition-all"
                  style={{
                    border:
                      "1px solid var(--border)",
                    background:
                      "white",
                    color:
                      "#13201b",
                    fontFamily:
                      "var(--font-body)",
                  }}
                  onFocus={(event) =>
                    (event.target.style.boxShadow =
                      "0 0 0 3px rgba(11,110,79,0.12)")
                  }
                  onBlur={(event) =>
                    (event.target.style.boxShadow =
                      "none")
                  }
                />
              )}
            </div>
          )}

          {jobMode ===
            "upload" && (
            <div className="mb-6">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setJobDragOver(
                    true
                  );
                }}
                onDragLeave={() =>
                  setJobDragOver(false)
                }
                onDrop={(event) => {
                  setJobDragOver(
                    false
                  );
                  onJobFileDrop(
                    event
                  );
                }}
                onClick={() =>
                  !jobFile &&
                  document
                    .getElementById(
                      "job-input-wizard"
                    )
                    ?.click()
                }
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (
                    !jobFile &&
                    (event.key ===
                      "Enter" ||
                      event.key ===
                        " ")
                  ) {
                    event.preventDefault();

                    document
                      .getElementById(
                        "job-input-wizard"
                      )
                      ?.click();
                  }
                }}
                aria-label="Upload job description file"
                className="rounded-[14px] p-8 text-center select-none transition-all"
                style={{
                  cursor: jobFile
                    ? "default"
                    : "pointer",
                  border: `2px dashed ${
                    jobDragOver
                      ? "var(--forest)"
                      : jobFile
                        ? "var(--forest)"
                        : "var(--border)"
                  }`,
                  background:
                    jobDragOver
                      ? "var(--mint)"
                      : jobFile
                        ? "#f0f9f4"
                        : "white",
                  transform:
                    jobDragOver
                      ? "scale(1.015)"
                      : "scale(1)",
                }}
              >
                <input
                  id="job-input-wizard"
                  type="file"
                  accept={
                    ACCEPTED_JOB_INPUT_ACCEPT
                  }
                  className="hidden"
                  onChange={
                    onJobFileChange
                  }
                />

                {jobFile ? (
                  <div className="flex items-center gap-4 text-left">
                    <div
                      className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
                      style={{
                        background:
                          "white",
                        border:
                          "1px solid var(--border)",
                      }}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--forest)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <polyline points="9 15 11 17 15 13" />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{
                          color:
                            "#13201b",
                        }}
                      >
                        {jobFile.name}
                      </p>

                      <p
                        className="text-[11px] mt-0.5"
                        style={{
                          color:
                            "#5a7a6a",
                        }}
                      >
                        {formatBytes(
                          jobFile.size
                        )}{" "}
                        ·{" "}
                        {(
                          jobFile.type.split(
                            "/"
                          )[1] ||
                          jobFile.name
                            .split(".")
                            .pop() ||
                          "file"
                        ).toUpperCase()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onJobFileChange(
                          null
                        );
                      }}
                      className="text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors shrink-0"
                      style={{
                        color:
                          "var(--score-low)",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <UploadIcon className="text-[#b0c4ba]" />

                    <p
                      className="text-sm font-semibold"
                      style={{
                        color:
                          "#13201b",
                      }}
                    >
                      Drop the job spec here or click to
                      upload
                    </p>

                    <p
                      className="text-[11px]"
                      style={{
                        color:
                          "#5a7a6a",
                      }}
                    >
                      PDF, Word or .txt · max 10 MB
                    </p>
                  </div>
                )}
              </div>

              <p
                className="text-[10px] mt-3"
                style={{
                  color:
                    "#8aaa9a",
                }}
              >
                We&apos;ll extract the text from
                your file automatically - no need
                to retype it.
              </p>
            </div>
          )}

          {jobMode ===
            "custom" && (
            <textarea
              autoFocus
              value={jobText}
              onChange={(event) =>
                setJobText(
                  event.target.value
                )
              }
              rows={8}
              placeholder="Paste or write the job description here…"
              className="w-full p-3.5 text-xs mb-2 resize-none outline-none rounded-[10px] transition-all"
              style={{
                border:
                  "1px solid var(--border)",
                background:
                  "white",
                color:
                  "#13201b",
                fontFamily:
                  "var(--font-body)",
              }}
              onFocus={(event) =>
                (event.target.style.boxShadow =
                  "0 0 0 3px rgba(11,110,79,0.12)")
              }
              onBlur={(event) =>
                (event.target.style.boxShadow =
                  "none")
              }
            />
          )}

          {jobMode && (
            <div className="mb-6">
              <label
                htmlFor="job-client-email"
                className="text-xs font-semibold block mb-1.5"
                style={{
                  color:
                    "#13201b",
                }}
              >
                Client contact email{" "}
                <span
                  className="font-normal"
                  style={{
                    color:
                      "#8aaa9a",
                  }}
                >
                  (optional)
                </span>
              </label>

              <input
                id="job-client-email"
                type="email"
                value={jobClientEmail}
                onChange={(event) =>
                  setJobClientEmail(
                    event.target
                      .value
                  )
                }
                placeholder="client@company.com"
                className="w-full text-xs px-3.5 py-3 rounded-[10px] outline-none transition-all"
                style={{
                  border:
                    "1px solid var(--border)",
                  background:
                    "white",
                  color:
                    "#13201b",
                  fontFamily:
                    "var(--font-body)",
                }}
                onFocus={(event) =>
                  (event.target.style.boxShadow =
                    "0 0 0 3px rgba(11,110,79,0.12)")
                }
                onBlur={(event) =>
                  (event.target.style.boxShadow =
                    "none")
                }
              />

              <p
                className="text-[10px] mt-1.5"
                style={{
                  color:
                    "#8aaa9a",
                }}
              >
                Lets you send shortlist updates
                and feedback chasers straight
                from a scored candidate.
              </p>
            </div>
          )}

          {jobMode && (
            <button
              type="button"
              onClick={() =>
                canContinueFromJob &&
                goTo(2)
              }
              disabled={
                !canContinueFromJob
              }
              className="w-full font-semibold py-3.5 rounded-[10px] text-xs transition-all text-white mt-2"
              style={{
                background:
                  canContinueFromJob
                    ? "var(--forest)"
                    : "var(--border)",
                color:
                  canContinueFromJob
                    ? "white"
                    : "#8aaa9a",
                cursor:
                  canContinueFromJob
                    ? "pointer"
                    : "not-allowed",
                boxShadow:
                  canContinueFromJob
                    ? "0 4px 14px -4px rgba(11,110,79,0.4)"
                    : "none",
              }}
            >
              Continue to upload →
            </button>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="w-full max-w-lg">
          <button
            type="button"
            onClick={() =>
              goTo(1)
            }
            className="text-[11px] font-medium mb-6 flex items-center gap-1 transition-colors"
            style={{
              color: "#5a7a6a",
            }}
          >
            ← Back
          </button>

          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2 text-center"
            style={{
              color: "#8aaa9a",
            }}
          >
            Step 3 of 4 ·{" "}
            {analysisName}
          </p>

          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2 text-center"
            style={{
              color: "#13201b",
              fontFamily:
                "var(--font-display)",
            }}
          >
            Upload the CV
          </h1>

          <p
            className="text-xs mb-6 text-center"
            style={{
              color:
                "#5a7a6a",
            }}
          >
            Drop it in or click to browse - PDF or
            Word, max 10 MB.
          </p>

          <div className="flex items-center justify-center gap-1.5 mb-6 flex-wrap">
            {[
              ".pdf",
              ".doc",
              ".docx",
            ].map((extension) => (
              <span
                key={extension}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background:
                    "var(--mint)",
                  color:
                    "var(--forest)",
                }}
              >
                {extension}
              </span>
            ))}

            <span
              className="text-[10px] px-2.5 py-1 rounded-full"
              style={{
                background:
                  "var(--border-soft, var(--border))",
                color:
                  "#5a7a6a",
              }}
            >
              max 10 MB
            </span>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDragEnter={(event) => {
              event.preventDefault();
            }}
            onDragLeave={() => {}}
            onDrop={onDrop}
            onClick={() =>
              !file &&
              document
                .getElementById(
                  "cv-input-wizard"
                )
                ?.click()
            }
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (
                !file &&
                (event.key ===
                  "Enter" ||
                  event.key ===
                    " ")
              ) {
                event.preventDefault();

                document
                  .getElementById(
                    "cv-input-wizard"
                  )
                  ?.click();
              }
            }}
            aria-label="Upload CV file"
            className="rounded-[14px] p-8 text-center mb-4 select-none transition-all"
            style={{
              cursor: file
                ? "default"
                : "pointer",
              border: `2px dashed ${
                file
                  ? "var(--forest)"
                  : "var(--border)"
              }`,
              background: file
                ? "#f0f9f4"
                : "white",
            }}
          >
            <input
              id="cv-input-wizard"
              type="file"
              accept={
                ACCEPTED_CV_INPUT_ACCEPT
              }
              className="hidden"
              onChange={
                onFileChange
              }
            />

            {file ? (
              <div className="flex items-center gap-4 text-left">
                <div
                  className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
                  style={{
                    background:
                      "white",
                    border:
                      "1px solid var(--border)",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--forest)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <polyline points="9 15 11 17 15 13" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{
                      color:
                        "#13201b",
                    }}
                  >
                    {file.name}
                  </p>

                  <p
                    className="text-[11px] mt-0.5"
                    style={{
                      color:
                        "#5a7a6a",
                    }}
                  >
                    {formatBytes(
                      file.size
                    )}{" "}
                    ·{" "}
                    {(
                      file.type.split(
                        "/"
                      )[1] ||
                      file.name
                        .split(".")
                        .pop() ||
                      "file"
                    ).toUpperCase()}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();

                      document
                        .getElementById(
                          "cv-input-wizard"
                        )
                        ?.click();
                    }}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors"
                    style={{
                      border:
                        "1px solid var(--border)",
                      color:
                        "#5a7a6a",
                      background:
                        "white",
                    }}
                  >
                    Replace
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();

                      onFileChange({
                        target: {
                          files: [],
                        },
                      });
                    }}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors"
                    style={{
                      color:
                        "var(--score-low)",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <UploadIcon className="text-[#b0c4ba]" />

                <p
                  className="text-sm font-semibold"
                  style={{
                    color:
                      "#13201b",
                  }}
                >
                  Drop CV here or click to upload
                </p>

                <p
                  className="text-[11px]"
                  style={{
                    color:
                      "#5a7a6a",
                  }}
                >
                  Text-based PDFs and Word docs
                  score most accurately
                </p>
              </div>
            )}
          </div>

          {file &&
            isLikelyThinCv(file) && (
              <div
                className="mb-4 flex items-start gap-2 px-3.5 py-3 rounded-[10px] text-[11px]"
                style={{
                  background:
                    "#fef3e8",
                  border:
                    "1px solid #fbdcb4",
                  color:
                    "#92400e",
                }}
              >
                <span className="shrink-0 mt-0.5">
                  ⓘ
                </span>

                <span className="flex-1">
                  This file is unusually small (
                  {formatBytes(
                    file.size
                  )}) for a CV - it may be a
                  scanned image or mostly-empty
                  document. Scanned pages with no
                  text layer can reduce scoring
                  accuracy since there&apos;s
                  little to extract. Worth
                  double-checking it&apos;s the
                  right file.
                </span>
              </div>
            )}

          {error && (
            <div
              role="alert"
              className="mb-4 p-3.5 rounded-[10px] text-xs flex items-start gap-2"
              style={{
                background:
                  "#fef2f2",
                border:
                  "1px solid rgba(192,57,43,0.3)",
                color:
                  "var(--score-low)",
              }}
            >
              <span className="shrink-0 mt-0.5">
                ⚠
              </span>

              <span className="flex-1">
                {error}
              </span>
            </div>
          )}

          <p
            className="text-[10px] mb-6 flex items-center gap-1.5 justify-center"
            style={{
              color:
                "#8aaa9a",
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="6"
                cy="6"
                r="5"
                stroke="currentColor"
                strokeWidth="1.2"
              />

              <path
                d="M4 6l1.5 1.5L8 4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>

            CV data is processed securely,
            held in the EU, and never used to
            train AI.
          </p>

          <button
            type="button"
            onClick={() =>
              file &&
              enterScanning()
            }
            disabled={!file}
            className="w-full font-semibold py-3.5 rounded-[10px] text-xs transition-all text-white"
            style={{
              background: file
                ? "var(--forest)"
                : "var(--border)",
              color: file
                ? "white"
                : "#8aaa9a",
              cursor: file
                ? "pointer"
                : "not-allowed",
              boxShadow: file
                ? "0 4px 14px -4px rgba(11,110,79,0.4)"
                : "none",
            }}
          >
            Scan candidate →
          </button>
        </div>
      )}

      {step === 3 && (
        <ScanningStep
          analysisName={
            analysisName
          }
          fileName={file?.name}
          fileSize={file?.size}
          loading={loading}
          stage={stage}
          error={error}
          onRetry={() =>
            onStartScan()
          }
          onChangeFile={() =>
            goTo(2)
          }
          onViewResult={
            onFinish
          }
        />
      )}
      </main>
    </>
  );
}

function ScanningStep({
  analysisName,
  fileName,
  fileSize,
  loading,
  stage,
  error,
  onRetry,
  onChangeFile,
  onViewResult,
}) {
  const done =
    !loading && !error;

  const [elapsed, setElapsed] =
    useState(0);

  useEffect(() => {
    if (!loading) {
      return;
    }

    setElapsed(0);

    const interval =
      setInterval(
        () =>
          setElapsed(
            (seconds) =>
              seconds + 1
          ),
        1000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [loading]);

  const revealedFields =
    new Set();

  for (
    let index = 0;
    index <= stage &&
    index <
      STAGE_DETAILS.length;
    index++
  ) {
    if (
      index < stage ||
      done
    ) {
      STAGE_DETAILS[
        index
      ].reveals.forEach(
        (field) =>
          revealedFields.add(
            field
          )
      );
    }
  }

  if (done) {
    EXTRACTED_FIELDS.forEach(
      (field) =>
        revealedFields.add(
          field.key
        )
    );
  }

  const confidence = done
    ? 100
    : Math.round(
        ((stage + 0.5) /
          STAGE_DETAILS.length) *
          92
      );

  function errorGuidance(
    message
  ) {
    const text =
      (
        message || ""
      ).toLowerCase();

    if (
      text.includes(
        "network"
      )
    ) {
      return "Check your connection and try again - the file wasn't sent.";
    }

    if (
      text.includes("cv") &&
      text.includes("job")
    ) {
      return "Make sure both a CV and a job description were provided before scanning.";
    }

    if (
      text.includes(
        "subscription"
      ) ||
      text.includes(
        "active plan"
      ) ||
      text.includes(
        "payment"
      )
    ) {
      return "An active Helixon subscription is required to run candidate screening.";
    }

    return "This can happen with scanned or image-only PDFs, password-protected files, or a corrupted export. Try another file or re-export the CV as a text-based PDF.";
  }

  return (
    <div className="w-full max-w-md text-center">
      <style>{`
        @keyframes helixon-scanline {
          0% {
            top: 6%;
            opacity: 0;
          }

          10% {
            opacity: 1;
          }

          90% {
            opacity: 1;
          }

          100% {
            top: 94%;
            opacity: 0;
          }
        }

        @keyframes helixon-pulse {
          0%, 100% {
            opacity: 0.4;
          }

          50% {
            opacity: 1;
          }
        }
      `}</style>

      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-1"
        style={{
          color:
            "#8aaa9a",
        }}
      >
        Step 4 of 4 ·{" "}
        {analysisName}
      </p>

      {loading ? (
        <p
          className="text-[10px] mb-5"
          style={{
            color:
              "#b0c4ba",
          }}
        >
          {elapsed}s elapsed
        </p>
      ) : (
        <div className="mb-5" />
      )}

      <div
        className="relative w-24 h-28 mx-auto mb-7 rounded-[8px] overflow-hidden"
        style={{
          background:
            "white",
          border: `1.5px solid ${
            error
              ? "var(--score-low)"
              : done
                ? "var(--forest)"
                : "var(--border)"
          }`,
        }}
      >
        <div className="p-3 pt-4 space-y-1.5">
          <div
            className="h-1.5 rounded-full"
            style={{
              width: "60%",
              background:
                "var(--border)",
            }}
          />

          <div
            className="h-1 rounded-full"
            style={{
              width: "40%",
              background:
                "var(--border-soft, var(--border))",
            }}
          />

          <div
            className="h-1 rounded-full mt-2.5"
            style={{
              width: "80%",
              background:
                "var(--border-soft, var(--border))",
            }}
          />

          <div
            className="h-1 rounded-full"
            style={{
              width: "70%",
              background:
                "var(--border-soft, var(--border))",
            }}
          />

          <div
            className="h-1 rounded-full"
            style={{
              width: "75%",
              background:
                "var(--border-soft, var(--border))",
            }}
          />

          <div
            className="h-1 rounded-full mt-2.5"
            style={{
              width: "50%",
              background:
                "var(--border-soft, var(--border))",
            }}
          />

          <div
            className="h-1 rounded-full"
            style={{
              width: "65%",
              background:
                "var(--border-soft, var(--border))",
            }}
          />
        </div>

        {loading && (
          <div
            className="absolute left-0 right-0 h-6 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(11,110,79,0) 0%, rgba(11,110,79,0.22) 50%, rgba(11,110,79,0) 100%)",
              animation:
                "helixon-scanline 1.6s ease-in-out infinite",
            }}
          />
        )}

        {done && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                "rgba(240,249,244,0.9)",
            }}
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{
                background:
                  "var(--forest)",
              }}
            >
              ✓
            </span>
          </div>
        )}

        {error && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                "rgba(254,242,242,0.92)",
            }}
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{
                background:
                  "var(--score-low)",
              }}
            >
              ⚠
            </span>
          </div>
        )}
      </div>

      <h1
        className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2"
        style={{
          color:
            "#13201b",
          fontFamily:
            "var(--font-display)",
        }}
      >
        {error
          ? "Scan failed"
          : done
            ? "Scan complete"
            : "Scanning candidate…"}
      </h1>

      <p
        className="text-xs mb-7 leading-relaxed"
        style={{
          color:
            "#5a7a6a",
        }}
      >
        {error
          ? errorGuidance(
              error
            )
          : fileName
            ? `Analysing ${fileName}${
                fileSize
                  ? ` (${formatBytes(
                      fileSize
                    )})`
                  : ""
              } against your job spec.`
            : "Running the analysis…"}
      </p>

      {!error && (
        <>
          <div
            className="rounded-[12px] p-5 mb-4 space-y-1 text-left"
            style={{
              background:
                "white",
              border:
                "1px solid var(--border-soft)",
            }}
          >
            {STAGES.map(
              (stageName, index) => {
                const active =
                  index === stage &&
                  loading;

                const complete =
                  index < stage ||
                  done;

                return (
                  <div
                    key={stageName}
                    className={`py-1.5 transition-opacity duration-300 ${
                      !complete &&
                      !active
                        ? "opacity-30"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors"
                        style={{
                          background:
                            complete
                              ? "var(--forest)"
                              : active
                                ? "var(--mint)"
                                : "var(--border)",
                          color:
                            complete
                              ? "white"
                              : active
                                ? "var(--forest)"
                                : "#b0c4ba",
                        }}
                      >
                        {complete
                          ? "✓"
                          : ""}
                      </div>

                      <span
                        className={`text-xs ${
                          active
                            ? "font-semibold"
                            : ""
                        }`}
                        style={{
                          color:
                            active
                              ? "#13201b"
                              : "#5a7a6a",
                        }}
                      >
                        {stageName}
                        {active
                          ? "…"
                          : ""}
                      </span>
                    </div>

                    {active &&
                      STAGE_DETAILS[
                        index
                      ] && (
                        <p
                          className="text-[10px] mt-1 ml-8"
                          style={{
                            color:
                              "#8aaa9a",
                            animation:
                              "helixon-pulse 1.6s ease-in-out infinite",
                          }}
                        >
                          {
                            STAGE_DETAILS[
                              index
                            ].detail
                          }
                        </p>
                      )}
                  </div>
                );
              }
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center mb-5">
            {EXTRACTED_FIELDS.map(
              (field) => {
                const found =
                  revealedFields.has(
                    field.key
                  );

                return (
                  <span
                    key={field.key}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-full transition-all duration-300 flex items-center gap-1"
                    style={{
                      background:
                        found
                          ? "var(--mint)"
                          : "var(--mist)",
                      color:
                        found
                          ? "var(--forest)"
                          : "#b0c4ba",
                      border: `1px solid ${
                        found
                          ? "var(--mint)"
                          : "var(--border-soft, var(--border))"
                      }`,
                      transform:
                        found
                          ? "scale(1)"
                          : "scale(0.96)",
                    }}
                  >
                    {found &&
                      "✓ "}
                    {field.label}
                  </span>
                );
              }
            )}
          </div>

          <div className="mb-7">
            <div
              className="flex items-center justify-between text-[10px] mb-1.5"
              style={{
                color:
                  "#8aaa9a",
              }}
            >
              <span>
                Extraction confidence
              </span>

              <span
                className="font-semibold"
                style={{
                  color: done
                    ? "var(--forest)"
                    : "#5a7a6a",
                }}
              >
                {confidence}%
              </span>
            </div>

            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{
                background:
                  "var(--border-soft, var(--border))",
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${confidence}%`,
                  background:
                    "var(--forest)",
                }}
              />
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="space-y-2.5 mb-3">
          <button
            type="button"
            onClick={onRetry}
            className="w-full font-semibold py-3.5 rounded-[10px] text-xs transition-all text-white"
            style={{
              background:
                "var(--forest)",
              boxShadow:
                "0 4px 14px -4px rgba(11,110,79,0.4)",
            }}
          >
            Retry scan
          </button>

          <button
            type="button"
            onClick={onChangeFile}
            className="w-full font-semibold py-3 rounded-[10px] text-xs transition-all"
            style={{
              border:
                "1px solid var(--border)",
              color:
                "#5a7a6a",
            }}
          >
            ← Try a different file
          </button>
        </div>
      )}

      {done && (
        <button
          type="button"
          onClick={onViewResult}
          className="w-full font-semibold py-3.5 rounded-[10px] text-xs transition-all text-white"
          style={{
            background:
              "var(--forest)",
            boxShadow:
              "0 4px 14px -4px rgba(11,110,79,0.4)",
          }}
        >
          View results →
        </button>
      )}

      {!done && !error && (
        <p
          className="text-[10px]"
          style={{
            color:
              "#b0c4ba",
          }}
        >
          This usually takes a few seconds…
        </p>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  const {
    toasts,
    toast,
  } = useToast();

  const [
    flowDone,
    setFlowDone,
  ] = useState(false);

  const [
    analysisName,
    setAnalysisName,
  ] = useState("");

  const [file, setFile] =
    useState(null);

  const [
    jobText,
    setJobText,
  ] = useState("");

  const [
    jobFile,
    setJobFile,
  ] = useState(null);

  const [
    jobClientEmail,
    setJobClientEmail,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [stage, setStage] =
    useState(0);

  const [
    result,
    setResult,
  ] = useState(null);

  const [
    candidateId,
    setCandidateId,
  ] = useState(null);

  const [jobId, setJobId] =
    useState(null);

  const [error, setError] =
    useState(null);

  const [
    feedback,
    setFeedback,
  ] = useState(null);

  const [
    feedbackSent,
    setFeedbackSent,
  ] = useState(false);

  const [
    dragOver,
    setDragOver,
  ] = useState(false);

  const [
    emailDraft,
    setEmailDraft,
  ] = useState(null);

  const [
    emailLoading,
    setEmailLoading,
  ] = useState(false);

  const [
    emailPurpose,
    setEmailPurpose,
  ] = useState(
    "invite_to_interview"
  );

  const [
    emailEdited,
    setEmailEdited,
  ] = useState("");

  const [
    emailCopied,
    setEmailCopied,
  ] = useState(false);

  const [
    recipientEmail,
    setRecipientEmail,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);

  const [sent, setSent] =
    useState(false);

  const [
    compareMode,
    setCompareMode,
  ] = useState(false);

  const [
    compareResult,
    setCompareResult,
  ] = useState(null);

  const [
    blindMode,
    setBlindMode,
  ] = useState(false);

  const [
    templates,
    setTemplates,
  ] = useState([]);

  const [
    showTemplates,
    setShowTemplates,
  ] = useState(false);

  const [
    requirements,
    setRequirements,
  ] = useState([]);

  const [
    reqDraft,
    setReqDraft,
  ] = useState("");

  const [
    isRerun,
    setIsRerun,
  ] = useState(false);

  const [
    rerunBanner,
    setRerunBanner,
  ] = useState(false);

  const [
    historyVersion,
    setHistoryVersion,
  ] = useState(0);

  const [
    feedbackVersion,
    setFeedbackVersion,
  ] = useState(0);

  const [me, setMe] = useState(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setMe(d.user); })
      .catch(() => {});
  }, []);

  const [
    uploadAnnounce,
    setUploadAnnounce,
  ] = useState("");

  const [
    duplicateWarning,
    setDuplicateWarning,
  ] = useState(null);

  const [
    feedbackReason,
    setFeedbackReason,
  ] = useState(null);

  const [
    showReasonPicker,
    setShowReasonPicker,
  ] = useState(false);

  const [
    showOnboarding,
    setShowOnboarding,
  ] = useState(false);

  const emailArtifactIdRef =
    useRef(null);

  const jobTextRef =
    useRef(null);

  const lastAnalyseOptsRef =
    useRef({});

  useEffect(() => {
    setTemplates(
      ls("jobTemplates", [])
    );

    setShowOnboarding(
      ls(
        "analysisHistory",
        []
      ).length === 0
    );
  }, []);

  useEffect(() => {
    setShowOnboarding(
      ls(
        "analysisHistory",
        []
      ).length === 0
    );
  }, [historyVersion]);

  useEffect(() => {
    if (!loading) {
      setStage(0);
      return;
    }

    const interval =
      setInterval(() => {
        setStage(
          (current) =>
            current <
            STAGES.length - 1
              ? current + 1
              : current
        );
      }, 4000);

    return () =>
      clearInterval(
        interval
      );
  }, [loading]);

  useEffect(() => {
    function onKey(event) {
      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key ===
          "Enter" &&
        !loading &&
        file &&
        jobText.trim()
      ) {
        handleAnalyse();
      }
    }

    window.addEventListener(
      "keydown",
      onKey
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKey
      );
  }, [
    loading,
    file,
    jobText,
  ]);

  useEffect(() => {
    if (result) {
      setIsRerun(false);
    }
  }, [result]);

  useEffect(() => {
    setSent(false);
  }, [emailDraft]);

  useEffect(() => {
    if (!emailDraft) {
      return;
    }

    if (
      emailPurpose ===
        "client_shortlist_update" ||
      emailPurpose ===
        "chase_feedback"
    ) {
      setRecipientEmail(
        jobClientEmail || ""
      );
    } else {
      setRecipientEmail(
        result?.email || ""
      );
    }
  }, [
    emailDraft,
    emailPurpose,
    jobClientEmail,
    result,
  ]);

  function saveCurrentJobSpec() {
    if (!jobText.trim()) {
      return;
    }

    const name =
      jobText
        .slice(0, 60)
        .trim() +
      (jobText.length > 60
        ? "…"
        : "");

    const next = [
      {
        id: crypto.randomUUID(),
        name,
        text: jobText,
        savedAt:
          new Date().toISOString(),
        uses: 0,
      },
      ...templates,
    ].slice(0, 20);

    setTemplates(next);
    lsSet(
      "jobTemplates",
      next
    );

    toast(
      "Job spec saved"
    );
  }

  function loadTemplate(
    template
  ) {
    const key =
      template.id ||
      template.savedAt;

    const next =
      templates.map(
        (item) =>
          (item.id ||
            item.savedAt) ===
          key
            ? {
                ...item,
                uses:
                  (item.uses ||
                    0) + 1,
              }
            : item
      );

    setTemplates(next);
    lsSet(
      "jobTemplates",
      next
    );

    setJobText(
      template.text
    );

    setShowTemplates(false);

    toast(
      "Template loaded"
    );
  }

  function deleteTemplate(
    template
  ) {
    const key =
      template.id ||
      template.savedAt;

    const next =
      templates.filter(
        (item) =>
          (item.id ||
            item.savedAt) !==
          key
      );

    setTemplates(next);
    lsSet(
      "jobTemplates",
      next
    );
  }

  function handleJobFileChange(
    eventOrNull
  ) {
    const chosen =
      eventOrNull === null
        ? null
        : eventOrNull.target
            ?.files?.[0] ||
          null;

    if (!chosen) {
      setJobFile(null);
      return;
    }

    if (
      !isAcceptedJobFile(
        chosen
      )
    ) {
      setError(
        "Please upload a PDF, Word (.doc/.docx) or .txt file."
      );
      return;
    }

    if (
      chosen.size >
      MAX_FILE_BYTES
    ) {
      setError(
        `That file is ${formatBytes(
          chosen.size
        )} - please choose a file under 10MB.`
      );
      return;
    }

    setError(null);

    if (
      chosen.type ===
        "text/plain" ||
      chosen.name
        .toLowerCase()
        .endsWith(".txt")
    ) {
      const reader =
        new FileReader();

      reader.onload = (
        event
      ) => {
        setJobText(
          String(
            event.target
              ?.result || ""
          )
        );
      };

      reader.readAsText(
        chosen
      );

      setJobFile(null);
    } else {
      setJobFile(
        chosen
      );
      setJobText("");
    }
  }

  function handleJobFileDrop(
    event
  ) {
    event.preventDefault();

    const dropped =
      event.dataTransfer
        .files?.[0];

    if (!dropped) {
      return;
    }

    handleJobFileChange({
      target: {
        files: [dropped],
      },
    });
  }

  async function handleAnalyse(
    opts = {}
  ) {
    const {
      rerun = false,
    } = opts;

    if (
      !file ||
      (!jobText.trim() &&
        !jobFile)
    ) {
      setError(
        "Please add a CV and a job description (paste, choose a preset, or upload a file)."
      );
      return;
    }

    lastAnalyseOptsRef.current =
      opts;

    const startedAt =
      Date.now();

    setLoading(true);
    setError(null);
    setFeedback(null);
    setFeedbackSent(false);
    setEmailDraft(null);
    setIsRerun(rerun);

    if (!compareMode) {
      setResult(null);
      setCandidateId(null);
      setCompareResult(null);
      setJobId(null);
    }

    const formData =
      new FormData();

    formData.append(
      "cv",
      file
    );

    formData.append(
      "jobText",
      jobText
    );

    if (jobFile) {
      formData.append(
        "jobFile",
        jobFile
      );
    }

    if (
      jobClientEmail.trim()
    ) {
      formData.append(
        "clientEmail",
        jobClientEmail.trim()
      );
    }

    formData.append(
      "blind",
      blindMode
        ? "true"
        : "false"
    );

    formData.append(
      "requirements",
      JSON.stringify(
        requirements
      )
    );

    try {
      const response =
        await fetch(
          "/api/run",
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response
          .json()
          .catch(() => null);

      /*
       * Subscription is enforced by the
       * server. Never attempt to decide
       * subscription state from localStorage.
       */
      if (
        response.status ===
          402 ||
        data?.upgrade
      ) {
        window.location.href =
          "/pricing?reason=subscription_required";
        return;
      }

      if (
        response.status ===
        401
      ) {
        window.location.href =
          "/login?next=%2Fanalyse";
        return;
      }

      if (
        data?.ok
      ) {
        if (
          compareMode &&
          result
        ) {
          setCompareResult(
            data.result
          );

          toast(
            "Second candidate analysed"
          );
        } else {
          setResult(
            data.result
          );

          setCandidateId(
            data.candidateId
          );

          setJobId(
            data.jobId
          );

          toast(
            rerun
              ? `Re-scored: ${data.result.match_score} · ${data.result.recommendation}`
              : `Score: ${data.result.match_score} · ${data.result.recommendation}`
          );
        }

        if (posthog.__loaded) {
          posthog.capture("analysis_completed", {
            rerun,
            comparison: compareMode && !!result,
            blind_mode: blindMode,
            job_source: jobFile ? "file" : "text",
            cv_file_type: file.type || "unknown",
            requirements_count: requirements.length,
            scoring_version: SCORING_VERSION,
          });
        }

        const entry = {
          id: Date.now(),
          timestamp:
            new Date().toISOString(),
          analysisName:
            analysisName ||
            null,
          cvName:
            file.name,
          matchScore:
            data.result
              .match_score,
          recommendation:
            data.result
              .recommendation,
          summary:
            data.result
              .summary,
          email:
            data.result.email ||
            null,
          phone:
            data.result.phone ||
            null,
          linkedin:
            data.result
              .linkedin ||
            null,
          rerun,
          scoringVersion:
            SCORING_VERSION,
        };

        const history =
          ls(
            "analysisHistory",
            []
          );

        history.unshift(
          entry
        );

        lsSet(
          "analysisHistory",
          history.slice(
            0,
            50
          )
        );

        setHistoryVersion(
          (version) =>
            version + 1
        );
      } else {
        setError(
          data?.error ||
            "Something went wrong. Please try again."
        );
      }
    } catch {
      setError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      const elapsed =
        Date.now() -
        startedAt;

      const remaining =
        MIN_LOADING_MS -
        elapsed;

      if (remaining > 0) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              remaining
            )
        );
      }

      setLoading(false);
      setRerunBanner(false);
    }
  }

  function handleRetryAnalyse() {
    handleAnalyse(
      lastAnalyseOptsRef.current
    );
  }

  function handleRerunWithTweaks() {
    setRerunBanner(
      true
    );

    toast(
      "Adjust the job spec or requirements, then hit Analyse again",
      "info"
    );

    jobTextRef.current?.scrollIntoView(
      {
        behavior: "smooth",
        block: "center",
      }
    );

    jobTextRef.current?.focus();
  }

  async function submitFeedback(
    rating,
    reason = null
  ) {
    setFeedback(rating);
    setFeedbackSent(
      true
    );
    setFeedbackReason(
      reason
    );

    const count =
      ls(
        "feedbackCount",
        0
      ) + 1;

    lsSet(
      "feedbackCount",
      count
    );

    setFeedbackVersion(
      (version) =>
        version + 1
    );

    toast(
      rating === "up"
        ? "Thanks for the feedback 👍"
        : "Thanks - we'll use this to improve"
    );

    if (posthog.__loaded) {
      posthog.capture("analysis_feedback_submitted", {
        rating,
        reason,
      });
    }

    try {
      await fetch(
        "/api/feedback",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            rating,
            reason,
          }),
        }
      );
    } catch {
      // Feedback UI should not fail
      // because the API request failed.
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragOver(false);

    const dropped =
      event.dataTransfer
        .files?.[0];

    if (
      !isAcceptedCvFile(
        dropped
      )
    ) {
      setError(
        "Please drop a PDF or Word (.doc/.docx) file."
      );
      return;
    }

    if (
      dropped.size >
      MAX_FILE_BYTES
    ) {
      setError(
        `That file is ${formatBytes(
          dropped.size
        )} - please drop a file under 10MB.`
      );
      return;
    }

    setFile(
      dropped
    );

    setError(null);

    setUploadAnnounce(
      `CV uploaded: ${dropped.name}`
    );

    const duplicate =
      findDuplicateCv(
        dropped
      );

    setDuplicateWarning(
      duplicate
        ? `You already analysed a file named "${dropped.name}" ${
            duplicate.timestamp
              ? `on ${new Date(
                  duplicate.timestamp
                ).toLocaleDateString()}`
              : "previously"
          } - scored ${duplicate.matchScore}. This looks like a re-upload rather than a new candidate.`
        : null
    );
  }

  const generateEmail =
    useCallback(
      async () => {
        if (
          !candidateId ||
          !jobId
        ) {
          return;
        }

        setEmailLoading(
          true
        );

        setEmailDraft(
          null
        );

        setEmailCopied(
          false
        );

        setSent(false);

        try {
          const response =
            await fetch(
              "/api/draft-email",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify(
                  {
                    candidateId,
                    jobId,
                    purpose:
                      emailPurpose,
                  }
                ),
              }
            );

          const data =
            await response
              .json()
              .catch(
                () => null
              );

          if (
            response.status ===
              402 ||
            data?.upgrade
          ) {
            window.location.href =
              "/pricing?reason=subscription_required";
            return;
          }

          if (
            response.status ===
            401
          ) {
            window.location.href =
              "/login?next=%2Fanalyse";
            return;
          }

          if (data?.ok) {
            emailArtifactIdRef.current =
              data.artifact.id;

            const draft =
              data.artifact
                .content
                .original_text ||
              data.artifact
                .content
                .final_text ||
              "";

            setEmailDraft(
              draft
            );

            setEmailEdited(
              draft
            );
          } else {
            toast(
              data?.error ||
                "Couldn't draft that email - try again",
              "error"
            );
          }
        } catch {
          toast(
            "Network error while drafting the email - try again",
            "error"
          );
        } finally {
          setEmailLoading(
            false
          );
        }
      },
      [
        candidateId,
        jobId,
        emailPurpose,
      ]
    );

  async function handleSendEmail() {
    if (
      !recipientEmail.trim()
    ) {
      toast(
        "Enter a recipient email first",
        "error"
      );
      return;
    }

    if (
      !EMAIL_RE.test(
        recipientEmail.trim()
      )
    ) {
      toast(
        "That doesn't look like a valid email address",
        "error"
      );
      return;
    }

    if (
      !emailArtifactIdRef.current
    ) {
      toast(
        "Draft the email first",
        "error"
      );
      return;
    }

    setSending(true);

    try {
      const response =
        await fetch(
          "/api/send-email",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              artifactId:
                emailArtifactIdRef.current,
              to: recipientEmail.trim(),
              subject:
                undefined,
            }),
          }
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (
        response.status ===
          402 ||
        data?.upgrade
      ) {
        window.location.href =
          "/pricing?reason=subscription_required";
        return;
      }

      if (
        response.status ===
        401
      ) {
        window.location.href =
          "/login?next=%2Fanalyse";
        return;
      }

      if (
        data?.ok
      ) {
        if (posthog.__loaded) {
          posthog.capture("candidate_email_sent", {
            purpose: emailPurpose,
          });
        }
        setSent(true);

        toast(
          `Email sent to ${recipientEmail.trim()}`
        );
      } else {
        toast(
          data?.error ||
            "Failed to send email - try again",
          "error"
        );
      }
    } catch {
      toast(
        "Network error while sending - try again",
        "error"
      );
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    setResult(null);
    setCandidateId(null);
    setJobId(null);
    setFile(null);
    setJobText("");
    setJobFile(null);
    setFeedback(null);
    setFeedbackSent(false);
    setEmailDraft(null);
    setError(null);
    setCompareMode(false);
    setCompareResult(null);
    setRerunBanner(false);
    setRequirements([]);
    setReqDraft("");
    setBlindMode(false);
    setDuplicateWarning(null);
    setFeedbackReason(null);
    setShowReasonPicker(false);
    setRecipientEmail("");
    setSent(false);
    setAnalysisName("");
    setFlowDone(false);
    setJobClientEmail("");
    setMobileNavOpen(false);
  }

  async function handleCopyEmail() {
    await navigator.clipboard.writeText(
      emailEdited
    );

    setEmailCopied(
      true
    );

    setTimeout(
      () =>
        setEmailCopied(
          false
        ),
      2000
    );

    toast(
      "Email copied to clipboard"
    );

    const artifactId =
      emailArtifactIdRef.current;

    if (artifactId) {
      fetch(
        "/api/update-artifact",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            artifactId,
            finalText:
              emailEdited,
          }),
        }
      ).catch(() => {});
    }
  }

  async function handleCopyClientSummary() {
    if (!result) {
      return;
    }

    const lines = [
      `Candidate: ${
        result.blind_mode
          ? "Candidate (blind screened)"
          : result.name ||
            "Candidate"
      }`,
      `Match score: ${result.match_score} - ${result.recommendation}`,
      result.summary
        ? `\nSummary: ${result.summary}`
        : "",
      result.standout_factors
        ?.length
        ? `\nStandout factors:\n${result.standout_factors
            .map(
              (item) =>
                `• ${item}`
            )
            .join("\n")}`
        : "",
      result.missing_required
        ?.length
        ? `\nMissing (required):\n${result.missing_required
            .map(
              (item) =>
                `• ${item}`
            )
            .join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    await navigator.clipboard.writeText(
      lines
    );

    toast(
      "Client-ready summary copied to clipboard"
    );
  }

  function handleFileChange(
    event
  ) {
    const chosen =
      event.target.files?.[0] ||
      null;

    if (
      chosen &&
      !isAcceptedCvFile(
        chosen
      )
    ) {
      setError(
        "Please upload a PDF or Word (.doc/.docx) file."
      );
      setFile(null);
      return;
    }

    if (
      chosen &&
      chosen.size >
        MAX_FILE_BYTES
    ) {
      setError(
        `That file is ${formatBytes(
          chosen.size
        )} - please choose a file under 10MB.`
      );
      setFile(null);
      return;
    }

    setFile(chosen);
    setError(null);

    if (chosen) {
      setUploadAnnounce(
        `CV uploaded: ${chosen.name}`
      );

      const duplicate =
        findDuplicateCv(
          chosen
        );

      setDuplicateWarning(
        duplicate
          ? `You already analysed a file named "${chosen.name}" ${
              duplicate.timestamp
                ? `on ${new Date(
                    duplicate.timestamp
                  ).toLocaleDateString()}`
                : "previously"
            } - scored ${duplicate.matchScore}. This looks like a re-upload rather than a new candidate.`
          : null
      );
    } else {
      setDuplicateWarning(
        null
      );
    }
  }

  const floorCapped =
    result?.score_rationale
      ?.capped ||
    result?.floor_capped ||
    (result?.score_rationale
      ?.cap_reason
      ? true
      : false);

  const capReason =
    result?.score_rationale
      ?.cap_reason ||
    result?.cap_reason ||
    null;

  const metCount =
    result?.requirements_met?.filter(
      (item) =>
        item.met
    ).length || 0;

  const reqTotal =
    result?.requirements_met
      ?.length || 0;

  const isClientFacingEmail =
    emailPurpose ===
      "client_shortlist_update" ||
    emailPurpose ===
      "chase_feedback";

  if (!flowDone) {
    return (
      <>
        <Toast
          toasts={toasts}
        />

        <AnalysisFlow
          analysisName={
            analysisName
          }
          setAnalysisName={
            setAnalysisName
          }
          jobText={jobText}
          setJobText={
            setJobText
          }
          jobFile={jobFile}
          onJobFileChange={
            handleJobFileChange
          }
          onJobFileDrop={
            handleJobFileDrop
          }
          jobClientEmail={
            jobClientEmail
          }
          setJobClientEmail={
            setJobClientEmail
          }
          file={file}
          onFileChange={
            handleFileChange
          }
          onDrop={handleDrop}
          error={error}
          setError={setError}
          loading={loading}
          stage={stage}
          onStartScan={() =>
            handleAnalyse()
          }
          onFinish={() => {
            setFlowDone(true);

            if (result) {
              toast(
                `Score: ${result.match_score} · ${result.recommendation}`
              );
            }
          }}
        />
      </>
    );
  }

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          "var(--mist)",
      }}
    >
      <Toast
        toasts={toasts}
      />

      <span
        className="sr-only"
        role="status"
        aria-live="polite"
      >
        {uploadAnnounce}
      </span>

      <DashboardNav email={me?.email} />

      <div className="max-w-[1100px] mx-auto px-4 py-10">
        <StaleCandidatesBanner
          version={
            historyVersion
          }
        />

        <DashboardPanel
          version={
            historyVersion
          }
          onCleared={() => {
            setHistoryVersion(
              (version) =>
                version + 1
            );

            setTemplates([]);

            toast(
              "Your data has been deleted"
            );
          }}
        />

        {analysisName &&
          !result &&
          !loading && (
            <div className="card px-5 py-3 mb-6 flex items-center justify-between gap-3">
              <p
                className="text-xs"
                style={{
                  color:
                    "#5a7a6a",
                }}
              >
                Analysing as{" "}
                <span
                  className="font-semibold"
                  style={{
                    color:
                      "#13201b",
                  }}
                >
                  {analysisName}
                </span>
              </p>

              <button
                type="button"
                onClick={() =>
                  setFlowDone(
                    false
                  )
                }
                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors shrink-0"
                style={{
                  border:
                    "1px solid var(--border)",
                  color:
                    "#5a7a6a",
                }}
                onMouseEnter={(
                  event
                ) =>
                  (event.currentTarget.style.background =
                    "var(--mist)")
                }
                onMouseLeave={(
                  event
                ) =>
                  (event.currentTarget.style.background =
                    "transparent")
                }
              >
                Edit name / job
              </button>
            </div>
          )}

        {!result &&
          !loading &&
          showOnboarding && (
            <div className="card px-6 py-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
              {[
                {
                  n: "1",
                  label:
                    "Upload a CV",
                },
                {
                  n: "2",
                  label:
                    "Paste the job description",
                },
                {
                  n: "3",
                  label:
                    "Get a match score in seconds",
                },
              ].map(
                (stepItem, index) => (
                  <div
                    key={
                      stepItem.n
                    }
                    className="flex items-center gap-2.5"
                  >
                    <span
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background:
                          "var(--mint)",
                        color:
                          "var(--forest)",
                      }}
                    >
                      {
                        stepItem.n
                      }
                    </span>

                    <span
                      className="text-xs"
                      style={{
                        color:
                          "#5a7a6a",
                      }}
                    >
                      {
                        stepItem.label
                      }
                    </span>

                    {index < 2 && (
                      <span className="hidden sm:block text-[#c8d8ce]">
                        →
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="card p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1
                  className="text-lg font-semibold text-[#13201b] tracking-tight leading-tight"
                  style={{
                    fontFamily:
                      "var(--font-display)",
                  }}
                >
                  {compareMode
                    ? "Compare a second candidate"
                    : "Score a candidate"}
                </h1>

                <p className="text-[#5a7a6a] text-xs mt-1">
                  {compareMode
                    ? "Drop a second CV to compare against the same role."
                    : "Upload a CV and job spec - get a match score in seconds."}
                </p>
              </div>

              <a
                href="/bulk"
                className="shrink-0 ml-3 text-[11px] px-3 py-1.5 rounded-[10px] transition-colors font-medium"
                style={{
                  border:
                    "1px solid var(--border)",
                  color:
                    "#5a7a6a",
                }}
                onMouseEnter={(
                  event
                ) =>
                  (event.currentTarget.style.background =
                    "var(--mint)")
                }
                onMouseLeave={(
                  event
                ) =>
                  (event.currentTarget.style.background =
                    "transparent")
                }
              >
                Bulk upload
              </a>
            </div>

            {rerunBanner && (
              <div
                className="mb-5 flex items-start gap-2 px-3.5 py-3 rounded-[10px] text-xs"
                style={{
                  background:
                    "#eef6f1",
                  border:
                    "1px solid var(--border-soft)",
                  color:
                    "#0b6e4f",
                }}
              >
                <span className="shrink-0 mt-0.5">
                  ✎
                </span>

                <span>
                  Re-scoring the same CV (
                  <span className="font-semibold">
                    {file?.name}
                  </span>
                  ). Adjust the job spec or
                  requirements below, then hit
                  Analyse - no need to re-upload.
                </span>
              </div>
            )}

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(
                  true
                );
              }}
              onDragLeave={() =>
                setDragOver(
                  false
                )
              }
              onDrop={handleDrop}
              onClick={() =>
                document
                  .getElementById(
                    "cv-input"
                  )
                  ?.click()
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" ||
                  event.key ===
                    " "
                ) {
                  event.preventDefault();

                  document
                    .getElementById(
                      "cv-input"
                    )
                    ?.click();
                }
              }}
              aria-label="Upload CV file"
              className="rounded-[10px] p-7 text-center mb-5 cursor-pointer select-none transition-all"
              style={{
                border: `2px dashed ${
                  dragOver
                    ? "var(--forest)"
                    : file
                      ? "var(--forest)"
                      : "var(--border)"
                }`,
                background:
                  dragOver
                    ? "var(--mint)"
                    : file
                      ? "#f0f9f4"
                      : "var(--mist)",
              }}
            >
              <input
                id="cv-input"
                type="file"
                accept={
                  ACCEPTED_CV_INPUT_ACCEPT
                }
                className="hidden"
                onChange={
                  handleFileChange
                }
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                    style={{
                      background:
                        "var(--mint)",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--forest)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <polyline points="9 15 11 17 15 13" />
                    </svg>
                  </div>

                  <p
                    className="text-xs font-semibold truncate px-4 max-w-full"
                    style={{
                      color:
                        "var(--forest)",
                    }}
                  >
                    {file.name}
                  </p>

                  <p
                    className="text-[10px]"
                    style={{
                      color:
                        "#5a7a6a",
                    }}
                  >
                    Click to change
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <UploadIcon className="text-[#b0c4ba] mb-1" />

                  <p
                    className="text-xs font-semibold"
                    style={{
                      color:
                        "#13201b",
                    }}
                  >
                    Drop CV here or click to upload
                  </p>

                  <p
                    className="text-[10px]"
                    style={{
                      color:
                        "#5a7a6a",
                    }}
                  >
                    PDF or Word (.doc, .docx) · max 10 MB
                  </p>
                </div>
              )}
            </div>

            <p
              className="text-[10px] mb-5 flex items-center gap-1.5"
              style={{
                color:
                  "#8aaa9a",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="6"
                  cy="6"
                  r="5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M4 6l1.5 1.5L8 4"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>

              CV data is processed securely,
              held in the EU, and never used to
              train AI. Delete anytime.
            </p>

            {duplicateWarning && (
              <div
                className="mb-5 flex items-start gap-2 px-3.5 py-3 rounded-[10px] text-[11px]"
                style={{
                  background:
                    "#fef3e8",
                  border:
                    "1px solid #fbdcb4",
                  color:
                    "#92400e",
                }}
              >
                <span className="shrink-0 mt-0.5">
                  ↻
                </span>

                <span className="flex-1">
                  {duplicateWarning}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setDuplicateWarning(
                      null
                    )
                  }
                  aria-label="Dismiss duplicate warning"
                  className="shrink-0"
                  style={{
                    color:
                      "#b45309",
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {!compareMode && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="job-desc"
                    className="text-xs font-semibold"
                    style={{
                      color:
                        "#13201b",
                    }}
                  >
                    Job description
                  </label>

                  <div className="flex items-center gap-2">
                    {templates.length >
                      0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowTemplates(
                            (value) =>
                              !value
                          )
                        }
                        aria-expanded={
                          showTemplates
                        }
                        className="text-[10px] transition-colors font-medium"
                        style={{
                          color:
                            "var(--forest)",
                        }}
                      >
                        {showTemplates
                          ? "Hide"
                          : `Templates (${templates.length})`}
                      </button>
                    )}

                    {jobText.trim() && (
                      <button
                        type="button"
                        onClick={
                          saveCurrentJobSpec
                        }
                        className="text-[10px] px-2 py-0.5 rounded-[6px] transition-colors"
                        style={{
                          color:
                            "#5a7a6a",
                          border:
                            "1px solid var(--border)",
                        }}
                      >
                        + Save spec
                      </button>
                    )}
                  </div>
                </div>

                {showTemplates &&
                  templates.length >
                    0 && (
                    <div
                      className="mb-3 rounded-[10px] overflow-hidden"
                      style={{
                        border:
                          "1px solid var(--border-soft)",
                      }}
                    >
                      {templates.map(
                        (template) => (
                          <div
                            key={
                              template.id ||
                              template.savedAt
                            }
                            className="flex items-center gap-2 px-3 py-2 border-b last:border-0 transition-colors"
                            style={{
                              borderColor:
                                "var(--border-soft)",
                            }}
                            onMouseEnter={(
                              event
                            ) =>
                              (event.currentTarget.style.background =
                                "var(--mist)")
                            }
                            onMouseLeave={(
                              event
                            ) =>
                              (event.currentTarget.style.background =
                                "transparent")
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                loadTemplate(
                                  template
                                )
                              }
                              className="flex-1 text-left text-xs truncate"
                              style={{
                                color:
                                  "#13201b",
                              }}
                            >
                              {
                                template.name
                              }
                            </button>

                            <span
                              className="text-[10px] shrink-0"
                              style={{
                                color:
                                  "#b0c4ba",
                              }}
                            >
                              {
                                template.uses
                              }
                              ×
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                deleteTemplate(
                                  template
                                )
                              }
                              aria-label={`Delete template ${template.name}`}
                              className="text-[10px] shrink-0 px-1 hover:text-red-500 transition-colors"
                              style={{
                                color:
                                  "#b0c4ba",
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}

                <textarea
                  id="job-desc"
                  ref={jobTextRef}
                  value={jobText}
                  onChange={(event) =>
                    setJobText(
                      event.target
                        .value
                    )
                  }
                  placeholder="Paste the full job description here… (Ctrl+Enter to analyse)"
                  rows={6}
                  className="w-full p-3.5 text-xs mb-5 resize-none outline-none transition-all"
                  style={{
                    border:
                      "1px solid var(--border)",
                    borderRadius:
                      "var(--radius-input)",
                    color:
                      "#13201b",
                    background:
                      "var(--bg)",
                    fontFamily:
                      "var(--font-body)",
                  }}
                  onFocus={(
                    event
                  ) =>
                    (event.target.style.boxShadow =
                      "0 0 0 3px rgba(11,110,79,0.12)")
                  }
                  onBlur={(event) =>
                    (event.target.style.boxShadow =
                      "none")
                  }
                />

                <div className="mb-5">
                  <label
                    htmlFor="client-email"
                    className="text-xs font-semibold block mb-1.5"
                    style={{
                      color:
                        "#13201b",
                    }}
                  >
                    Client contact email{" "}
                    <span
                      className="font-normal"
                      style={{
                        color:
                          "#8aaa9a",
                      }}
                    >
                      (optional)
                    </span>
                  </label>

                  <input
                    id="client-email"
                    type="email"
                    value={
                      jobClientEmail
                    }
                    onChange={(event) =>
                      setJobClientEmail(
                        event.target
                          .value
                      )
                    }
                    placeholder="client@company.com"
                    className="w-full p-3 text-xs outline-none transition-all"
                    style={{
                      border:
                        "1px solid var(--border)",
                      borderRadius:
                        "var(--radius-input)",
                      color:
                        "#13201b",
                      background:
                        "var(--bg)",
                      fontFamily:
                        "var(--font-body)",
                    }}
                    onFocus={(
                      event
                    ) =>
                      (event.target.style.boxShadow =
                        "0 0 0 3px rgba(11,110,79,0.12)")
                    }
                    onBlur={(event) =>
                      (event.target.style.boxShadow =
                        "none")
                    }
                  />

                  <p
                    className="text-[10px] mt-1.5"
                    style={{
                      color:
                        "#8aaa9a",
                    }}
                  >
                    Lets you send shortlist updates
                    and feedback chasers straight from
                    a scored candidate.
                  </p>
                </div>
              </>
            )}

            {compareMode && (
              <p
                className="text-xs mb-5 px-3.5 py-3 rounded-[10px]"
                style={{
                  color:
                    "#5a7a6a",
                  background:
                    "var(--mist)",
                  border:
                    "1px solid var(--border-soft)",
                }}
              >
                Reusing the same job description
                - drop a second CV and hit
                Analyse.
              </p>
            )}

            {!compareMode && (
              <label className="flex items-center gap-3 mb-5 cursor-pointer group">
                <button
                  type="button"
                  role="switch"
                  aria-checked={
                    blindMode
                  }
                  onClick={() =>
                    setBlindMode(
                      (value) =>
                        !value
                    )
                  }
                  className="w-9 h-5 rounded-full transition-colors relative flex-shrink-0"
                  style={{
                    background:
                      blindMode
                        ? "var(--forest)"
                        : "var(--border)",
                  }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm"
                    style={{
                      transform:
                        blindMode
                          ? "translateX(18px)"
                          : "translateX(2px)",
                    }}
                  />
                </button>

                <span
                  className="text-xs transition-colors"
                  style={{
                    color:
                      "#5a7a6a",
                  }}
                >
                  Blind screening - hide name,
                  location &amp; university
                </span>
              </label>
            )}

            {!compareMode && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="req-input"
                    className="text-xs font-semibold"
                    style={{
                      color:
                        "#13201b",
                    }}
                  >
                    Must-have requirements
                  </label>

                  {requirements.length >
                    0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setRequirements(
                          []
                        )
                      }
                      className="text-[10px] transition-colors"
                      style={{
                        color:
                          "#b0c4ba",
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <p
                  className="text-[10px] mb-2"
                  style={{
                    color:
                      "#8aaa9a",
                  }}
                >
                  Plain English. e.g. "has managed
                  a team", "worked somewhere regulated".
                  Press Enter to add.
                </p>

                <input
                  id="req-input"
                  value={
                    reqDraft
                  }
                  onChange={(event) =>
                    setReqDraft(
                      event.target
                        .value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                        "Enter" &&
                      reqDraft.trim()
                    ) {
                      setRequirements(
                        [
                          ...requirements,
                          reqDraft.trim(),
                        ]
                      );

                      setReqDraft(
                        ""
                      );
                    }
                  }}
                  placeholder="Type a requirement and press Enter…"
                  className="w-full text-xs outline-none transition-all mb-2"
                  style={{
                    border:
                      "1px solid var(--border)",
                    borderRadius:
                      "var(--radius-input)",
                    padding:
                      "10px 14px",
                    color:
                      "#13201b",
                    background:
                      "var(--bg)",
                    fontFamily:
                      "var(--font-body)",
                  }}
                  onFocus={(
                    event
                  ) =>
                    (event.target.style.boxShadow =
                      "0 0 0 3px rgba(11,110,79,0.12)")
                  }
                  onBlur={(event) =>
                    (event.target.style.boxShadow =
                      "none")
                  }
                />

                {requirements.length >
                  0 && (
                  <ul className="space-y-1.5">
                    {requirements.map(
                      (
                        requirement,
                        index
                      ) => (
                        <li
                          key={
                            `${requirement}-${index}`
                          }
                          className="flex items-center justify-between text-xs rounded-[8px] px-3 py-1.5"
                          style={{
                            background:
                              "var(--mint)",
                            border:
                              "1px solid var(--border-soft)",
                          }}
                        >
                          <span
                            style={{
                              color:
                                "#13201b",
                            }}
                          >
                            {
                              requirement
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setRequirements(
                                requirements.filter(
                                  (
                                    _,
                                    itemIndex
                                  ) =>
                                    itemIndex !==
                                    index
                                )
                              )
                            }
                            aria-label={`Remove requirement: ${requirement}`}
                            className="ml-3 shrink-0 text-[10px] transition-colors"
                            style={{
                              color:
                                "#8aaa9a",
                            }}
                            onMouseEnter={(
                              event
                            ) =>
                              (event.currentTarget.style.color =
                                "var(--score-low)")
                            }
                            onMouseLeave={(
                              event
                            ) =>
                              (event.currentTarget.style.color =
                                "#8aaa9a")
                            }
                          >
                            ✕
                          </button>
                        </li>
                      )
                    )}
                  </ul>
                )}
              </div>
            )}

            {loading && (
              <div
                className="mb-5 rounded-[10px] p-4 space-y-1"
                style={{
                  background:
                    "var(--mist)",
                  border:
                    "1px solid var(--border-soft)",
                }}
              >
                {STAGES.map(
                  (
                    stageName,
                    index
                  ) => (
                    <div
                      key={
                        stageName
                      }
                      className={`flex items-center gap-3 py-1 transition-opacity duration-300 ${
                        index >
                        stage
                          ? "opacity-20"
                          : ""
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors"
                        style={{
                          background:
                            index <
                            stage
                              ? "var(--forest)"
                              : index ===
                                  stage
                                ? "var(--mint)"
                                : "var(--border)",
                          color:
                            index <
                            stage
                              ? "white"
                              : index ===
                                  stage
                                ? "var(--forest)"
                                : "#b0c4ba",
                        }}
                      >
                        {index <
                        stage
                          ? "✓"
                          : ""}
                      </div>

                      <span
                        className={`text-xs ${
                          index ===
                          stage
                            ? "font-semibold"
                            : ""
                        }`}
                        style={{
                          color:
                            index ===
                            stage
                              ? "#13201b"
                              : "#5a7a6a",
                        }}
                      >
                        {stageName}
                        {index ===
                        stage
                          ? "…"
                          : ""}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

            {!compareMode && (
              <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    blindMode
                      ? false
                      : true
                  }
                  onChange={() => {}}
                  className="mt-0.5 shrink-0"
                  aria-label="Data processing consent"
                  disabled
                />

                <span
                  className="text-[10px] leading-relaxed"
                  style={{
                    color:
                      "#8aaa9a",
                  }}
                >
                  I have a lawful basis (e.g. candidate
                  consent or legitimate interest under
                  GDPR) to screen this CV with AI.
                </span>
              </label>
            )}

            <button
              type="button"
              onClick={() =>
                handleAnalyse({
                  rerun:
                    rerunBanner,
                })
              }
              disabled={loading}
              className="w-full font-semibold py-3.5 rounded-[10px] transition-all text-xs"
              style={{
                background: loading
                  ? "var(--border)"
                  : compareMode
                    ? "var(--gold)"
                    : "var(--forest)",
                color: loading
                  ? "#8aaa9a"
                  : "white",
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
                boxShadow: loading
                  ? "none"
                  : "0 4px 14px -4px rgba(11,110,79,0.4)",
                fontFamily:
                  "var(--font-body)",
              }}
              onMouseEnter={(
                event
              ) => {
                if (
                  !loading
                ) {
                  event.currentTarget.style.background =
                    compareMode
                      ? "var(--gold-deep)"
                      : "var(--forest-deep)";
                }
              }}
              onMouseLeave={(
                event
              ) => {
                if (
                  !loading
                ) {
                  event.currentTarget.style.background =
                    compareMode
                      ? "var(--gold)"
                      : "var(--forest)";
                }
              }}
            >
              {loading
                ? "Analysing…"
                : compareMode
                  ? "Analyse second candidate"
                  : rerunBanner
                    ? "Re-analyse with tweaks"
                    : "Analyse candidate"}
            </button>

            {error && (
              <div
                role="alert"
                className="mt-3 p-3.5 rounded-[10px] text-xs flex items-start gap-2"
                style={{
                  background:
                    "#fef2f2",
                  border:
                    "1px solid rgba(192,57,43,0.3)",
                  color:
                    "var(--score-low)",
                }}
              >
                <span className="shrink-0 mt-0.5">
                  ⚠
                </span>

                <span className="flex-1">
                  {error}
                </span>

                {file &&
                  jobText.trim() && (
                    <button
                      type="button"
                      onClick={
                        handleRetryAnalyse
                      }
                      className="shrink-0 text-[11px] font-semibold underline underline-offset-2"
                    >
                      Retry
                    </button>
                  )}
              </div>
            )}
          </div>

          <div>
            {!result &&
              !loading && (
                <div className="card p-10 flex flex-col items-center justify-center text-center min-h-72">
                  <EmptyScoreRing />

                  <p
                    className="mt-5 text-sm font-semibold tracking-tight"
                    style={{
                      color:
                        "#13201b",
                      fontFamily:
                        "var(--font-display)",
                    }}
                  >
                    Your score will appear here
                  </p>

                  <p
                    className="text-[11px] mt-2 max-w-[200px] leading-relaxed"
                    style={{
                      color:
                        "#5a7a6a",
                    }}
                  >
                    Upload a CV and paste a role description
                    to see the score, strengths, and evidence
                    behind it.
                  </p>

                  <p
                    className="text-[10px] mt-4"
                    style={{
                      color:
                        "#b0c4ba",
                    }}
                  >
                    Tip: Ctrl+Enter to analyse · ←/→ to
                    switch tabs once scored
                  </p>
                </div>
              )}

            {loading && (
              <div className="card p-10 flex flex-col items-center justify-center text-center min-h-72">
                <div
                  className="w-9 h-9 rounded-full border-[3px] animate-spin mb-5"
                  style={{
                    borderColor:
                      "var(--border)",
                    borderTopColor:
                      "var(--forest)",
                  }}
                />

                <p
                  className="text-xs"
                  style={{
                    color:
                      "#5a7a6a",
                  }}
                >
                  {compareMode
                    ? "Analysing second candidate…"
                    : isRerun
                      ? "Re-scoring with your tweaks…"
                      : "Running analysis…"}
                </p>
              </div>
            )}

            {result &&
              !loading && (
                <div className="space-y-4">
                  <div className="card px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {result.confidence &&
                        result.confidence !==
                          "High" && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              background:
                                "#fef3e8",
                              color:
                                "#b45309",
                            }}
                          >
                            {
                              result.confidence
                            }{" "}
                            confidence
                          </span>
                        )}

                      <button
                        type="button"
                        onClick={
                          handleCopyClientSummary
                        }
                        className="text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors"
                        style={{
                          border:
                            "1px solid var(--border)",
                          color:
                            "#5a7a6a",
                        }}
                        onMouseEnter={(
                          event
                        ) =>
                          (event.currentTarget.style.background =
                            "var(--mist)")
                        }
                        onMouseLeave={(
                          event
                        ) =>
                          (event.currentTarget.style.background =
                            "transparent")
                        }
                      >
                        Copy client-ready summary
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={
                        handleRerunWithTweaks
                      }
                      className="shrink-0 text-[10px] font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors"
                      style={{
                        background:
                          "var(--mint)",
                        color:
                          "var(--forest)",
                      }}
                      onMouseEnter={(
                        event
                      ) =>
                        (event.currentTarget.style.background =
                          "#d5ebe0")
                      }
                      onMouseLeave={(
                        event
                      ) =>
                        (event.currentTarget.style.background =
                          "var(--mint)")
                      }
                    >
                      ✎ Re-run with tweaks
                    </button>
                  </div>

                  {floorCapped && (
                    <div
                      className="card px-5 py-3 text-[11px] flex items-start gap-2"
                      style={{
                        background:
                          "#fef3e8",
                        color:
                          "#92400e",
                        border:
                          "1px solid #fbdcb4",
                      }}
                    >
                      <span className="shrink-0 mt-0.5">
                        ⓘ
                      </span>

                      <span>
                        This score was capped by our floor check
                        {capReason
                          ? ` - ${capReason}`
                          : ""}
                        . If the CV looks stronger than the
                        number suggests, check the Evidence tab
                        for what was discounted.
                      </span>
                    </div>
                  )}

                  <CandidateResult
                    result={
                      result
                    }
                    candidateId={
                      candidateId
                    }
                    toast={
                      toast
                    }
                  />

                  {reqTotal >
                    0 && (
                    <div className="card px-6 py-6">
                      <div className="flex items-center justify-between mb-3">
                        <p
                          className="text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            color:
                              "#5a7a6a",
                          }}
                        >
                          Must-have requirements
                        </p>

                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{
                            background:
                              metCount ===
                              reqTotal
                                ? "var(--mint)"
                                : metCount ===
                                    0
                                  ? "#fef2f2"
                                  : "#fef3e8",
                            color:
                              metCount ===
                              reqTotal
                                ? "var(--forest)"
                                : metCount ===
                                    0
                                  ? "var(--score-low)"
                                  : "#b45309",
                          }}
                        >
                          {metCount}/
                          {
                            reqTotal
                          }
                        </span>
                      </div>

                      <ul className="space-y-3">
                        {result.requirements_met?.map(
                          (
                            requirement,
                            index
                          ) => (
                            <li
                              key={
                                `${requirement.requirement}-${index}`
                              }
                              className="text-xs"
                            >
                              <div className="flex items-start gap-2">
                                <span
                                  className="shrink-0 mt-0.5 font-semibold"
                                  style={{
                                    color:
                                      requirement.met
                                        ? "var(--forest)"
                                        : "#b0c4ba",
                                  }}
                                >
                                  {requirement.met
                                    ? "✓"
                                    : "✗"}
                                </span>

                                <div>
                                  <span
                                    className="font-semibold"
                                    style={{
                                      color:
                                        "#13201b",
                                    }}
                                  >
                                    {
                                      requirement.requirement
                                    }
                                  </span>

                                  {requirement.evidence && (
                                    <p
                                      className="mt-0.5 text-[11px] leading-relaxed"
                                      style={{
                                        color:
                                          "#8aaa9a",
                                      }}
                                    >
                                      {
                                        requirement.evidence
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="card px-6 py-6">
                    <div className="flex items-center justify-between mb-4">
                      <p
                        className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          color:
                            "#5a7a6a",
                        }}
                      >
                        Draft &amp; send email
                      </p>

                      <select
                        value={
                          emailPurpose
                        }
                        aria-label="Email purpose"
                        onChange={(
                          event
                        ) => {
                          setEmailPurpose(
                            event
                              .target
                              .value
                          );

                          setEmailDraft(
                            null
                          );
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-[8px] outline-none transition-all"
                        style={{
                          border:
                            "1px solid var(--border)",
                          color:
                            "#13201b",
                          background:
                            "var(--bg)",
                          fontFamily:
                            "var(--font-body)",
                        }}
                      >
                        <option value="invite_to_interview">
                          Invite to interview
                        </option>

                        <option value="client_shortlist_update">
                          Client shortlist update
                        </option>

                        <option value="rejection">
                          Rejection
                        </option>

                        <option value="chase_feedback">
                          Chase client feedback
                        </option>
                      </select>
                    </div>

                    {!emailDraft && (
                      <button
                        type="button"
                        onClick={
                          generateEmail
                        }
                        disabled={
                          emailLoading
                        }
                        className="w-full font-semibold py-2.5 rounded-[10px] text-xs transition-all"
                        style={{
                          border:
                            "1px solid var(--forest)",
                          color:
                            "var(--forest)",
                          background:
                            "transparent",
                          opacity:
                            emailLoading
                              ? 0.5
                              : 1,
                        }}
                        onMouseEnter={(
                          event
                        ) =>
                          (event.currentTarget.style.background =
                            "var(--mint)")
                        }
                        onMouseLeave={(
                          event
                        ) =>
                          (event.currentTarget.style.background =
                            "transparent")
                        }
                      >
                        {emailLoading
                          ? "Drafting…"
                          : "Draft email"}
                      </button>
                    )}

                    {emailDraft && (
                      <div>
                        <textarea
                          value={
                            emailEdited
                          }
                          onChange={(
                            event
                          ) => {
                            setEmailEdited(
                              event
                                .target
                                .value
                            );

                            setSent(
                              false
                            );
                          }}
                          rows={10}
                          aria-label="Email draft"
                          className="w-full p-3.5 text-xs resize-none outline-none mb-3 transition-all"
                          style={{
                            border:
                              "1px solid var(--border)",
                            borderRadius:
                              "var(--radius-input)",
                            color:
                              "#13201b",
                            background:
                              "var(--bg)",
                            fontFamily:
                              "var(--font-body)",
                          }}
                          onFocus={(
                            event
                          ) =>
                            (event.target.style.boxShadow =
                              "0 0 0 3px rgba(11,110,79,0.12)")
                          }
                          onBlur={(
                            event
                          ) =>
                            (event.target.style.boxShadow =
                              "none")
                          }
                        />

                        <div className="flex gap-2 mb-4">
                          <button
                            type="button"
                            onClick={
                              handleCopyEmail
                            }
                            className="flex-1 text-xs font-semibold py-2.5 rounded-[10px] transition-all text-white"
                            style={{
                              background:
                                "var(--forest)",
                            }}
                          >
                            {emailCopied
                              ? "Copied!"
                              : "Copy and use"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEmailDraft(
                                null
                              );

                              generateEmail();
                            }}
                            className="px-3 text-xs rounded-[10px] transition-all"
                            style={{
                              border:
                                "1px solid var(--border)",
                              color:
                                "#5a7a6a",
                            }}
                            onMouseEnter={(
                              event
                            ) =>
                              (event.currentTarget.style.background =
                                "var(--mist)")
                            }
                            onMouseLeave={(
                              event
                            ) =>
                              (event.currentTarget.style.background =
                                "transparent")
                            }
                          >
                            Regenerate
                          </button>
                        </div>

                        <div
                          className="pt-4"
                          style={{
                            borderTop:
                              "1px solid var(--border-soft)",
                          }}
                        >
                          <label
                            htmlFor="recipient-email"
                            className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5"
                            style={{
                              color:
                                "#5a7a6a",
                            }}
                          >
                            Send to
                          </label>

                          <input
                            id="recipient-email"
                            type="email"
                            value={
                              recipientEmail
                            }
                            onChange={(
                              event
                            ) => {
                              setRecipientEmail(
                                event
                                  .target
                                  .value
                              );

                              setSent(
                                false
                              );
                            }}
                            placeholder={
                              isClientFacingEmail
                                ? "client@company.com"
                                : "candidate@email.com"
                            }
                            className="w-full p-3 text-xs mb-2 outline-none transition-all"
                            style={{
                              border:
                                "1px solid var(--border)",
                              borderRadius:
                                "var(--radius-input)",
                              color:
                                "#13201b",
                              background:
                                "var(--bg)",
                              fontFamily:
                                "var(--font-body)",
                            }}
                            onFocus={(
                              event
                            ) =>
                              (event.target.style.boxShadow =
                                "0 0 0 3px rgba(11,110,79,0.12)")
                            }
                            onBlur={(
                              event
                            ) =>
                              (event.target.style.boxShadow =
                                "none")
                            }
                          />

                          {isClientFacingEmail &&
                            !jobClientEmail &&
                            !recipientEmail && (
                              <p
                                className="text-[10px] mb-2"
                                style={{
                                  color:
                                    "#b45309",
                                }}
                              >
                                No client email saved
                                for this job - enter
                                one above to send.
                              </p>
                            )}

                          <button
                            type="button"
                            onClick={
                              handleSendEmail
                            }
                            disabled={
                              sending ||
                              !recipientEmail.trim()
                            }
                            className="w-full text-xs font-semibold py-2.5 rounded-[10px] transition-all text-white"
                            style={{
                              background:
                                sending
                                  ? "var(--border)"
                                  : sent
                                    ? "#0b6e4f"
                                    : "var(--gold)",
                              cursor:
                                sending ||
                                !recipientEmail.trim()
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                !recipientEmail.trim() &&
                                !sending
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            {sending
                              ? "Sending…"
                              : sent
                                ? "✓ Sent"
                                : "Send email"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="card px-6 py-5">
                    {!feedbackSent ? (
                      <>
                        <p
                          className="text-[10px] mb-3 font-medium uppercase tracking-wide"
                          style={{
                            color:
                              "#5a7a6a",
                          }}
                        >
                          Did this match your read?
                        </p>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              submitFeedback(
                                "up"
                              )
                            }
                            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold transition-all"
                            style={{
                              background:
                                feedback ===
                                "up"
                                  ? "var(--forest)"
                                  : "var(--mist)",
                              color:
                                feedback ===
                                "up"
                                  ? "white"
                                  : "#13201b",
                              border: `1px solid ${
                                feedback ===
                                "up"
                                  ? "var(--forest)"
                                  : "var(--border)"
                              }`,
                            }}
                          >
                            👍 Accurate
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setShowReasonPicker(
                                (value) =>
                                  !value
                              )
                            }
                            aria-expanded={
                              showReasonPicker
                            }
                            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold transition-all"
                            style={{
                              background:
                                showReasonPicker
                                  ? "var(--score-low)"
                                  : "var(--mist)",
                              color:
                                showReasonPicker
                                  ? "white"
                                  : "#13201b",
                              border: `1px solid ${
                                showReasonPicker
                                  ? "var(--score-low)"
                                  : "var(--border)"
                              }`,
                            }}
                          >
                            👎 Not quite
                          </button>
                        </div>

                        {showReasonPicker && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {FEEDBACK_DOWN_REASONS.map(
                              (
                                reason
                              ) => (
                                <button
                                  key={
                                    reason
                                  }
                                  type="button"
                                  onClick={() =>
                                    submitFeedback(
                                      "down",
                                      reason
                                    )
                                  }
                                  className="text-[10px] px-2.5 py-1.5 rounded-full transition-colors"
                                  style={{
                                    background:
                                      "var(--mist)",
                                    border:
                                      "1px solid var(--border-soft)",
                                    color:
                                      "#5a7a6a",
                                  }}
                                >
                                  {
                                    reason
                                  }
                                </button>
                              )
                            )}
                          </div>
                        )}

                        <FeedbackTrustNote
                          version={
                            feedbackVersion
                          }
                        />
                      </>
                    ) : (
                      <>
                        <p
                          className="text-[11px] font-semibold"
                          style={{
                            color:
                              "var(--forest)",
                          }}
                        >
                          ✓ Thanks - helps us improve
                          {feedbackReason
                            ? ` (noted: ${feedbackReason})`
                            : ""}
                        </p>

                        <FeedbackTrustNote
                          version={
                            feedbackVersion
                          }
                        />
                      </>
                    )}
                  </div>

                  {!compareMode &&
                    !compareResult && (
                      <div className="card px-6 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            setCompareMode(
                              true
                            )
                          }
                          className="w-full text-xs font-semibold py-2.5 rounded-[10px] transition-all"
                          style={{
                            border:
                              "1px solid var(--border)",
                            color:
                              "#5a7a6a",
                          }}
                        >
                          ⇄ Compare with another
                          candidate
                        </button>
                      </div>
                    )}

                  {compareMode &&
                    !compareResult && (
                      <div className="card px-6 py-4">
                        <p
                          className="text-xs text-center"
                          style={{
                            color:
                              "#5a7a6a",
                          }}
                        >
                          Drop a second CV above and
                          hit{" "}
                          <span
                            className="font-semibold"
                            style={{
                              color:
                                "var(--gold)",
                            }}
                          >
                            Analyse second candidate
                          </span>
                        </p>
                      </div>
                    )}

                  {compareResult && (
                    <ComparePanel
                      result={
                        result
                      }
                      compareResult={
                        compareResult
                      }
                      onClose={() => {
                        setCompareMode(
                          false
                        );
                        setCompareResult(
                          null
                        );
                      }}
                    />
                  )}

                  <div className="card px-5 py-3">
                    <button
                      type="button"
                      onClick={
                        handleReset
                      }
                      className="w-full text-xs py-2 rounded-[10px] transition-all"
                      style={{
                        color:
                          "#5a7a6a",
                      }}
                    >
                      ← Start a new candidate
                      (clears CV, job spec &amp;
                      requirements)
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </main>
  );
}