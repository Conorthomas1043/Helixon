"use client";

// "What are you hiring for?" - pick one of the agency's saved jobs, paste a
// description, upload a spec file, or start from a template. Must-haves and
// the client's email sit underneath because they apply whichever way the
// role was chosen.

import { useMemo, useRef, useState } from "react";
import { Card, CardHeader, Segmented, Textarea, Input, Label, Icon, Button, Notice, cx } from "./ui";
import { JOB_ACCEPT, ROLE_TEMPLATES, formatBytes, ls, lsSet } from "../_lib/analyse";

const MIN_JOB_CHARS = 50;

function SavedJobList({ jobs, selectedId, onSelect }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => `${j.title} ${j.company || ""}`.toLowerCase().includes(q));
  }, [jobs, query]);

  return (
    <div>
      {jobs.length > 6 && (
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your jobs" aria-label="Search your jobs" className="mb-2" />
      )}
      <ul className="max-h-[296px] overflow-y-auto -mx-1 px-1 space-y-1" role="listbox" aria-label="Your jobs">
        {visible.map((job) => {
          const active = job.id === selectedId;
          return (
            <li key={job.id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelect(job)}
                className={cx(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left transition-colors border",
                  active ? "border-[var(--forest)] bg-[#f4faf7]" : "border-transparent hover:bg-[var(--mist)]"
                )}
              >
                <span
                  className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                  style={{ borderColor: active ? "var(--forest)" : "var(--ink-mute)", background: active ? "var(--forest)" : "white" }}
                >
                  {active && <Icon name="check" size={10} strokeWidth={3} className="text-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-[var(--ink)] truncate">{job.title}</span>
                  <span className="block text-[12px] text-[var(--ink-faint)] truncate">
                    {[job.company, job.candidateCount ? `${job.candidateCount} candidate${job.candidateCount === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "No client set"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-[var(--ink-faint)]">No jobs match.</li>}
      </ul>
    </div>
  );
}

function Templates({ onPick }) {
  const [saved, setSaved] = useState(() => ls("jobTemplates", []));
  function remove(t) {
    const next = saved.filter((s) => (s.id || s.savedAt) !== (t.id || t.savedAt));
    setSaved(next);
    lsSet("jobTemplates", next);
  }
  return (
    <div className="space-y-4">
      {saved.length > 0 && (
        <div>
          <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">Saved by you</p>
          <ul className="space-y-1">
            {saved.map((t) => (
              <li key={t.id || t.savedAt} className="group flex items-center gap-2 rounded-[10px] hover:bg-[var(--mist)] pr-1">
                <button type="button" onClick={() => onPick(t.text)} className="flex-1 min-w-0 text-left px-3 py-2">
                  <span className="block text-[13px] text-[var(--ink)] truncate">{t.name}</span>
                </button>
                <button type="button" onClick={() => remove(t)} aria-label={`Delete template ${t.name}`} className="p-1.5 rounded-md text-[var(--ink-faint)] opacity-0 group-hover:opacity-100 hover:text-[var(--score-low)]">
                  <Icon name="x" size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">Starting points</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ROLE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.text)}
              className="text-left px-3 py-2.5 rounded-[10px] border border-[var(--border)] hover:border-[var(--ink-mute)] hover:bg-[var(--mist)] transition-colors"
            >
              <span className="block text-[13px] font-medium text-[var(--ink)]">{t.title}</span>
              <span className="block text-[11.5px] text-[var(--ink-faint)] mt-0.5">
                {t.tag} · {t.level}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-[var(--ink-faint)] mt-2">Picking one opens it in the editor so you can tailor it.</p>
      </div>
    </div>
  );
}

function RequirementsInput({ requirements, setRequirements }) {
  const [draft, setDraft] = useState("");
  function add() {
    const value = draft.trim();
    if (!value) return;
    if (!requirements.some((r) => r.toLowerCase() === value.toLowerCase())) setRequirements([...requirements, value]);
    setDraft("");
  }
  return (
    <div>
      <Label htmlFor="must-have" hint="Optional">Must-haves</Label>
      <div className="flex flex-wrap items-center gap-1.5 min-h-9 px-1.5 py-1 rounded-[8px] border border-[var(--border)] focus-within:border-[var(--forest)] focus-within:shadow-[0_0_0_3px_rgba(11,110,79,0.14)] bg-white">
        {requirements.map((r) => (
          <span key={r} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-[6px] bg-[var(--mist)] border border-[var(--border)] text-[12px] text-[var(--ink)]">
            {r}
            <button type="button" onClick={() => setRequirements(requirements.filter((x) => x !== r))} aria-label={`Remove ${r}`} className="p-0.5 rounded text-[var(--ink-faint)] hover:text-[var(--ink)]">
              <Icon name="x" size={11} />
            </button>
          </span>
        ))}
        <input
          id="must-have"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && requirements.length) {
              setRequirements(requirements.slice(0, -1));
            }
          }}
          onBlur={add}
          placeholder={requirements.length ? "Add another" : 'e.g. "Right to work in the UK", "Managed a team of 5+"'}
          className="flex-1 min-w-[160px] h-7 px-1.5 text-[13px] outline-none bg-transparent placeholder:text-[var(--ink-mute)]"
        />
      </div>
      <p className="text-[11.5px] text-[var(--ink-faint)] mt-1.5">Plain English. Each one is checked against the CV and shown as met or not met.</p>
    </div>
  );
}

export default function RoleCard({
  savedJobs,
  existingJobId,
  jobText,
  jobFile,
  mode,
  setMode,
  onSelectSavedJob,
  onJobTextChange,
  onJobFile,
  onSaveTemplate,
  requirements,
  setRequirements,
  clientEmail,
  setClientEmail,
  disabled,
}) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [showClientEmail, setShowClientEmail] = useState(!!clientEmail);

  const modes = [
    ...(savedJobs.length ? [{ value: "saved", label: "Your jobs", icon: "briefcase", count: savedJobs.length }] : []),
    { value: "paste", label: "Paste", icon: "text" },
    { value: "upload", label: "Upload spec", icon: "upload" },
    { value: "template", label: "Templates", icon: "layers" },
  ];

  const selectedJob = savedJobs.find((j) => j.id === existingJobId);
  const charCount = jobText.trim().length;

  return (
    <Card className={cx(disabled && "opacity-60 pointer-events-none")}>
      <CardHeader title="Role" description="What the candidate is being assessed against." />
      <div className="px-5 pt-4">
        <Segmented value={mode} onChange={setMode} options={modes} ariaLabel="How to add the role" size="sm" />
      </div>

      <div className="px-5 py-4">
        {mode === "saved" && <SavedJobList jobs={savedJobs} selectedId={existingJobId} onSelect={onSelectSavedJob} />}

        {mode === "paste" && (
          <div>
            <Textarea
              id="job-text"
              value={jobText}
              onChange={(e) => onJobTextChange(e.target.value)}
              rows={10}
              placeholder="Paste the full job description - responsibilities, requirements, seniority, location."
              aria-label="Job description"
              className="min-h-[220px]"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className={cx("text-[11.5px] tabular-nums", charCount > 0 && charCount < MIN_JOB_CHARS ? "text-[var(--score-mid)]" : "text-[var(--ink-faint)]")}>
                {charCount > 0 && charCount < MIN_JOB_CHARS ? `${MIN_JOB_CHARS - charCount} more characters needed` : `${charCount.toLocaleString()} characters`}
              </span>
              {charCount >= MIN_JOB_CHARS && (
                <button type="button" onClick={onSaveTemplate} className="text-[12px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
                  Save as template
                </button>
              )}
            </div>
          </div>
        )}

        {mode === "upload" &&
          (jobFile ? (
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] border border-[var(--border)] bg-[var(--mist)]">
              <span className="w-9 h-9 rounded-[8px] bg-white border border-[var(--border)] flex items-center justify-center text-[var(--ink-soft)]">
                <Icon name="file" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-[var(--ink)] truncate">{jobFile.name}</span>
                <span className="block text-[12px] text-[var(--ink-faint)]">{formatBytes(jobFile.size)} · read when you analyse</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => onJobFile(null)}>
                Remove
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onJobFile(e.dataTransfer.files?.[0] || null);
              }}
              className={cx(
                "w-full flex flex-col items-center justify-center gap-2 py-10 rounded-[12px] border border-dashed transition-colors",
                dragging ? "border-[var(--forest)] bg-[#f4faf7]" : "border-[var(--ink-mute)] hover:bg-[var(--mist)]"
              )}
            >
              <Icon name="upload" size={20} className="text-[var(--ink-soft)]" />
              <span className="text-[13.5px] font-medium text-[var(--ink)]">Drop the job spec, or browse</span>
              <span className="text-[12px] text-[var(--ink-faint)]">PDF, Word or .txt · up to 10 MB</span>
            </button>
          ))}
        <input ref={fileRef} type="file" accept={JOB_ACCEPT} className="hidden" onChange={(e) => { onJobFile(e.target.files?.[0] || null); e.target.value = ""; }} />

        {mode === "template" && <Templates onPick={(text) => { onJobTextChange(text); setMode("paste"); }} />}

        {mode === "saved" && selectedJob && !selectedJob.job_text && (
          <Notice tone="info" className="mt-3">
            This job has no saved description, so it&apos;s assessed from its title and skills. Paste the full spec for a sharper score.
          </Notice>
        )}
      </div>

      <div className="px-5 pb-5 pt-4 space-y-4 border-t border-[var(--border-soft)]">
        <RequirementsInput requirements={requirements} setRequirements={setRequirements} />
        {showClientEmail ? (
          <div>
            <Label htmlFor="client-email" hint="Optional">Client email</Label>
            <Input id="client-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="hiring.manager@client.com" />
            <p className="text-[11.5px] text-[var(--ink-faint)] mt-1.5">Used to send shortlist updates and feedback chasers from the report.</p>
          </div>
        ) : (
          <button type="button" onClick={() => setShowClientEmail(true)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
            <Icon name="plus" size={14} /> Add client email
          </button>
        )}
      </div>
    </Card>
  );
}
