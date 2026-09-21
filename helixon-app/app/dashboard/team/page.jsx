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

// Agency-plan-only: invite teammates into the agency's Clerk Organization
// (see lib/clerk-org.js) and manage pending invites against the seat cap.
// Individual-plan accounts get a 403 from the API and simply don't see
// this section at all - see the isAgencyPlan state below.
function TeamInvitePanel() {
  const [usage, setUsage] = useState(null);
  const [visible, setVisible] = useState(null); // null = still checking, true/false once known
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(() => {
    getTeamSeatUsage().then(({ status, data }) => {
      if (status === 403) {
        setVisible(false);
        return;
      }
      if (status !== 200 || !data) {
        setVisible(false);
        return;
      }
      setUsage(data);
      setVisible(true);
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
    try {
      await inviteTeammate(trimmed);
      setEmail("");
      load();
    } catch (err) {
      setError(err.message || "Couldn't send the invite.");
    } finally {
      setSending(false);
    }
  }

  async function handleCancel(invitationId) {
    setCancellingId(invitationId);
    try {
      await cancelTeamInvite(invitationId);
      load();
    } catch (err) {
      setError(err.message || "Couldn't cancel the invite.");
    } finally {
      setCancellingId(null);
    }
  }

  if (visible !== true || !usage) return null;

  const full = usage.remaining <= 0;

  return (
    <div className="rounded-[14px] p-5" style={CARD}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: INK }}>Team seats</p>
          <p className="text-[12px]" style={{ color: INK_MUTED }}>
            {usage.used} of {usage.limit} used{usage.pendingCount > 0 ? ` · ${usage.pendingCount} pending` : ""}
          </p>
        </div>
      </div>

      <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2 mb-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@youragency.com"
          disabled={full || sending}
          aria-label="Teammate email address"
          className="flex-1 text-sm px-3.5 py-2.5 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{ border: "1px solid var(--border)", color: INK }}
        />
        <button
          type="submit"
          disabled={full || sending}
          className="inline-flex items-center justify-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {sending ? "Sending…" : full ? "Seats full" : "Send invite"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-[12px] mb-2" style={{ color: "var(--score-low)" }}>{error}</p>
      )}

      {usage.pendingInvites.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {usage.pendingInvites.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-3 text-[13px] py-1.5" style={{ color: INK_MUTED }}>
              <span className="truncate">{inv.email}</span>
              <button
                type="button"
                onClick={() => handleCancel(inv.id)}
                disabled={cancellingId === inv.id}
                className="text-[12px] font-semibold shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
                style={{ color: INK_FAINT }}
              >
                {cancellingId === inv.id ? "Cancelling…" : "Cancel"}
              </button>
            </li>
          ))}
        </ul>
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
    setStatus("loading");
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

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

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

