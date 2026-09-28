"use client";

// /dashboard/team - the agency's members (profiles sharing its agency_id)
// with their workload, plus Agency-plan seat management backed by a Clerk
// Organization (lib/clerk-org.js). Only the workspace owner ("org:admin")
// can invite, cancel invites or remove people - the API enforces that, and
// this page hides those controls from everyone else. "Overdue" mirrors the
// candidate profile page: nextAction.dueAt in the past and not completed.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import DashboardNav from "@/components/DashboardNav";
import {
  getRecruiters as fetchRecruiters,
  getTeamSeatUsage,
  inviteTeammate,
  cancelTeamInvite,
  removeTeammate,
  assignUnassignedCandidates,
} from "@/lib/dashboard-api";
import { INK, INK_MUTED, INK_FAINT, RED_STRONG, RED_BG, CARD, initials } from "@/lib/candidate-format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Invite teammates into the agency's Clerk Organization (see
// lib/clerk-org.js) and manage pending invites against the seat cap.
// Every state is shown - it used to render nothing at all unless the seat
// lookup succeeded, so an Individual-plan account or any server error just
// left the page with no way to add anyone and no hint why.
function TeamInvitePanel({ usage, state, loadError, reload, onRemoveSeat, removingId, members, onAssigned }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const load = reload;

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
          onClick={load}
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
  const canManage = usage.canManage === true;
  const outside = usage.outsideMembers || [];

  return (
    <div className="rounded-[14px] p-5" style={CARD}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: INK }}>{canManage ? "Add a team member" : "Team seats"}</p>
          <p className="text-[12.5px] mt-0.5" style={{ color: INK_MUTED }}>
            {canManage
              ? "They'll get an email with a link to join your workspace."
              : "Only the workspace owner can invite or remove people."}
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

      {canManage && (
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
      )}

      {canManage && full && (
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
                {canManage && (
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
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManage && usage.unassignedCount > 0 && members?.length > 0 && (
        <UnassignedCandidates count={usage.unassignedCount} members={members} onAssigned={onAssigned} />
      )}

      {canManage && outside.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: INK_FAINT }}>
            Holding a seat elsewhere
          </p>
          <p className="text-[12px] mb-2" style={{ color: INK_MUTED }}>
            These people accepted an invite but already have their own Helixon workspace, so they aren&apos;t in yours. They still use a seat.
          </p>
          <ul className="space-y-1">
            {outside.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-3 text-[13px] py-1.5">
                <span className="min-w-0 block truncate" style={{ color: INK }}>{m.name || m.email || "Unknown user"}</span>
                <button
                  type="button"
                  onClick={() => onRemoveSeat({ id: m.userId, name: m.name || m.email || "this person" })}
                  disabled={removingId === m.userId}
                  className="text-[12px] font-semibold shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
                  style={{ color: INK_FAINT }}
                >
                  {removingId === m.userId ? "Removing…" : "Free seat"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Candidates nobody on the team owns - left behind by an earlier removal,
// or unassigned by hand. One step hands them all to someone.
function UnassignedCandidates({ count, members, onAssigned }) {
  const [to, setTo] = useState(() => members.find((m) => m.role === "owner")?.id || members[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function assign() {
    if (!to) return;
    setBusy(true);
    setError("");
    try {
      await assignUnassignedCandidates(to);
      onAssigned();
    } catch (err) {
      setError(err.message || "Couldn't assign those candidates.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: INK_FAINT }}>
        Unassigned candidates
      </p>
      <p className="text-[12px] mb-2" style={{ color: INK_MUTED }}>
        {count} candidate{count === 1 ? " isn't" : "s aren't"} assigned to anyone on the team, so {count === 1 ? "it doesn't" : "they don't"} show in anyone&apos;s workload.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Assign unassigned candidates to"
          className="flex-1 text-sm px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={assign}
          disabled={busy || !to}
          className="inline-flex items-center justify-center text-[13px] font-semibold px-4 py-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {busy ? "Assigning…" : `Assign ${count === 1 ? "it" : `all ${count}`}`}
        </button>
      </div>
      {error && <p role="alert" className="text-[12px] mt-2" style={{ color: "var(--score-low)" }}>{error}</p>}
    </div>
  );
}

// Replaces a bare confirm(): removing someone who owns candidates now asks
// who takes them over, instead of leaving them attached to a person who's
// gone (their card vanished and the candidates dropped out of the team view).
function RemoveDialog({ target, members, viewerId, busy, onCancel, onConfirm }) {
  const others = members.filter((m) => m.id !== target.id);
  const owns = target.totalCandidates || 0;
  const [to, setTo] = useState(() => (others.some((m) => m.id === viewerId) ? viewerId : others[0]?.id || ""));
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,32,27,0.45)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="remove-title" className="w-full max-w-md rounded-[16px] p-6 bg-white shadow-xl">
        <h2 id="remove-title" className="text-base font-semibold mb-1" style={{ color: INK }}>
          Remove {target.name}?
        </h2>
        <p className="text-[13px] mb-4" style={{ color: INK_MUTED }}>
          They&apos;ll lose access to this workspace immediately, and their seat is freed.
        </p>

        {owns > 0 && (
          <label className="block mb-5">
            <span className="block text-[12.5px] font-semibold mb-1.5" style={{ color: INK }}>
              Hand their {owns} candidate{owns === 1 ? "" : "s"} to
            </span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
            >
              {others.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.id === viewerId ? " (you)" : ""}</option>
              ))}
              <option value="">Nobody - leave them unassigned</option>
            </select>
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(owns > 0 ? to || null : undefined)}
            disabled={busy}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ background: RED_STRONG, color: "white" }}
          >
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
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
            {recruiter.role === "owner" ? "Owner" : "Member"}
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

  // Seat usage lives here, not inside the invite panel, so removing someone
  // refreshes the "x of 5 seats" counter too - it used to stay stale until
  // a full page reload.
  const [usage, setUsage] = useState(null);
  const [usageState, setUsageState] = useState("loading"); // loading | ready | upgrade | error
  const [usageError, setUsageError] = useState("");

  const loadUsage = useCallback(() => {
    getTeamSeatUsage()
      .then(({ status, data }) => {
        if (status === 403) {
          setUsageState("upgrade");
          return;
        }
        if (status !== 200 || !data) {
          setUsageError(data?.error || "Couldn't load your team seats.");
          setUsageState("error");
          return;
        }
        setUsage(data);
        setUsageState("ready");
      })
      .catch(() => {
        setUsageError("Couldn't reach the server. Check your connection.");
        setUsageState("error");
      });
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const canManage = usageState === "ready" && usage?.canManage === true;

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

  const [removeTarget, setRemoveTarget] = useState(null);

  function handleRemove(member) {
    setRemoveError("");
    setRemoveTarget(member);
  }

  const cancelRemove = useCallback(() => setRemoveTarget(null), []);

  async function confirmRemove(reassignTo) {
    const target = removeTarget;
    setRemovingId(target.id);
    try {
      const result = await removeTeammate(target.id, reassignTo);
      if (result?.reassignFailed) setRemoveError(result.error);
      setRemoveTarget(null);
      retry();
      loadUsage();
    } catch (err) {
      setRemoveError(err.message || "Couldn't remove that team member.");
      setRemoveTarget(null);
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

        <TeamInvitePanel
          usage={usage}
          state={usageState}
          loadError={usageError}
          reload={loadUsage}
          onRemoveSeat={handleRemove}
          removingId={removingId}
          members={recruiters || []}
          onAssigned={() => { retry(); loadUsage(); }}
        />

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
                canRemove={canManage && r.id !== user?.id && r.role !== "owner"}
                removing={removingId === r.id}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>

      {removeTarget && (
        <RemoveDialog
          target={removeTarget}
          members={recruiters || []}
          viewerId={user?.id}
          busy={removingId === removeTarget.id}
          onCancel={cancelRemove}
          onConfirm={confirmRemove}
        />
      )}
    </main>
  );
}

