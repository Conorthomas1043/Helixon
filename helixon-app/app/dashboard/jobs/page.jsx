"use client";

// /dashboard/jobs - every role the agency is hiring for, with live candidate
// counts (app/api/jobs). Jobs are created here directly, or as a side effect
// of screening a CV against a new job description on /analyse.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { getJobs as fetchJobs, createJob } from "@/lib/dashboard-api";
import { INK, INK_MUTED, INK_FAINT, GREEN_BG, CARD } from "@/lib/candidate-format";

function Stat({ label, value, accent }) {
  return (
    <div>
      <p className="text-base font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: accent ?? INK }}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: INK_FAINT }}>
        {label}
      </p>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_MUTED }}>
      {children}
    </span>
  );
}

function JobCard({ job }) {
  return (
    <div className="rounded-[14px] p-5 transition-colors hover:bg-[var(--mist)]" style={CARD}>
      <Link
        href={`/dashboard/jobs/${job.id}`}
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-[10px]"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: INK }}>
              {job.title}
            </p>
            <p className="text-[12px] truncate" style={{ color: INK_MUTED }}>
              {job.company} · {job.location}
            </p>
          </div>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: job.status === "open" ? GREEN_BG : "var(--mist)", color: job.status === "open" ? "var(--forest)" : INK_MUTED }}
          >
            {job.status === "open" ? "Open" : "Closed"}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <Chip>{job.seniority}</Chip>
          <Chip>{job.employmentType}</Chip>
          <Chip>{job.salaryRange}</Chip>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <Stat label="Candidates" value={job.candidateCount} />
          <Stat label="Strong" value={job.strongMatches} accent="var(--forest)" />
          <Stat label="Interview" value={job.interviewing} />
          <Stat label="Placed" value={job.placed} accent="var(--forest)" />
        </div>
      </Link>

      <Link
        href={`/analyse?jobId=${job.id}`}
        className="inline-flex items-center text-[12px] font-semibold mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
        style={{ color: "var(--forest)" }}
      >
        Analyse a candidate for this role →
      </Link>
    </div>
  );
}

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function JobsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading jobs">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[14px] p-5" style={CARD}>
          <Block className="h-4 w-32 mb-2" />
          <Block className="h-3 w-40 mb-4" />
          <Block className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        Unable to load jobs
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        Something went wrong while loading your open roles.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--forest)", color: "white" }}
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <div className="rounded-[16px] flex flex-col items-center text-center py-14 px-6" style={CARD}>
      <p className="text-sm font-semibold mb-1" style={{ color: INK }}>
        No jobs yet
      </p>
      <p className="text-[13px] max-w-sm mb-5" style={{ color: INK_MUTED }}>
        Add a role you&apos;re hiring for, or screen a CV against a job description and the role is saved for you.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "var(--forest)", color: "white" }}
        >
          Add a job
        </button>
        <Link
          href="/analyse"
          className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Screen a CV
        </Link>
      </div>
    </div>
  );
}

const MIN_DESCRIPTION = 50;

function splitSkills(text) {
  return text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold mb-1" style={{ color: INK }}>{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] mt-1" style={{ color: INK_FAINT }}>{hint}</span>}
    </label>
  );
}

