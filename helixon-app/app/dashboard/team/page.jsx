"use client";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS
 * ------------------------------------------------------------------------
 * - Route: /dashboard/team. Not previously linked from DashboardNav - a
 *   "Team" tab was added there so this page is reachable; drop that tab if
 *   this project already has a different team/settings surface.
 * - "Recruiter" here means anyone in RECRUITERS in lib/mock-data.js,
 *   without a distinct permissions/role system - see that file's
 *   `role: "manager" | "recruiter"` field, which isn't used for access
 *   control anywhere yet (per the brief: don't build permissions gating
 *   that doesn't have a real auth model to hang off).
 * - "Overdue" mirrors the same rule used on the candidate profile page:
 *   nextAction.dueAt in the past and not completed.
 * ---------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import DashboardNav from "@/components/DashboardNav";
import { getRecruiters as fetchRecruiters, getTeamSeatUsage, inviteTeammate, cancelTeamInvite, removeTeammate } from "@/lib/dashboard-api";
import { INK, INK_MUTED, INK_FAINT, RED_STRONG, RED_BG, CARD, initials } from "@/lib/candidate-format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Invite teammates into the agency's Clerk Organization (see
// lib/clerk-org.js) and manage pending invites against the seat cap.
// Every state is shown - it used to render nothing at all unless the seat
// lookup succeeded, so an Individual-plan account or any server error just
// left the page with no way to add anyone and no hint why.
function TeamInvitePanel() {
  const [usage, setUsage] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | upgrade | error
  const [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    getTeamSeatUsage()
      .then(({ status, data }) => {
        if (status === 403) {
          setState("upgrade");
          return;
        }
        if (status !== 200 || !data) {
          setLoadError(data?.error || "Couldn't load your team seats.");
          setState("error");
          return;
        }
        setUsage(data);
        setState("ready");
      })
      .catch(() => {
        setLoadError("Couldn't reach the server. Check your connection.");
        setState("error");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(e) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setSending(true);
    setError("");
    setNotice("");
    try {
      await inviteTeammate(trimmed);
      setEmail("");
      setNotice(`Invite sent to ${trimmed}. They'll join as soon as they accept it.`);
      load();
    } catch (err) {
      setError(err.message || "Couldn't send the invite.");
    } finally {
      setSending(false);
    }
  }

  async function handleCancel(invite) {
    setBusyId(invite.id);
    setError("");
    setNotice("");
    try {
      await cancelTeamInvite(invite.id);
      load();
    } catch (err) {
      setError(err.message || "Couldn't cancel the invite.");
    } finally {
      setBusyId(null);
    }
  }

  // Re-sends by cancelling and inviting again - the new email carries a
  // fresh link (and, for invites sent before the link fix, one that
  // actually lands on Helixon's own sign-up page).
  async function handleResend(invite) {
    setBusyId(invite.id);
    setError("");
    setNotice("");
    try {
      await cancelTeamInvite(invite.id);
      await inviteTeammate(invite.email);
      setNotice(`New invite sent to ${invite.email}.`);
      load();
    } catch (err) {
      setError(err.message || "Couldn't resend the invite.");
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (state === "loading") {
    return <div className="rounded-[14px] p-5 h-[132px] animate-pulse motion-reduce:animate-none" style={CARD} aria-busy="true" aria-label="Loading team seats" />;
  }

  if (state === "upgrade") {
    return (
      <div className="rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={CARD}>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: INK }}>Add your team</p>
          <p className="text-[13px] mt-0.5" style={{ color: INK_MUTED }}>
            Team seats are part of the Agency plan - up to 5 people sharing one workspace, jobs and pipeline.
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center justify-center text-[13px] font-semibold px-4 py-2.5 rounded-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "var(--forest)", color: "white" }}
        >
          Upgrade to Agency
        </Link>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={CARD}>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: INK }}>Couldn&apos;t load team seats</p>
          <p className="text-[13px] mt-0.5" style={{ color: INK_MUTED }}>{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => { setState("loading"); load(); }}
          className="inline-flex items-center justify-center text-[13px] font-semibold px-4 py-2.5 rounded-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Try again
        </button>
      </div>
    );
  }

  const full = usage.remaining <= 0;
  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));

  return (
    <div className="rounded-[14px] p-5" style={CARD}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: INK }}>Add a team member</p>
          <p className="text-[12.5px] mt-0.5" style={{ color: INK_MUTED }}>
            They&apos;ll get an email with a link to join your workspace.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[12px] font-semibold tabular-nums" style={{ color: INK }}>
            {usage.used} of {usage.limit} seats
          </p>
          <div className="w-24 h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "var(--mist)" }} aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: full ? "var(--score-mid)" : "var(--forest)" }} />
          </div>
        </div>
      </div>

      <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="teammate@youragency.com"
          disabled={full || sending}
          aria-label="Teammate email address"
          className="flex-1 text-sm px-3.5 py-2.5 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{ border: "1px solid var(--border)", color: INK }}
        />
        <button
          type="submit"
          disabled={full || sending || !email.trim()}
          className="inline-flex items-center justify-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {sending ? "Sending…" : "Send invite"}
        </button>
      </form>

      {full && (
        <p className="text-[12px] mt-2" style={{ color: INK_MUTED }}>
          All {usage.limit} seats are in use or pending. Cancel a pending invite or remove someone to free a seat.
        </p>
      )}
      {error && <p role="alert" className="text-[12px] mt-2" style={{ color: "var(--score-low)" }}>{error}</p>}
      {notice && <p role="status" className="text-[12px] mt-2" style={{ color: "var(--forest)" }}>{notice}</p>}

      {usage.pendingInvites.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: INK_FAINT }}>
            Waiting to accept
          </p>
          <ul className="space-y-1">
            {usage.pendingInvites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 text-[13px] py-1.5">
                <span className="min-w-0">
                  <span className="block truncate" style={{ color: INK }}>{inv.email}</span>
                  {inv.createdAt && (
                    <span className="block text-[11.5px]" style={{ color: INK_FAINT }}>
                      Invited {new Date(inv.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleResend(inv)}
                    disabled={busyId === inv.id}
                    className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
                    style={{ color: "var(--forest)" }}
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancel(inv)}
                    disabled={busyId === inv.id}
                    className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
                    style={{ color: INK_FAINT }}
                  >
                    {busyId === inv.id ? "Working…" : "Cancel"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold"
      style={{ background: "var(--mist)", color: "var(--forest)" }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: accent ?? INK }}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: INK_FAINT }}>
        {label}
      </p>
    </div>
  );
}

