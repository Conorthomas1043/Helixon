"use client";

// /dashboard/jobs/[id] - one role: its requirements (editable), open/closed
// status, sourcing channels, and its candidates ranked by match score
// (app/api/jobs/[id] and /candidates).

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { getJobById, getJobCandidates, updateJobStatus, updateJob, deleteJob, getJobChannels, setJobChannel, getRecruiters, createJob } from "@/lib/dashboard-api";
import { JOB_PRIORITIES, daysToTarget } from "@/lib/job-details";
import { STAGE_LABELS } from "@/lib/stage-labels";
import ClientPicker from "@/components/dashboard/ClientPicker";
import AdvertisePanel from "@/components/dashboard/AdvertisePanel";
import { CustomFieldsCard } from "@/components/dashboard/custom-fields";
import { useOffices } from "@/components/dashboard/use-offices";
import { INK, INK_MUTED, INK_FAINT, GREEN_BG, CARD, scoreColor, scoreLabel, initials } from "@/lib/candidate-format";
import { useConfirm } from "@/components/dashboard/use-confirm";

async function fetchJob(id) {
  const job = await getJobById(id).catch(() => null);
  if (!job) return null;
  const [candidates, channels, team] = await Promise.all([
    getJobCandidates(id),
    getJobChannels(id).catch(() => []),
    getRecruiters().catch(() => []),
  ]);
  return { job, candidates, channels, team };
}

const CHANNEL_LABELS = {
  referral: "Referral",
  job_board: "Job board",
  linkedin: "LinkedIn",
  direct_sourcing: "Direct sourcing",
  agency_database: "Agency database",
  careers_page: "Your jobs page",
  other: "Other",
};
const CHANNEL_KEYS = Object.keys(CHANNEL_LABELS);

function ChannelRow({ channelKey, value, onSave }) {
  const [clicks, setClicks] = useState(value?.clicks ?? 0);
  const [spend, setSpend] = useState(value?.spend ?? 0);
  const [saving, setSaving] = useState(false);

  // Follow the saved figures when they change, during render rather than
  // in an effect's extra render.
  const savedKey = `${value?.clicks ?? 0}|${value?.spend ?? 0}`;
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (syncedKey !== savedKey) {
    setSyncedKey(savedKey);
    setClicks(value?.clicks ?? 0);
    setSpend(value?.spend ?? 0);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(channelKey, { clicks: Number(clicks) || 0, spend: Number(spend) || 0 });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-[13px] font-medium w-32 shrink-0" style={{ color: INK }}>
        {CHANNEL_LABELS[channelKey]}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          value={clicks}
          onChange={(e) => setClicks(e.target.value)}
          onBlur={save}
          aria-label={`${CHANNEL_LABELS[channelKey]} clicks/applicants seen`}
          className="w-20 text-[13px] px-2 py-1.5 rounded-[8px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        />
        <span className="text-[11px]" style={{ color: INK_FAINT }}>clicks</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          step="0.01"
          value={spend}
          onChange={(e) => setSpend(e.target.value)}
          onBlur={save}
          aria-label={`${CHANNEL_LABELS[channelKey]} spend`}
          className="w-24 text-[13px] px-2 py-1.5 rounded-[8px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        />
        <span className="text-[11px]" style={{ color: INK_FAINT }}>spend {saving ? "· saving…" : ""}</span>
      </div>
    </div>
  );
}

function SourcingChannelsPanel({ channels, onSaveChannel }) {
  const byChannel = new Map((channels || []).map((c) => [c.channel, c]));
  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-display)", color: INK }}>
        Sourcing channels
      </h2>
      <p className="text-[12px] mb-4" style={{ color: INK_MUTED }}>
        Self-reported - whatever your job board/LinkedIn campaign dashboard shows. Combined with each candidate&apos;s
        source (set on their profile) for apply rate and cost per applicant in Analytics.
      </p>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {CHANNEL_KEYS.map((key) => (
          <ChannelRow key={key} channelKey={key} value={byChannel.get(key)} onSave={onSaveChannel} />
        ))}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
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
      <p className="text-[11px] uppercase tracking-wide mt-0.5" style={{ color: INK_FAINT }}>
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
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_FAINT }}>
        {status === "failed" ? "Failed" : "Processing"}
      </span>
    );
  }
  if (!stage || !STAGE_LABELS[stage]) return null;
  const isPlaced = stage === "Placed";
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
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
      <span className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>{label}</span>
      <input
        {...props}
        className="w-full text-[13px] px-3 py-2 rounded-[8px] bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ border: "1px solid var(--border)", color: INK }}
      />
    </label>
  );
}