// Adds a role directly, instead of only as a side effect of screening a CV.
function NewJobDialog({ onCancel, onCreated }) {
  const [f, setF] = useState({
    title: "",
    company: "",
    clientEmail: "",
    location: "",
    employmentType: "",
    seniority: "",
    salaryRange: "",
    minYearsExperience: "",
    requiredSkills: "",
    preferredSkills: "",
    jobText: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef(null);
  const set = (key) => (e) => setF((v) => ({ ...v, [key]: e.target.value }));

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" && !saving) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onCancel]);

  async function submit(e) {
    e.preventDefault();
    if (f.jobText.trim().length < MIN_DESCRIPTION) {
      setError(`Add the job description (at least ${MIN_DESCRIPTION} characters) - CVs are screened against it.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const job = await createJob({
        title: f.title.trim(),
        company: f.company.trim(),
        clientEmail: f.clientEmail.trim(),
        location: f.location.trim(),
        employmentType: f.employmentType.trim(),
        seniority: f.seniority.trim(),
        salaryRange: f.salaryRange.trim(),
        minYearsExperience: f.minYearsExperience === "" ? null : Number(f.minYearsExperience),
        requiredSkills: splitSkills(f.requiredSkills),
        preferredSkills: splitSkills(f.preferredSkills),
        jobText: f.jobText.trim(),
      });
      onCreated(job);
    } catch (err) {
      setError(err.message || "Couldn't create the job.");
      setSaving(false);
    }
  }

  const input = "w-full text-sm px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const inputStyle = { border: "1px solid var(--border)", color: INK, background: "white" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,32,27,0.45)" }}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-job-title"
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-[16px] p-6 bg-white shadow-xl"
      >
        <h2 id="new-job-title" className="text-base font-semibold mb-4" style={{ color: INK }}>New job</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Field label="Job title">
              <input ref={firstRef} required maxLength={160} value={f.title} onChange={set("title")} className={input} style={inputStyle} />
            </Field>
          </div>
          <Field label="Client"><input maxLength={160} value={f.company} onChange={set("company")} className={input} style={inputStyle} /></Field>
          <Field label="Client contact email"><input type="email" maxLength={254} placeholder="hiring.manager@client.com" value={f.clientEmail} onChange={set("clientEmail")} className={input} style={inputStyle} /></Field>
          <Field label="Location"><input maxLength={160} value={f.location} onChange={set("location")} className={input} style={inputStyle} /></Field>
          <Field label="Employment type"><input maxLength={60} placeholder="Permanent, contract…" value={f.employmentType} onChange={set("employmentType")} className={input} style={inputStyle} /></Field>
          <Field label="Seniority"><input maxLength={60} placeholder="Junior, mid, senior…" value={f.seniority} onChange={set("seniority")} className={input} style={inputStyle} /></Field>
          <Field label="Salary range"><input maxLength={80} placeholder="£40k–£50k" value={f.salaryRange} onChange={set("salaryRange")} className={input} style={inputStyle} /></Field>
          <Field label="Minimum years' experience"><input type="number" min={0} max={60} value={f.minYearsExperience} onChange={set("minYearsExperience")} className={input} style={inputStyle} /></Field>
          <div className="sm:col-span-2">
            <Field label="Required skills" hint="Separate with commas.">
              <input value={f.requiredSkills} onChange={set("requiredSkills")} className={input} style={inputStyle} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Nice-to-have skills" hint="Separate with commas.">
              <input value={f.preferredSkills} onChange={set("preferredSkills")} className={input} style={inputStyle} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Job description" hint={`CVs are screened against this - paste the full spec (at least ${MIN_DESCRIPTION} characters).`}>
              <textarea required rows={7} maxLength={20000} value={f.jobText} onChange={set("jobText")} className={input} style={inputStyle} />
            </Field>
          </div>
        </div>
        {error && <p role="alert" className="text-[12px] mt-3" style={{ color: "var(--score-low)" }}>{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Creating…" : "Create job"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchJobs()
      .then((j) => {
        if (cancelled) return;
        setJobs(j);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const closeNew = useCallback(() => setCreating(false), []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [sortBy, setSortBy] = useState("newest");

  // Search, open/closed and sort all happen here - the list is every job
  // the agency has, already loaded.
  const visibleJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (jobs ?? []).filter(
      (j) =>
        (statusFilter === "all" || (statusFilter === "open" ? j.status === "open" : j.status !== "open")) &&
        (!q || [j.title, j.company, j.location].filter(Boolean).join(" ").toLowerCase().includes(q))
    );
    const by = {
      newest: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
      oldest: (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
      candidates: (a, b) => (b.candidateCount ?? 0) - (a.candidateCount ?? 0),
      strong: (a, b) => (b.strongMatches ?? 0) - (a.strongMatches ?? 0),
      title: (a, b) => String(a.title || "").localeCompare(String(b.title || "")),
    }[sortBy];
    return [...list].sort(by);
  }, [jobs, search, statusFilter, sortBy]);

  const totalOpen = jobs?.filter((j) => j.status === "open").length ?? 0;
  const totalCandidates = jobs?.reduce((sum, j) => sum + j.candidateCount, 0) ?? 0;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Job workspace
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Jobs
            </h1>
            {status === "ready" && (
              <p className="text-[13px] mt-1" style={{ color: INK_MUTED }}>
                {totalOpen} open role{totalOpen === 1 ? "" : "s"} · {totalCandidates} candidates in play
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 self-start">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK }}
            >
              ← Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "var(--forest)", color: "white" }}
            >
              New job
            </button>
          </div>
        </header>

        {status === "loading" && <JobsSkeleton />}
        {status === "error" && <ErrorState onRetry={retry} />}
        {status === "ready" && jobs && jobs.length === 0 && <EmptyState onNew={() => setCreating(true)} />}
        {status === "ready" && jobs && jobs.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, client or location…"
                aria-label="Search jobs"
                className="text-[13px] px-4 py-2 rounded-full bg-white w-full sm:w-72 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              />
              {[
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
                { value: "all", label: "All" },
              ].map((o) => {
                const count = o.value === "all" ? jobs.length : jobs.filter((j) => (o.value === "open" ? j.status === "open" : j.status !== "open")).length;
                const on = statusFilter === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setStatusFilter(o.value)}
                    aria-pressed={on}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ background: on ? "var(--forest)" : "white", color: on ? "white" : INK_MUTED, border: `1px solid ${on ? "var(--forest)" : "var(--border)"}` }}
                  >
                    {o.label}
                    <span className="tabular-nums text-[10px] px-1.5 rounded-full" style={{ background: on ? "rgba(255,255,255,0.25)" : "var(--mist)" }}>
                      {count}
                    </span>
                  </button>
                );
              })}
              <select
                aria-label="Sort jobs"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sm:ml-auto text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="candidates">Most candidates</option>
                <option value="strong">Most strong matches</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
            {visibleJobs.length === 0 ? (
              <div className="rounded-[14px] p-8 text-center text-[13px]" style={{ ...CARD, color: INK_MUTED }}>
                No {statusFilter === "all" ? "" : `${statusFilter} `}jobs match{search.trim() ? ` "${search.trim()}"` : ""}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {creating && (
        <NewJobDialog onCancel={closeNew} onCreated={(job) => router.push(`/dashboard/jobs/${job.id}`)} />
      )}
    </main>
  );
}