function RecruiterCard({ recruiter, canRemove, removing, onRemove }) {
  return (
    <div className="rounded-[14px] p-5" style={CARD}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={recruiter.name} />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: INK }}>
            {recruiter.name}
          </p>
          <p className="text-[11px] uppercase tracking-wide" style={{ color: INK_FAINT }}>
            {recruiter.role === "manager" ? "Manager" : "Recruiter"}
          </p>
        </div>
        {recruiter.overdue > 0 && (
          <span
            className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: RED_BG, color: RED_STRONG }}
          >
            {recruiter.overdue} overdue
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <Metric label="Active" value={recruiter.activeCandidates} />
        <Metric label="To review" value={recruiter.awaitingReview} />
        <Metric label="Interview" value={recruiter.interviewing} />
        <Metric label="Placed" value={recruiter.placed} accent="var(--forest)" />
      </div>

      <div className="flex items-center justify-between mt-4">
        <Link
          href={`/dashboard/candidates?recruiterId=${recruiter.id}`}
          className="inline-flex items-center text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
          style={{ color: "var(--forest)" }}
        >
          View {recruiter.name.split(" ")[0]}&apos;s candidates →
        </Link>

        {/* Understated on purpose - removing someone from the team is a
            rare, deliberate action and shouldn't sit visually level with
            "View candidates". Not shown on your own card (see canRemove)
            or when you're the only person on the team. */}
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(recruiter)}
            disabled={removing}
            className="text-[12px] font-medium shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
            style={{ color: INK_FAINT }}
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
    </div>
  );
}

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function TeamSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true" aria-label="Loading team">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-[14px] p-5" style={CARD}>
          <Block className="h-11 w-11 rounded-full mb-4" />
          <Block className="h-14 w-full" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        Unable to load team
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        Something went wrong while loading recruiter workload.
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

export default function TeamPage() {
  const { user } = useUser();
  const [recruiters, setRecruiters] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchRecruiters()
      .then((r) => {
        if (cancelled) return;
        setRecruiters(r);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  async function handleRemove(recruiter) {
    if (!confirm(`Remove ${recruiter.name} from the team? They'll lose access to this workspace immediately, and this frees up their seat.`)) {
      return;
    }
    setRemoveError("");
    setRemovingId(recruiter.id);
    try {
      await removeTeammate(recruiter.id);
      retry();
    } catch (err) {
      setRemoveError(err.message || "Couldn't remove that team member.");
    } finally {
      setRemovingId(null);
    }
  }

  const totalOverdue = recruiters?.reduce((sum, r) => sum + r.overdue, 0) ?? 0;
  const totalActive = recruiters?.reduce((sum, r) => sum + r.activeCandidates, 0) ?? 0;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Team workspace
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Team
            </h1>
            {status === "ready" && (
              <p className="text-[13px] mt-1" style={{ color: INK_MUTED }}>
                {totalActive} active candidates across the team
                {totalOverdue > 0 ? ` · ${totalOverdue} overdue follow-up${totalOverdue === 1 ? "" : "s"}` : ""}
              </p>
            )}
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 self-start"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            ← Dashboard
          </Link>
        </header>

        <TeamInvitePanel />

        {removeError && (
          <p role="alert" className="text-[12px]" style={{ color: "var(--score-low)" }}>{removeError}</p>
        )}

        {status === "loading" && <TeamSkeleton />}
        {status === "error" && <ErrorState onRetry={retry} />}
        {status === "ready" && recruiters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recruiters.map((r) => (
              <RecruiterCard
                key={r.id}
                recruiter={r}
                canRemove={recruiters.length > 1 && r.id !== user?.id}
                removing={removingId === r.id}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