// Edits the structured fields a recruiter would actually want to fix
// (title, client and their contact email, location, salary range,
// seniority, employment type, minimum experience, skills) - not the raw job spec text, which every future
// analysis against this job re-parses fresh rather than reading back from
// here (see api/jobs/[id]'s PATCH handler comment).
const SELECT_CLASS = "w-full text-[13px] px-3 py-2 rounded-[8px] bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function SelectField({ label, children, ...props }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>{label}</span>
      <select {...props} className={SELECT_CLASS} style={{ border: "1px solid var(--border)", color: INK }}>
        {children}
      </select>
    </label>
  );
}

function EditJobForm({ job, team = [], onCancel, onSave }) {
  const offices = useOffices();
  const [client, setClient] = useState({
    clientId: job.clientId ?? null,
    clientName: job.company || "",
    contactId: job.contactId ?? null,
    contactEmail: null,
  });
  const [form, setForm] = useState({
    title: job.title || "",
    clientEmail: job.clientEmail || "",
    location: job.location || "",
    salaryRange: job.salaryRange || "",
    employmentType: job.employmentType || "",
    seniority: job.seniority || "",
    minYearsExperience: job.minYearsExperience ?? "",
    requiredSkills: (job.requiredSkills || []).join(", "),
    preferredSkills: (job.preferredSkills || []).join(", "),
    ownerId: job.ownerId || "",
    openings: job.openings ?? "",
    feePercent: job.feePercent ?? "",
    feeAmount: job.feeAmount ?? "",
    priority: job.priority || "",
    targetDate: job.targetDate || "",
    officeId: job.officeId || "",
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
        clientId: client.clientId,
        client: client.clientId ? undefined : client.clientName.trim() || null,
        contactId: client.contactId,
        ...(client.contactId ? {} : { clientEmail: form.clientEmail.trim() || null }),
        location: form.location.trim() || null,
        salaryRange: form.salaryRange.trim() || null,
        employmentType: form.employmentType.trim() || null,
        seniority: form.seniority.trim() || null,
        minYearsExperience: form.minYearsExperience === "" ? null : Number(form.minYearsExperience),
        requiredSkills: parseSkills(form.requiredSkills),
        preferredSkills: parseSkills(form.preferredSkills),
        ownerId: form.ownerId || null,
        openings: form.openings === "" ? null : Number(form.openings),
        feePercent: form.feePercent === "" ? null : form.feePercent,
        feeAmount: form.feeAmount === "" ? null : form.feeAmount,
        priority: form.priority || null,
        targetDate: form.targetDate || null,
        ...(offices.length || job.officeId ? { officeId: form.officeId || null } : {}),
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
        <ClientPicker value={client} onChange={setClient} />
        <TextField label="Location" value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={200} />
        {!client.contactId && (
          <TextField
            label="Client contact email"
            type="email"
            value={form.clientEmail}
            onChange={(e) => set("clientEmail", e.target.value)}
            maxLength={254}
            placeholder="hiring.manager@client.com"
          />
        )}
        <TextField label="Salary range" value={form.salaryRange} onChange={(e) => set("salaryRange", e.target.value)} maxLength={80} placeholder="£40k–£50k" />
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
      <div className="grid sm:grid-cols-3 gap-4">
        <SelectField label="Owner" value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
          <option value="">Not assigned</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </SelectField>
        {offices.length > 0 && (
          <SelectField label="Office / brand" value={form.officeId} onChange={(e) => set("officeId", e.target.value)}>
            <option value="">None</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </SelectField>
        )}
        <SelectField label="Priority" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
          <option value="">Normal</option>
          {Object.entries(JOB_PRIORITIES).filter(([k]) => k !== "normal").map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </SelectField>
        <TextField label="Target fill date" type="date" value={form.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
        <TextField label="Openings" type="number" min={1} max={1000} value={form.openings} onChange={(e) => set("openings", e.target.value)} placeholder="1" />
        <TextField label="Fee % (this job)" type="number" min={0} max={100} step="0.5" value={form.feePercent} onChange={(e) => set("feePercent", e.target.value)} placeholder="Client's standard" />
        <TextField label="Fixed fee (this job)" type="number" min={0} step="100" value={form.feeAmount} onChange={(e) => set("feeAmount", e.target.value)} placeholder="£" />
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
  const [ask, confirmDialog] = useConfirm();
  const offices = useOffices();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
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
    setDeleteError(null);
    try {
      await updateJobStatus(data.job.id, nextStatus);
      setData((d) => ({ ...d, job: { ...d.job, status: nextStatus } }));
    } catch (err) {
      setDeleteError(err?.message || "Couldn't update this role's status. Please try again.");
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

  // A new job with the same details - for a client hiring the same role
  // again, or a near-identical one.
  const [duplicating, setDuplicating] = useState(false);
  const handleDuplicate = useCallback(async () => {
    const j = data?.job;
    if (!j) return;
    setDuplicating(true);
    setDeleteError(null);
    try {
      const copy = await createJob({
        title: `${j.title} (copy)`.slice(0, 160),
        clientId: j.clientId || undefined,
        company: j.clientId ? undefined : j.company || undefined,
        contactId: j.contactId || undefined,
        clientEmail: j.contactId ? undefined : j.clientEmail || undefined,
        location: j.location,
        employmentType: j.employmentType,
        seniority: j.seniority,
        salaryRange: j.salaryRange,
        requiredSkills: j.requiredSkills,
        preferredSkills: j.preferredSkills,
        minYearsExperience: j.minYearsExperience,
        jobText: j.job_text || [j.title, j.requiredSkills?.join(", "), j.preferredSkills?.join(", ")].filter(Boolean).join("\n"),
      });
      router.push(`/dashboard/jobs/${copy.id}`);
    } catch (err) {
      setDeleteError(err?.message || "Couldn't duplicate this job.");
      setDuplicating(false);
    }
  }, [data, router]);

  const handleDelete = useCallback(async () => {
    if (!data?.job) return;
    if (data.job.candidateCount > 0) return;
    if (!(await ask({ title: `Delete "${data.job.title}"?`, body: "This can't be undone.", confirmLabel: "Delete job", danger: true }))) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteJob(data.job.id);
      router.push("/dashboard/jobs");
    } catch (err) {
      setDeleteError(err?.message || "Couldn't delete this job. Please try again.");
      setDeleting(false);
    }
  }, [data, router, ask]);

  const handleSaveChannel = useCallback(
    async (channel, { clicks, spend }) => {
      const saved = await setJobChannel(id, { channel, clicks, spend }).catch(() => null);
      if (saved) {
        setData((d) => ({
          ...d,
          channels: [...(d.channels || []).filter((c) => c.channel !== channel), saved],
        }));
      }
    },
    [id]
  );

  const job = data?.job;
  const candidates = data?.candidates ?? [];
  const filteredCandidates = stageFilter === "all" ? candidates : candidates.filter((c) => c.stage === stageFilter);

  return (
    <>
      {confirmDialog}
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
                    {job.clientId ? (
                      <Link href={`/dashboard/clients/${job.clientId}`} className="underline">
                        {job.company}
                      </Link>
                    ) : (
                      job.company
                    )}
                    {job.company && job.location ? " · " : ""}
                    {job.location}
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
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
                    style={{ border: "1px solid var(--border)", color: INK_MUTED }}
                  >
                    {duplicating ? "Duplicating…" : "Duplicate"}
                  </button>
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
                  <EditJobForm job={job} team={data.team || []} onCancel={() => setEditing(false)} onSave={handleSaveEdit} />
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
                  <div>
                    <FieldLabel>Role details</FieldLabel>
                    <ul className="text-[13px] space-y-1" style={{ color: INK }}>
                      {(job.seniority || job.employmentType) && <li>{[job.seniority, job.employmentType].filter(Boolean).join(" · ")}</li>}
                      {job.salaryRange && <li>{job.salaryRange}</li>}
                      {job.minYearsExperience != null && <li>{job.minYearsExperience}+ years&apos; experience</li>}
                      {job.officeId && offices.some((o) => o.id === job.officeId) && <li>Office: {offices.find((o) => o.id === job.officeId).name}</li>}
                      <li>
                        Owner: {(data.team || []).find((m) => m.id === job.ownerId)?.name || <span style={{ color: INK_FAINT }}>not assigned</span>}
                        {job.priority && job.priority !== "normal" && (
                          <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: job.priority === "urgent" || job.priority === "high" ? "rgba(192,57,43,0.10)" : "var(--mist)", color: job.priority === "urgent" || job.priority === "high" ? "var(--score-low)" : INK_MUTED }}>
                            {JOB_PRIORITIES[job.priority]}
                          </span>
                        )}
                      </li>
                      {(job.openings || job.targetDate) && (
                        <li>
                          {job.openings ? `${job.openings} opening${job.openings === 1 ? "" : "s"}` : null}
                          {job.openings && job.targetDate ? " · " : null}
                          {job.targetDate ? (() => {
                            const d = daysToTarget(job.targetDate);
                            const when = new Date(`${job.targetDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
                            return <span style={{ color: d != null && d < 0 && job.status === "open" ? "var(--score-low)" : INK }}>Fill by {when}{d != null && job.status === "open" ? (d < 0 ? ` (${-d} days overdue)` : ` (${d} days left)`) : ""}</span>;
                          })() : null}
                        </li>
                      )}
                      {(job.feePercent != null || job.feeAmount != null) && (
                        <li>Fee: {job.feeAmount != null ? `£${job.feeAmount.toLocaleString("en-GB")}` : `${job.feePercent}% of salary`}</li>
                      )}
                      <li style={{ color: job.clientEmail ? INK : INK_FAINT }}>
                        {job.clientEmail ? (
                          <>Client contact: <a href={`mailto:${job.clientEmail}`} className="underline">{job.clientEmail}</a></>
                        ) : (
                          <>No client contact email - <button type="button" onClick={() => setEditing(true)} className="underline font-semibold" style={{ color: "var(--forest)" }}>add one</button> so client emails and feedback requests can be sent</>
                        )}
                      </li>
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
                <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href={`/dashboard/talent-pool?jobId=${job.id}`}
                  className="inline-flex items-center text-[12px] font-semibold px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ border: "1px solid var(--forest)", color: "var(--forest)", background: "white" }}
                  title="See who in your talent pool fits this job, and screen them without re-uploading CVs"
                >
                  ☆ Find in talent pool
                </Link>
                {(data?.candidates?.length ?? 0) >= 2 && (
                  <Link
                    href={`/analyse/compare?jobId=${job.id}`}
                    className="inline-flex items-center text-[12px] font-semibold px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
                  >
                    Compare candidates
                  </Link>
                )}
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
              </div>

              {filteredCandidates.length === 0 ? (
                <p className="text-[13px] py-6 text-center" style={{ color: INK_MUTED }}>
                  {candidates.length === 0 ? (
                    <>
                      No candidates yet.{" "}
                      <Link href={`/dashboard/talent-pool?jobId=${job.id}`} className="font-semibold underline" style={{ color: "var(--forest)" }}>
                        Check your talent pool
                      </Link>{" "}
                      for people you&apos;ve already screened, or{" "}
                      <Link href={`/analyse?jobId=${job.id}`} className="font-semibold underline" style={{ color: "var(--forest)" }}>
                        analyse a new CV
                      </Link>
                      .
                    </>
                  ) : (
                    "No candidates match this filter yet."
                  )}
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {filteredCandidates.map((c, i) => (
                    <RankedCandidateRow key={c.id} candidate={c} rank={i + 1} />
                  ))}
                </ul>
              )}
            </div>

            <CustomFieldsCard key={job.id} entity="job" recordId={job.id} values={job.custom_fields} />

            <AdvertisePanel job={job} onSaved={(updated) => setData((d) => ({ ...d, job: { ...d.job, ...updated } }))} />

            <SourcingChannelsPanel channels={data?.channels} onSaveChannel={handleSaveChannel} />
          </>
        )}
      </div>
    </main>
    </>
  );
}

