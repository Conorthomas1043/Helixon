"use client";

// /dashboard/shortlists/[id] - one shortlist: who's on it (strongest match
// first), a note on why each person is there, and the ways to send it on -
// the printable client pack, a pre-filled email to the job's client contact,
// and side-by-side compare.

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import {
  getShortlist,
  updateShortlist,
  deleteShortlist,
  setShortlistNote,
  removeFromShortlist,
  getJobs,
} from "@/lib/dashboard-api";
import { STAGE_LABELS, STAGE_COLORS } from "@/lib/stage-labels";
import ShareShortlist from "@/components/dashboard/ShareShortlist";
import { CLIENT_DECISIONS } from "@/lib/client-decisions";
import { INK, INK_MUTED, INK_FAINT, CARD, scoreColor } from "@/lib/candidate-format";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { reportQuietly } from "@/lib/report-error";
import { Avatar as KitAvatar } from "@/components/ui";

function Avatar({ name }) {
  return <KitAvatar name={name} tone="solid" />;
}

function NoteEditor({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value || ""); setEditing(true); }}
        className="text-left text-[13px] mt-1 rounded focus-visible:outline focus-visible:outline-2"
        style={{ color: value ? INK_MUTED : INK_FAINT }}
      >
        {value ? `“${value}”` : "+ Why are they on this list?"}
      </button>
    );
  }
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={1000}
        rows={2}
        autoFocus
        aria-label="Shortlist note"
        placeholder="e.g. Strongest on stakeholder management; available in 4 weeks"
        className="w-full text-[13px] px-2.5 py-1.5 rounded-[8px] focus-visible:outline focus-visible:outline-2"
        style={{ border: "1px solid var(--border)", color: INK }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-[12px] font-semibold px-3 py-1 rounded-full disabled:opacity-50"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => { setDraft(value || ""); setEditing(false); }} className="text-[12px] font-semibold" style={{ color: INK_MUTED }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// A plain-text summary for the client email - names, current role, score
// and the recruiter's note. The pack itself is attached as a PDF by hand.
function clientEmailHref(shortlist, candidates) {
  const lines = candidates.map((c, i) => {
    const role = [c.currentTitle, c.currentCompany].filter(Boolean).join(" at ");
    return `${i + 1}. ${c.fullName}${role ? ` - ${role}` : ""}${c.score != null ? ` (match ${c.score})` : ""}${c.note ? `\n   ${c.note}` : ""}`;
  });
  const subject = `Shortlist: ${shortlist.jobTitle || shortlist.name}`;
  const body = `Hi,\n\nHere is the shortlist for ${shortlist.jobTitle || "the role"}:\n\n${lines.join("\n")}\n\nFull profiles attached. Let me know who you'd like to meet.\n\n`;
  return `mailto:${encodeURIComponent(shortlist.clientEmail || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function ShortlistDetailPage({ params }) {
  const [ask, confirmDialog] = useConfirm();
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getShortlist(id)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
      })
      .catch((err) => {
        if (!cancelled) setStatus(err.message === "Not found" ? "not-found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  useEffect(() => {
    getJobs().then(setJobs).catch(reportQuietly);
  }, []);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  async function saveName(e) {
    e.preventDefault();
    if (!nameDraft.trim()) return;
    setError("");
    try {
      await updateShortlist(id, { name: nameDraft.trim() });
      setRenaming(false);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeJob(jobId) {
    setError("");
    try {
      await updateShortlist(id, { jobId: jobId || null });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(candidateId) {
    setError("");
    try {
      await removeFromShortlist(id, candidateId);
      setData((d) => ({ ...d, candidates: d.candidates.filter((c) => c.id !== candidateId) }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveNote(candidateId, note) {
    await setShortlistNote(id, candidateId, note);
    setData((d) => ({ ...d, candidates: d.candidates.map((c) => (c.id === candidateId ? { ...c, note: note || null } : c)) }));
  }

  async function handleDelete() {
    if (!(await ask({ title: `Delete the shortlist "${data.shortlist.name}"?`, body: "Share links stop working. The candidates themselves aren't affected.", confirmLabel: "Delete shortlist", danger: true }))) return;
    try {
      await deleteShortlist(id);
      router.push("/dashboard/shortlists");
    } catch (err) {
      setError(err.message);
    }
  }

  const shortlist = data?.shortlist;
  const candidates = data?.candidates ?? [];
  const pill = "inline-flex items-center text-[13px] font-semibold px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <>
      {confirmDialog}
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <Link href="/dashboard/shortlists" className="text-[13px] font-semibold" style={{ color: INK_MUTED }}>
          ← All shortlists
        </Link>

        {status === "loading" && <div className="rounded-[14px] h-40 animate-pulse motion-reduce:animate-none" style={CARD} aria-busy="true" />}
        {status === "not-found" && (
          <div className="rounded-[14px] p-10 text-center" style={CARD}>
            <p className="font-semibold" style={{ color: INK }}>Shortlist not found</p>
            <p className="text-[14px] mt-1" style={{ color: INK_MUTED }}>It may have been deleted.</p>
          </div>
        )}
        {status === "error" && (
          <div className="rounded-[14px] p-10 text-center" style={CARD}>
            <p className="font-semibold mb-3" style={{ color: INK }}>Unable to load this shortlist</p>
            <button type="button" onClick={reload} className={pill} style={{ background: "var(--forest)", color: "white" }}>Try again</button>
          </div>
        )}

        {status === "ready" && shortlist && (
          <>
            <header className="rounded-[14px] p-5 sm:p-6 space-y-4" style={CARD}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>Shortlist</p>
                  {renaming ? (
                    <form onSubmit={saveName} className="flex items-center gap-2">
                      <input
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        maxLength={120}
                        autoFocus
                        aria-label="Shortlist name"
                        className="text-lg font-semibold px-2 py-1 rounded-[8px]"
                        style={{ border: "1px solid var(--border)", color: INK }}
                      />
                      <button type="submit" className={pill} style={{ background: "var(--forest)", color: "white" }}>Save</button>
                      <button type="button" onClick={() => setRenaming(false)} className="text-[13px] font-semibold" style={{ color: INK_MUTED }}>Cancel</button>
                    </form>
                  ) : (
                    <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
                      {shortlist.name}{" "}
                      <button
                        type="button"
                        onClick={() => { setNameDraft(shortlist.name); setRenaming(true); }}
                        className="text-[13px] font-semibold align-middle"
                        style={{ color: INK_MUTED }}
                      >
                        Rename
                      </button>
                    </h1>
                  )}
                  <p className="text-[14px] mt-1" style={{ color: INK_MUTED }}>
                    {candidates.length} {candidates.length === 1 ? "person" : "people"}
                    {shortlist.jobId && (
                      <>
                        {" · for "}
                        <Link href={`/dashboard/jobs/${shortlist.jobId}`} className="underline">{shortlist.jobTitle}</Link>
                        {shortlist.client ? ` at ${shortlist.client}` : ""}
                      </>
                    )}
                  </p>
                </div>
                <button type="button" onClick={handleDelete} className="text-[13px] font-semibold" style={{ color: "var(--score-low)" }}>
                  Delete list
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Job this shortlist is for"
                  value={shortlist.jobId || ""}
                  onChange={(e) => changeJob(e.target.value)}
                  className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-white"
                  style={{ border: "1px solid var(--border)", color: INK }}
                >
                  <option value="">Not linked to a job</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}{j.company ? ` · ${j.company}` : ""}</option>
                  ))}
                </select>
                {candidates.length > 0 && (
                  <>
                    <button type="button" onClick={() => setSharing(true)} className={pill} style={{ background: "var(--forest)", color: "white" }}>
                      Share with client
                    </button>
                    <Link href={`/dashboard/shortlists/${id}/client-pack`} className={pill} style={{ border: "1px solid var(--border)", color: INK, background: "white" }}>
                      Client pack (PDF)
                    </Link>
                    <a href={clientEmailHref(shortlist, candidates)} className={pill} style={{ border: "1px solid var(--border)", color: INK, background: "white" }}>
                      Email {shortlist.clientEmail ? "client" : "summary"}
                    </a>
                  </>
                )}
                {candidates.length >= 2 && candidates.length <= 4 && (
                  <Link href={`/analyse/compare?ids=${candidates.map((c) => c.id).join(",")}`} className={pill} style={{ border: "1px solid var(--border)", color: INK, background: "white" }}>
                    Compare side by side
                  </Link>
                )}
              </div>
              {shortlist.jobId && !shortlist.clientEmail && candidates.length > 0 && (
                <p className="text-[13px]" style={{ color: INK_FAINT }}>
                  The job has no client contact email -{" "}
                  <Link href={`/dashboard/jobs/${shortlist.jobId}`} className="underline font-semibold" style={{ color: "var(--forest)" }}>add one</Link>{" "}
                  to address the email automatically.
                </p>
              )}
              {error && <p className="text-[13px]" style={{ color: "var(--score-low)" }}>{error}</p>}
            </header>

            <section className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              {candidates.length === 0 ? (
                <p className="text-[14px] text-center py-6" style={{ color: INK_MUTED }}>
                  Nobody on this list yet. Use &quot;Add to client shortlist&quot; on a candidate&apos;s profile, or select people on{" "}
                  <Link href={shortlist.jobId ? `/dashboard/candidates?jobId=${shortlist.jobId}` : "/dashboard/candidates"} className="underline font-semibold" style={{ color: "var(--forest)" }}>
                    Candidates
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {candidates.map((c) => (
                    <li key={c.id} className="py-3.5 flex items-start gap-3">
                      <Avatar name={c.fullName} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/dashboard/candidates/${c.id}`} className="text-sm font-semibold hover:underline" style={{ color: INK }}>
                          {c.fullName}
                        </Link>
                        <p className="text-[13px] truncate" style={{ color: INK_MUTED }}>
                          {[[c.currentTitle, c.currentCompany].filter(Boolean).join(" at "), c.location].filter(Boolean).join(" · ") || "-"}
                        </p>
                        {c.jobTitle && c.jobId !== shortlist.jobId && (
                          <p className="text-[12px]" style={{ color: INK_FAINT }}>Screened for {c.jobTitle}</p>
                        )}
                        <NoteEditor value={c.note} onSave={(note) => saveNote(c.id, note)} />
                        {c.clientDecision && (
                          <p className="text-[13px] mt-1.5 rounded-[8px] px-2.5 py-1.5" style={{ background: c.clientDecision === "reject" ? "#fef2f2" : c.clientDecision === "interview" ? "var(--mint)" : "#fdf6e9", color: INK }}>
                            <strong>{c.clientDecidedBy || "Client"}: {CLIENT_DECISIONS[c.clientDecision]}</strong>
                            {c.clientComment ? ` - "${c.clientComment}"` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: scoreColor(c.score) }}>
                          {c.score ?? "-"}
                        </span>
                        {c.stage && (
                          <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: STAGE_COLORS[c.stage] || INK_MUTED }}>
                            {STAGE_LABELS[c.stage] ?? c.stage}
                          </span>
                        )}
                        <div className="flex gap-2 text-[12px] font-semibold">
                          <Link href={`/dashboard/candidates/${c.id}/client-profile`} style={{ color: "var(--forest)" }}>Client profile</Link>
                          <button type="button" onClick={() => remove(c.id)} style={{ color: INK_MUTED }}>Remove</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
      {sharing && shortlist && <ShareShortlist shortlist={shortlist} onClose={() => setSharing(false)} />}
    </main>
    </>
  );
}
