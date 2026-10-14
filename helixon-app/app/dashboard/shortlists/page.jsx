"use client";

// /dashboard/shortlists - named lists of candidates, usually the handful
// being put forward to a client for one job (app/api/shortlists). People
// are added from a candidate's profile or in bulk from Candidates; each
// list has a printable client pack (./[id]/client-pack).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { getShortlists, createShortlist, getJobs } from "@/lib/dashboard-api";
import { useResource } from "@/lib/hooks/useResource";
import { INK, INK_MUTED, INK_FAINT, CARD, formatDateOnly } from "@/lib/candidates/format";
import { Skeleton as Block } from "@/components/ui";
import { PAGE_FRAME_WIDE } from "@/components/dashboard/page-frame";

function NewShortlistForm({ jobs, onCreated }) {
  const [name, setName] = useState("");
  const [jobId, setJobId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const list = await createShortlist({ name: name.trim(), jobId: jobId || null });
      onCreated(list);
    } catch (err) {
      setError(err.message || "Couldn't create the shortlist.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-card p-4 flex flex-wrap items-end gap-3" style={CARD}>
      <label className="flex-1 min-w-[200px]">
        <span className="block text-12 font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>New shortlist</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="e.g. Acme - Senior Engineer, round 1"
          className="w-full text-14 px-3 py-2 rounded-lg bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        />
      </label>
      <label className="min-w-[180px]">
        <span className="block text-12 font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>For job (optional)</span>
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="w-full text-14 px-3 py-2 rounded-lg bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          <option value="">No job</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}{j.company ? ` · ${j.company}` : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="text-14 font-semibold px-4 py-2 rounded-full disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--forest)", color: "white" }}
      >
        {saving ? "Creating…" : "Create"}
      </button>
      {error && <p className="w-full text-13" style={{ color: "var(--score-low)" }}>{error}</p>}
    </form>
  );
}

export default function ShortlistsPage() {
  const router = useRouter();
  const { data: lists, error, reload: retry } = useResource("shortlists", getShortlists);
  // Only for the "new shortlist" form; the page works without it.
  const { data: allJobs } = useResource("jobs", getJobs);
  const jobs = useMemo(() => (allJobs ?? []).filter((x) => x.status === "open"), [allJobs]);
  const status = lists ? "ready" : error ? "error" : "loading";
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (lists ?? []).filter((l) => !q || [l.name, l.jobTitle, l.client].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [lists, search]);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className={`${PAGE_FRAME_WIDE} space-y-6`}>
        <header>
          <p className="text-12 font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
            Client submissions
          </p>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
            Client shortlists
          </h1>
          <p className="text-14 mt-1 max-w-2xl" style={{ color: INK_MUTED }}>
            Not the same as the Shortlisted stage: a client shortlist is what you send. Group the people you&apos;re putting forward, add a line on why each one, and print a client-ready pack. Add
            people from their profile, or select several on{" "}
            <Link href="/dashboard/candidates" className="underline font-semibold" style={{ color: "var(--forest)" }}>
              Candidates
            </Link>
            .
          </p>
        </header>

        {status !== "error" && <NewShortlistForm jobs={jobs} onCreated={(l) => router.push(`/dashboard/shortlists/${l.id}`)} />}

        {status === "loading" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-busy="true" aria-label="Loading shortlists">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-card p-5" style={CARD}>
                <Block className="h-4 w-40 mb-2" />
                <Block className="h-3 w-28" />
              </div>
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl p-10 flex flex-col items-center text-center" style={CARD}>
            <p className="text-base font-semibold mb-1" style={{ color: INK }}>Unable to load shortlists</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 text-14 font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "var(--forest)", color: "white" }}
            >
              Try again
            </button>
          </div>
        )}

        {status === "ready" && lists.length === 0 && (
          <div className="rounded-2xl py-12 px-6 text-center" style={CARD}>
            <p className="text-sm font-semibold mb-1" style={{ color: INK }}>No shortlists yet</p>
            <p className="text-14" style={{ color: INK_MUTED }}>Name one above, or use &quot;Add to client shortlist&quot; on a candidate.</p>
          </div>
        )}

        {status === "ready" && lists.length > 0 && (
          <>
            {lists.length > 6 && (
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search shortlists, jobs or clients…"
                aria-label="Search shortlists"
                className="text-14 px-4 py-2 rounded-full bg-white w-full sm:w-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              />
            )}
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/dashboard/shortlists/${l.id}`}
                    className="block rounded-card p-5 h-full transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={CARD}
                  >
                    <p className="text-sm font-semibold truncate" style={{ color: INK }}>{l.name}</p>
                    <p className="text-13 truncate mt-0.5" style={{ color: INK_MUTED }}>
                      {l.jobTitle ? `${l.jobTitle}${l.client ? ` · ${l.client}` : ""}` : "Not linked to a job"}
                    </p>
                    <div className="flex items-center justify-between mt-4 text-13" style={{ color: INK_FAINT }}>
                      <span>
                        <span className="font-semibold tabular-nums" style={{ color: INK }}>{l.count}</span> {l.count === 1 ? "person" : "people"}
                      </span>
                      <span>{formatDateOnly(l.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
