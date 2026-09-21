"use client";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS
 * ------------------------------------------------------------------------
 * - Route: /dashboard/jobs/[id]. `params` read synchronously - see the
 *   candidate profile page's header comment for the Next.js 15 note.
 * - Candidate ranking reuses getJobCandidates(jobId) from lib/mock-data.js
 *   (already sorted by score, descending).
 * ---------------------------------------------------------------------- */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { getJobById, getJobCandidates, updateJobStatus, updateJob, deleteJob } from "@/lib/dashboard-api";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { INK, INK_MUTED, INK_FAINT, GREEN_BG, CARD, scoreColor, scoreLabel, initials } from "@/lib/candidate-format";

async function fetchJob(id) {
  const job = await getJobById(id).catch(() => null);
  if (!job) return null;
  const candidates = await getJobCandidates(id);
  return { job, candidates };
}

function FieldLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
      {children}
    </p>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-[10px] p-3 text-center" style={{ background: "var(--mist)" }}>
      <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: accent ?? INK }}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: INK_FAINT }}>
        {label}
      </p>
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold"
      style={{ background: "var(--mist)", color: "var(--forest)" }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

function StageBadge({ stage, status }) {
  if (status !== "completed") {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_FAINT }}>
        {status === "failed" ? "Failed" : "Processing"}
      </span>
    );
  }
  if (!stage || !STAGE_LABELS[stage]) return null;
  const isPlaced = stage === "Placed";
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: isPlaced ? GREEN_BG : "var(--mist)", color: isPlaced ? "var(--forest)" : INK_MUTED }}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

function RankedCandidateRow({ candidate, rank }) {
  return (
    <li>
      <Link
        href={`/dashboard/candidates/${candidate.id}`}
        className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-[10px] transition-colors hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="w-5 text-[12px] tabular-nums text-right shrink-0" style={{ fontFamily: "var(--font-mono)", color: INK_FAINT }}>
          {rank}
        </span>
        <Avatar name={candidate.fullName} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: INK }}>
            {candidate.fullName}
          </p>
          <p className="text-[12px] truncate" style={{ color: INK_MUTED }}>
            {candidate.recruiterName ?? "Unassigned"}
          </p>
        </div>
        <div className="hidden sm:block shrink-0">
          <StageBadge stage={candidate.stage} status={candidate.status} />
        </div>
        <div className="text-right shrink-0 w-10">
          <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: scoreColor(candidate.score) }}>
            {candidate.score ?? "-"}
          </span>
        </div>
      </Link>
    </li>
  );
}

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function JobDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading job">
      <div className="rounded-[16px] p-8" style={CARD}>
        <Block className="h-4 w-32 mb-4" />
        <Block className="h-6 w-64 mb-2" />
        <Block className="h-4 w-40" />
      </div>
      <div className="rounded-[14px] p-6" style={CARD}>
        <Block className="h-4 w-40 mb-4" />
        <Block className="h-24 w-full" />
      </div>
    </div>
  );
}

function StateMessage({ title, body, onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        {title}
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        {body}
      </p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--forest)", color: "white" }}
          >
            Try again
          </button>
        )}
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Back to jobs
        </Link>
      </div>
    </div>
  );
}

function TextField({ label, ...props }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>{label}</span>
      <input
        {...props}
        className="w-full text-[13px] px-3 py-2 rounded-[8px] bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ border: "1px solid var(--border)", color: INK }}
      />
    </label>
  );
}

