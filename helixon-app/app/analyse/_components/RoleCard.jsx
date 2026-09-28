"use client";

// "What are you hiring for?" - pick one of the agency's saved jobs, build a
// spec from a few questions (for hirers who don't have one - common for
// warehouse, care, kitchen, retail and site work), paste an advert, upload
// a spec file, or start from a template. Must-haves and the client's email
// sit underneath because they apply whichever way the role was chosen.

import { useMemo, useRef, useState } from "react";
import { Card, CardHeader, Textarea, Input, Label, Icon, Button, Notice, cx } from "./ui";
import { ChipInput, MethodPicker, RoleBuilder, SpecChecklist, TemplateGallery } from "./RoleInputs";
import { JOB_ACCEPT, formatBytes } from "../_lib/analyse";
import { composeRoleText, guessJobType, mustHaveSuggestions } from "../_lib/roles";

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

export default function RoleCard({
  savedJobs,
  existingJobId,
  jobText,
  jobFile,
  mode,
  setMode,
  roleDraft,
  setRoleDraft,
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

  const methods = [...(savedJobs.length ? ["saved"] : []), "build", "paste", "upload", "template"];

  // Must-have suggestions follow the kind of work - picked in the builder,
  // or guessed from a pasted advert.
  const jobType = mode === "build" ? roleDraft.jobType : guessJobType(jobText);

  const selectedJob = savedJobs.find((j) => j.id === existingJobId);
  const charCount = jobText.trim().length;

  return (
    <Card className={cx(disabled && "opacity-60 pointer-events-none")}>
      <CardHeader title="What are you hiring for?" description="Any job, from warehouse floor to boardroom. Paste an advert, upload a file, or build one in a minute." />
      <div className="px-5 pt-4">
        <MethodPicker value={mode} onChange={setMode} methods={methods} counts={{ saved: savedJobs.length }} />
      </div>

      <div className="px-5 py-4">
        {mode === "saved" && <SavedJobList jobs={savedJobs} selectedId={existingJobId} onSelect={onSelectSavedJob} />}

        {mode === "build" && (
          <RoleBuilder
            draft={roleDraft}
            onChange={(next) => {
              setRoleDraft(next);
              onJobTextChange(composeRoleText(next));
            }}
            onEditAsText={(text) => {
              onJobTextChange(text);
              setMode("paste");
            }}
          />
        )}

        {mode === "paste" && (
          <div>
            <Textarea
              id="job-text"
              value={jobText}
              onChange={(e) => onJobTextChange(e.target.value)}
              rows={10}
              placeholder={"Paste the job advert or description - any format works.\n\nFor example:\nWarehouse Operative, Leeds - £12.50/hour, nights\nPicking and packing orders, loading deliveries.\nMust have: right to work in the UK, forklift licence."}
              aria-label="Job description"
              className="min-h-[220px]"
            />
            <div className="mt-3 space-y-2">
              <SpecChecklist text={jobText} />
              <div className="flex items-center justify-between">
                <span className={cx("text-[11.5px] tabular-nums", charCount > 0 && charCount < MIN_JOB_CHARS ? "text-[var(--score-mid)]" : "text-[var(--ink-faint)]")}>
                  {charCount > 0 && charCount < MIN_JOB_CHARS ? `${MIN_JOB_CHARS - charCount} more characters needed` : charCount > 0 ? `${charCount.toLocaleString()} characters` : ""}
                </span>
                {charCount >= MIN_JOB_CHARS && (
                  <button type="button" onClick={onSaveTemplate} className="text-[12px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
                    Save as template
                  </button>
                )}
              </div>
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
              <span className="text-[12px] text-[var(--ink-faint)]">PDF, Word or .txt · up to 10 MB · a photo of a printed advert won&apos;t work - paste the text instead</span>
            </button>
          ))}
        <input ref={fileRef} type="file" accept={JOB_ACCEPT} className="hidden" onChange={(e) => { onJobFile(e.target.files?.[0] || null); e.target.value = ""; }} />

        {mode === "template" && <TemplateGallery onPick={(text) => { onJobTextChange(text); setMode("paste"); }} />}

        {mode === "saved" && selectedJob && !selectedJob.job_text && (
          <Notice tone="info" className="mt-3">
            This job has no saved description, so it&apos;s assessed from its title and skills. Paste the full spec for a sharper score.
          </Notice>
        )}
      </div>

      <div className="px-5 pb-5 pt-4 space-y-4 border-t border-[var(--border-soft)]">
        {mode !== "build" && (
          <ChipInput
            id="must-have"
            label="Extra must-haves"
            hint="Optional"
            values={requirements}
            onChange={setRequirements}
            suggestions={mustHaveSuggestions(jobType)}
            placeholder='e.g. "Right to work in the UK", "Forklift licence", "Managed a team of 5+"'
            help="Plain English. Each one is checked against the CV and shown as met, not met or to confirm."
          />
        )}
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
