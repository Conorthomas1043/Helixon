"use client";

// Part of the team page (app/dashboard/team/page.jsx).

import Link from "next/link";
import { CARD, INK, INK_FAINT, INK_MUTED, RED_STRONG } from "@/lib/candidates/format";
import { assignUnassignedCandidates, cancelTeamInvite, inviteTeammate } from "@/lib/dashboard-api";
import { trapTab } from "@/lib/focus-trap";
import { useEffect, useRef, useState } from "react";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Invite teammates into the agency's Clerk Organization (see
// lib/clerk-org.js) and manage pending invites against the seat cap.
// Every state is shown - it used to render nothing at all unless the seat
// lookup succeeded, so an Individual-plan account or any server error just
// left the page with no way to add anyone and no hint why.
export function TeamInvitePanel({ usage, state, loadError, reload, onRemoveSeat, removingId, members, onAssigned }) {
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
          <p className="text-[14px] mt-0.5" style={{ color: INK_MUTED }}>
            Team seats are part of the Agency plan - up to 5 people sharing one workspace, jobs and pipeline.
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center justify-center text-[14px] font-semibold px-4 py-2.5 rounded-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
          <p className="text-[14px] mt-0.5" style={{ color: INK_MUTED }}>{loadError}</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center justify-center text-[14px] font-semibold px-4 py-2.5 rounded-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
          <p className="text-[13.5px] mt-0.5" style={{ color: INK_MUTED }}>
            {canManage
              ? "They'll get an email with a link to join your workspace."
              : "Only the workspace owner can invite or remove people."}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[13px] font-semibold tabular-nums" style={{ color: INK }}>
            {usage.used} of {usage.limit} seats
          </p>
          <div className="w-24 h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "var(--mist)" }} aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: full ? "var(--score-mid)" : "var(--forest)" }} />
          </div>
        </div>
      </div>

      {canManage && (
      <form onSubmit={handleInvite} className="flex flex-col sm:flex-row lg:flex-col gap-2">
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
          className="inline-flex items-center justify-center text-[14px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {sending ? "Sending…" : "Send invite"}
        </button>
      </form>
      )}

      {canManage && full && (
        <p className="text-[13px] mt-2" style={{ color: INK_MUTED }}>
          All {usage.limit} seats are in use or pending. Cancel a pending invite or remove someone to free a seat.
        </p>
      )}
      {error && <p role="alert" className="text-[13px] mt-2" style={{ color: "var(--score-low)" }}>{error}</p>}
      {notice && <p role="status" className="text-[13px] mt-2" style={{ color: "var(--forest)" }}>{notice}</p>}

      {usage.pendingInvites.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: INK_FAINT }}>
            Waiting to accept
          </p>
          <ul className="space-y-1">
            {usage.pendingInvites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 text-[14px] py-1.5">
                <span className="min-w-0">
                  <span className="block truncate" style={{ color: INK }}>{inv.email}</span>
                  {inv.createdAt && (
                    <span className="block text-[12.5px]" style={{ color: INK_FAINT }}>
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
                    className="text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
                    style={{ color: "var(--forest)" }}
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancel(inv)}
                    disabled={busyId === inv.id}
                    className="text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
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
          <p className="text-[12px] font-semibold uppercase tracking-wide mb-1" style={{ color: INK_FAINT }}>
            Holding a seat elsewhere
          </p>
          <p className="text-[13px] mb-2" style={{ color: INK_MUTED }}>
            These people accepted an invite but already have their own Helixon workspace, so they aren&apos;t in yours. They still use a seat.
          </p>
          <ul className="space-y-1">
            {outside.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-3 text-[14px] py-1.5">
                <span className="min-w-0 block truncate" style={{ color: INK }}>{m.name || m.email || "Unknown user"}</span>
                <button
                  type="button"
                  onClick={() => onRemoveSeat({ id: m.userId, name: m.name || m.email || "this person" })}
                  disabled={removingId === m.userId}
                  className="text-[13px] font-semibold shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
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
export function UnassignedCandidates({ count, members, onAssigned }) {
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
      <p className="text-[12px] font-semibold uppercase tracking-wide mb-1" style={{ color: INK_FAINT }}>
        Unassigned candidates
      </p>
      <p className="text-[13px] mb-2" style={{ color: INK_MUTED }}>
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
          className="inline-flex items-center justify-center text-[14px] font-semibold px-4 py-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {busy ? "Assigning…" : `Assign ${count === 1 ? "it" : `all ${count}`}`}
        </button>
      </div>
      {error && <p role="alert" className="text-[13px] mt-2" style={{ color: "var(--score-low)" }}>{error}</p>}
    </div>
  );
}

// Replaces a bare confirm(): removing someone who owns candidates now asks
// who takes them over, instead of leaving them attached to a person who's
// gone (their card vanished and the candidates dropped out of the team view).
export function RemoveDialog({ target, members, viewerId, busy, onCancel, onConfirm }) {
  const others = members.filter((m) => m.id !== target.id);
  const owns = target.totalCandidates || 0;
  const [to, setTo] = useState(() => (others.some((m) => m.id === viewerId) ? viewerId : others[0]?.id || ""));
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
      if (e.key === "Tab") trapTab(e, dialogRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,32,27,0.45)" }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="remove-title" className="w-full max-w-md rounded-[16px] p-6 bg-white shadow-xl">
        <h2 id="remove-title" className="text-base font-semibold mb-1" style={{ color: INK }}>
          Remove {target.name}?
        </h2>
        <p className="text-[14px] mb-4" style={{ color: INK_MUTED }}>
          They&apos;ll lose access to this workspace immediately, and their seat is freed.
        </p>

        {owns > 0 && (
          <label className="block mb-5">
            <span className="block text-[13.5px] font-semibold mb-1.5" style={{ color: INK }}>
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
            className="text-[14px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(owns > 0 ? to || null : undefined)}
            disabled={busy}
            className="text-[14px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ background: RED_STRONG, color: "white" }}
          >
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