// Edits the structured fields a recruiter would actually want to fix
// (title, client, location, seniority, employment type, minimum
// experience, skills) - not the raw job spec text, which every future
// analysis against this job re-parses fresh rather than reading back from
// here (see api/jobs/[id]'s PATCH handler comment).
function EditJobForm({ job, onCancel, onSave }) {
  const [form, setForm] = useState({
    title: job.title || "",
    client: job.company || "",
    location: job.location || "",
    employmentType: job.employmentType || "",
    seniority: job.seniority || "",
    minYearsExperience: job.minYearsExperience ?? "",
    requiredSkills: (job.requiredSkills || []).join(", "),
    preferredSkills: (job.preferredSkills || []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function parseSkills(value) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: form.title.trim(),
        client: form.client.trim() || null,
        location: form.location.trim() || null,
        employmentType: form.employmentType.trim() || null,
        seniority: form.seniority.trim() || null,
        minYearsExperience: form.minYearsExperience === "" ? null : Number(form.minYearsExperience),
        requiredSkills: parseSkills(form.requiredSkills),
        preferredSkills: parseSkills(form.preferredSkills),
      });
    } catch (err) {
      setError(err?.message || "Failed to save changes. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField label="Title" value={form.title} onChange={(e) => set("title", e.target.value)} required maxLength={200} />
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField label="Client" value={form.client} onChange={(e) => set("client", e.target.value)} maxLength={200} />
        <TextField label="Location" value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={200} />
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <TextField label="Seniority" value={form.seniority} onChange={(e) => set("seniority", e.target.value)} maxLength={50} />
        <TextField label="Employment type" value={form.employmentType} onChange={(e) => set("employmentType", e.target.value)} maxLength={50} />
        <TextField
          label="Min. years experience"
          type="number"
          min={0}
          max={60}
          value={form.minYearsExperience}
          onChange={(e) => set("minYearsExperience", e.target.value)}
        />
      </div>
      <TextField
        label="Required skills (comma-separated)"
        value={form.requiredSkills}
        onChange={(e) => set("requiredSkills", e.target.value)}
      />
      <TextField
        label="Preferred skills (comma-separated)"
        value={form.preferredSkills}
        onChange={(e) => set("preferredSkills", e.target.value)}
      />

      {error && (
        <p className="text-[12px]" style={{ color: "var(--score-low)" }}>{error}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="text-[12px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-[12px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function JobDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [stageFilter, setStageFilter] = useState("all");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchJob(id)
      .then((d) => {
        if (cancelled) return;
        if (!d) {
          setStatus("not-found");
          return;
        }
        setData(d);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleToggleStatus = useCallback(async () => {
    if (!data?.job) return;
    const nextStatus = data.job.status === "open" ? "closed" : "open";
    setUpdatingStatus(true);
    try {
      await updateJobStatus(data.job.id, nextStatus);
      setData((d) => ({ ...d, job: { ...d.job, status: nextStatus } }));
    } catch (err) {
      alert(err?.message || "Failed to update this role's status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  }, [data]);

  const handleSaveEdit = useCallback(
    async (fields) => {
      const updated = await updateJob(id, fields);
      setData((d) => ({ ...d, job: { ...d.job, ...updated } }));
      setEditing(false);
    },
    [id]
  );

  const handleDelete = useCallback(async () => {
    if (!data?.job) return;
    if (data.job.candidateCount > 0) return;
    if (!window.confirm(`Delete "${data.job.title}"? This can't be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteJob(data.job.id);
      router.push("/dashboard/jobs");
    } catch (err) {
      setDeleteError(err?.message || "Failed to delete this role. Please try again.");
      setDeleting(false);
    }
  }, [data, router]);

  const job = data?.job;
  const candidates = data?.candidates ?? [];
  const filteredCandidates = stageFilter === "all" ? candidates : candidates.filter((c) => c.stage === stageFilter);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {status === "loading" && <JobDetailSkeleton />}
        {status === "error" && <StateMessage title="Unable to load job" body="Something went wrong while loading this role." onRetry={retry} />}
        {status === "not-found" && <StateMessage title="Job not found" body="This role may have been removed, or the link is out of date." />}

        {status === "ready" && job && (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Link href="/dashboard/jobs" className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded" style={{ color: "var(--forest)" }}>
                ← All jobs
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href={`/dashboard/candidates?jobId=${job.id}`}
                  className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
                  style={{ color: "var(--forest)" }}
                >
                  Open in candidate database →
                </Link>
                <Link
                  href={`/analyse?jobId=${job.id}&mode=bulk`}
                  className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
                  style={{ color: "var(--forest)" }}
                >
                  Bulk screen candidates →
                </Link>
                <Link
                  href={`/analyse?jobId=${job.id}`}
                  className="inline-flex items-center text-[12px] font-semibold px-3.5 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: "var(--forest)", color: "white" }}
                >
                  Analyse a candidate →
                </Link>
              </div>
            </div>

            <header className="rounded-[16px] p-6 sm:p-8" style={CARD}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", color: INK }}>
                    {job.title}
                  </h1>
                  <p className="text-sm mt-1" style={{ color: INK_MUTED }}>
                    {job.company} · {job.location}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: job.status === "open" ? GREEN_BG : "var(--mist)", color: job.status === "open" ? "var(--forest)" : INK_MUTED }}
                  >
                    {job.status === "open" ? "Open" : "Closed"}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={updatingStatus}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                    style={{ border: "1px solid var(--border)", color: INK_MUTED }}
                  >
                    {updatingStatus ? "Updating…" : job.status === "open" ? "Mark as closed" : "Reopen role"}
                  </button>
                  {!editing && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ border: "1px solid var(--border)", color: INK_MUTED }}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting || job.candidateCount > 0}
                    title={job.candidateCount > 0 ? "Candidates are attached to this role - mark it closed instead of deleting it." : undefined}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
                    style={{ border: "1px solid var(--border)", color: "var(--score-low)" }}
                  >
                    {deleting ? "Deleting…" : "Delete role"}
                  </button>
                </div>
              </div>

              {deleteError && (
                <p className="text-[12px] mb-4" style={{ color: "var(--score-low)" }}>{deleteError}</p>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
                <Stat label="Candidates" value={job.candidateCount} />
                <Stat label="Strong" value={job.strongMatches} accent="var(--forest)" />
                <Stat label="Shortlisted" value={job.shortlisted} />
                <Stat label="Interview" value={job.interviewing} />
                <Stat label="Offer" value={job.offers} />
                <Stat label="Placed" value={job.placed} accent="var(--forest)" />
              </div>

              {editing ? (
                <div className="pt-5" style={{ borderTop: "1px solid var(--border)" }}>
                  <EditJobForm job={job} onCancel={() => setEditing(false)} onSave={handleSaveEdit} />
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
                  <div>
                    <FieldLabel>Role details</FieldLabel>
                    <ul className="text-[13px] space-y-1" style={{ color: INK }}>
                      <li>{job.seniority} · {job.employmentType}</li>
                      <li>{job.salaryRange}</li>
                      <li>{job.minYearsExperience}+ years' experience</li>
                    </ul>
                  </div>
                  <div>
                    <FieldLabel>Required skills</FieldLabel>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {job.requiredSkills.map((s) => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_MUTED }}>
                          {s}
                        </span>
                      ))}
                    </div>
                    {job.preferredSkills.length > 0 && (
                      <>
                        <FieldLabel>Preferred skills</FieldLabel>
                        <div className="flex flex-wrap gap-1.5">
                          {job.preferredSkills.map((s) => (
                            <span key={s} className="text-[11px] px-2 py-0.5 rounded-full" style={{ border: "1px dashed var(--border)", color: INK_MUTED }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </header>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
                  Candidates ranked by fit
                </h2>
                <select
                  aria-label="Filter by stage"
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ border: "1px solid var(--border)", color: INK }}
                >
                  <option value="all">All stages</option>
                  {Object.entries(STAGE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {filteredCandidates.length === 0 ? (
                <p className="text-[13px] py-6 text-center" style={{ color: INK_MUTED }}>
                  No candidates match this filter yet.
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {filteredCandidates.map((c, i) => (
                    <RankedCandidateRow key={c.id} candidate={c} rank={i + 1} />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

