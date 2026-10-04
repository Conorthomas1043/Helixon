"use client";

// /dashboard/team - the agency's members (profiles sharing its agency_id)
// with their workload, plus Agency-plan seat management backed by a Clerk
// Organization (lib/clerk-org.js). Only the workspace owner ("org:admin")
// can invite, cancel invites or remove people - the API enforces that, and
// this page hides those controls from everyone else. "Overdue" mirrors the
// candidate profile page: nextAction.dueAt in the past and not completed.
//
// Presence (lib/presence.js): who's active, idle, busy, away or offline -
// and when anyone offline was last active - from each person's heartbeat
// (DashboardNav) and the status they set here.

import { useConfirm } from "@/components/dashboard/use-confirm";
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
  setTeammateRole,
  assignUnassignedCandidates,
  setMyPresence,
  setPresenceHidden,
} from "@/lib/dashboard-api";
import PresenceDot from "@/components/PresenceDot";
import { PRESENCE_ORDER, computePresence, presenceLine, timeAgo } from "@/lib/presence";
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

// Presence colours and wording come from lib/presence.js via PresenceDot.
const PRESENCE_TEXT = {
  active: "var(--score-strong)",
  hidden: INK_FAINT,
  idle: "#9a6b12",
  busy: "var(--score-low)",
  away: INK_MUTED,
  offline: INK_FAINT,
};

function Avatar({ name, state, size = 46 }) {
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span
        className="w-full h-full rounded-full flex items-center justify-center font-semibold"
        style={{
          background: state && state !== "offline" ? "var(--mint)" : "var(--mist)",
          color: "var(--forest)",
          fontSize: Math.round(size * 0.3),
          opacity: state === "offline" || state === "hidden" ? 0.75 : 1,
        }}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
      {state && <PresenceDot state={state} size={Math.round(size * 0.27)} className="absolute bottom-0 right-0" />}
    </span>
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

function SummaryTile({ label, value, sub, dot, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="text-left rounded-[14px] p-4 bg-white border transition-colors hover:border-[var(--ink-mute)]"
      style={{ borderColor: active ? "var(--forest)" : "var(--border)", boxShadow: active ? "0 0 0 1px var(--forest)" : "none" }}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: INK_FAINT }}>
        {dot && <PresenceDot state={dot} size={8} />}
        {label}
      </p>
      <p className="text-[24px] font-semibold tabular-nums leading-none mt-2.5" style={{ fontFamily: "var(--font-mono)", color: INK }}>
        {value}
      </p>
      {sub && <p className="text-[11.5px] mt-1.5 truncate" style={{ color: INK_FAINT }}>{sub}</p>}
    </button>
  );
}

const ROLE_LABELS = { owner: "Owner", admin: "Admin", member: "Member" };

function MemberCard({ member, isYou, presence, now, canRemove, canChangeRole, changingRole, onChangeRole, removing, onRemove }) {
  const state = presence?.state;
  const line = presence ? presenceLine(presence, now) : null;
  return (
    <div className="rounded-[14px] p-5 flex flex-col" style={{ ...CARD, opacity: state === "offline" || state === "hidden" ? 0.92 : 1 }}>
      <div className="flex items-start gap-3">
        <Avatar name={member.name} state={state} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[15px] font-semibold truncate" style={{ color: INK }}>
              {member.name}
              {isYou && <span className="font-normal" style={{ color: INK_FAINT }}> (you)</span>}
            </p>
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_MUTED }}>
              {ROLE_LABELS[member.role] || "Member"}
            </span>
          </div>
          {presence && (
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold mt-1" style={{ color: PRESENCE_TEXT[state] || INK_FAINT }}>
              {state !== "offline" && state !== "hidden" && <PresenceDot state={state} size={7} ring="transparent" />}
              {line}
            </p>
          )}
          {presence?.message && (
            <p className="text-[12.5px] mt-1 italic" style={{ color: INK }}>
              “{presence.message}”
            </p>
          )}
        </div>
        {member.overdue > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: RED_BG, color: RED_STRONG }}>
            {member.overdue} overdue
          </span>
        )}
      </div>

      <p className="text-[11.5px] mt-3" style={{ color: INK_FAINT }}>
        {member.lastWorkedAt ? `Last worked on a candidate ${timeAgo(member.lastWorkedAt, now)}` : "No candidate activity yet"}
        {member.screenedToday > 0 ? ` · ${member.screenedToday} screened today` : ""}
      </p>

      <div className="grid grid-cols-4 gap-2 pt-4 mt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <Metric label="Active" value={member.activeCandidates} />
        <Metric label="To review" value={member.awaitingReview} />
        <Metric label="Interview" value={member.interviewing} />
        <Metric label="Placed" value={member.placed} accent="var(--forest)" />
      </div>

      <div className="flex items-center justify-between mt-4 pt-1">
        <Link
          href={`/dashboard/candidates?recruiterId=${encodeURIComponent(member.id)}`}
          className="inline-flex items-center text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
          style={{ color: "var(--forest)" }}
        >
          {isYou ? "Your candidates →" : `${member.name.split(" ")[0]}'s candidates →`}
        </Link>
        {/* Understated on purpose - rare, deliberate actions. */}
        <span className="flex items-center gap-3 shrink-0">
          {canChangeRole && (
            <button
              type="button"
              onClick={() => onChangeRole(member, member.role === "admin" ? "member" : "admin")}
              disabled={changingRole}
              title={member.role === "admin" ? "They'll no longer be able to invite, remove or reassign people" : "Admins can invite, remove and reassign people, like the owner"}
              className="text-[12px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
              style={{ color: INK_MUTED }}
            >
              {changingRole ? "Saving…" : member.role === "admin" ? "Make member" : "Make admin"}
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(member)}
              disabled={removing}
              className="text-[12px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50"
              style={{ color: INK_FAINT }}
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

const STATUS_CHOICES = [
  { value: null, dot: "active", label: "Automatic", hint: "Active or idle, from what you're doing" },
  { value: "busy", dot: "busy", label: "Busy", hint: "Heads down" },
  { value: "away", dot: "away", label: "Away", hint: "Stepped out" },
];
const MESSAGE_SUGGESTIONS = ["In interviews", "On a call", "Client meeting", "Lunch", "Out of office"];
const CLEAR_AFTER = [
  { value: "", label: "Don't clear" },
  { value: "30", label: "In 30 minutes" },
  { value: "60", label: "In 1 hour" },
  { value: "120", label: "In 2 hours" },
  { value: "240", label: "In 4 hours" },
  { value: "eod", label: "End of today" },
];

function clearAfterToIso(value) {
  if (!value) return null;
  if (value === "eod") {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }
  return new Date(Date.now() + Number(value) * 60_000).toISOString();
}

// Set yourself busy or away, with what you're doing and when it clears.
function MyStatusCard({ me, presence, enabled, onSaved }) {
  if (!enabled) {
    return (
      <div id="my-status" className="rounded-[14px] p-5 scroll-mt-24" style={CARD}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
          Presence
        </p>
        <p className="text-[13px]" style={{ color: INK_MUTED }}>
          Showing who&apos;s online is switched off for this workspace, so nothing about when people use Helixon is recorded.{" "}
          <Link href="/dashboard/privacy" className="font-semibold underline" style={{ color: "var(--forest)" }}>
            Data &amp; privacy settings
          </Link>
        </p>
      </div>
    );
  }
  return <MyStatusEditor me={me} presence={presence} onSaved={onSaved} />;
}

function MyStatusEditor({ me, presence, onSaved }) {
  const raw = me?.presenceRaw || {};
  const currentStatus = presence?.state === "busy" || presence?.state === "away" ? presence.state : null;
  const [status, setStatus] = useState(currentStatus);
  const [message, setMessage] = useState(currentStatus ? raw.message || "" : "");
  const [clearAfter, setClearAfter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const hidden = Boolean(me?.presenceRaw?.hidden);
  async function toggleHidden(next) {
    setSaving(true);
    setError("");
    try {
      onSaved(await setPresenceHidden(next));
    } catch (err) {
      setError(err.message || "Couldn't change that.");
    } finally {
      setSaving(false);
    }
  }

  async function save(next = status) {
    setSaving(true);
    setError("");
    try {
      const updated = await setMyPresence({ status: next, message: next ? message : "", until: next ? clearAfterToIso(clearAfter) : null });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (!next) {
        setMessage("");
        setClearAfter("");
      }
    } catch (err) {
      setError(err.message || "Couldn't update your status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="my-status" className="rounded-[14px] p-5 scroll-mt-24" style={CARD}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
        Your status
      </p>
      <p className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: INK }}>
        <PresenceDot state={presence?.state === "offline" ? "active" : presence?.state || "active"} size={9} ring="transparent" />
        {presence ? (presence.state === "offline" ? "Active now" : presenceLine(presence)) : "Active now"}
      </p>
      {presence?.message && <p className="text-[12.5px] italic mt-0.5" style={{ color: INK_MUTED }}>“{presence.message}”</p>}

      <div className="grid grid-cols-3 gap-1.5 mt-4" role="radiogroup" aria-label="Status">
        {STATUS_CHOICES.map((c) => {
          const on = status === c.value;
          return (
            <button
              key={c.label}
              type="button"
              role="radio"
              aria-checked={on}
              title={c.hint}
              onClick={() => {
                setStatus(c.value);
                if (!c.value) save(null);
              }}
              className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold px-2 py-2 rounded-[10px] border transition-colors"
              style={{
                borderColor: on ? "var(--forest)" : "var(--border)",
                background: on ? "var(--mint)" : "white",
                color: on ? "var(--forest-deep)" : INK_MUTED,
              }}
            >
              <PresenceDot state={c.dot} size={8} ring="transparent" />
              {c.label}
            </button>
          );
        })}
      </div>

      {status && (
        <div className="mt-3 space-y-2.5">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={80}
            placeholder={status === "busy" ? "What are you busy with? (optional)" : "Where are you? (optional)"}
            aria-label="Status message"
            className="w-full text-[13px] px-3.5 py-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          />
          <div className="flex flex-wrap gap-1.5">
            {MESSAGE_SUGGESTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMessage(m)}
                className="text-[11.5px] px-2.5 py-1 rounded-full hover:bg-[var(--mint)]"
                style={{ background: message === m ? "var(--mint)" : "var(--mist)", color: INK_MUTED }}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={clearAfter}
              onChange={(e) => setClearAfter(e.target.value)}
              aria-label="Clear status"
              className="flex-1 text-[12.5px] font-semibold px-3 py-2 rounded-full bg-white"
              style={{ border: "1px solid var(--border)", color: INK }}
            >
              {CLEAR_AFTER.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value ? `Clear ${o.label.toLowerCase()}` : o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="text-[12.5px] font-semibold px-4 py-2 rounded-full disabled:opacity-50"
              style={{ background: "var(--forest)", color: "white" }}
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Set status"}
            </button>
          </div>
        </div>
      )}
      {!status && saved && <p className="text-[12px] mt-2" style={{ color: "var(--forest)" }}>Back to automatic ✓</p>}
      {error && <p role="alert" className="text-[12px] mt-2" style={{ color: "var(--score-low)" }}>{error}</p>}
      <p className="text-[11.5px] mt-3" style={{ color: INK_FAINT }}>
        Teammates see you as active while you&apos;re using Helixon, idle after 5 minutes without touching it, and offline once it&apos;s closed.
        Only those times are kept - not what you click or type.
      </p>
      <label className="flex items-start gap-2 mt-3 pt-3 cursor-pointer" style={{ borderTop: "1px solid var(--border)" }}>
        <input
          type="checkbox"
          checked={!hidden}
          disabled={saving}
          onChange={(e) => toggleHidden(!e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[var(--forest)]"
        />
        <span className="text-[12.5px]" style={{ color: INK }}>
          Share my presence with the team
          <span className="block text-[11.5px]" style={{ color: INK_FAINT }}>
            {hidden ? "Hidden - nothing about when you use Helixon is being recorded." : "Untick to hide it and delete what's been recorded."}
          </span>
        </span>
      </label>
    </div>
  );
}

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function TeamSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true" aria-label="Loading team">
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
  const [ask, confirmDialog] = useConfirm();

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

  // Presence stays live: re-read the team every 30 seconds (quietly - no
  // skeleton), and re-work "3 min ago" / idle from the raw times every 15.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchRecruiters()
        .then(setRecruiters)
        .catch(() => {});
    }, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);
  const [filter, setFilter] = useState("all"); // all | online | busy | offline

  const retry = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  const [removeTarget, setRemoveTarget] = useState(null);

  const [changingRoleId, setChangingRoleId] = useState(null);
  async function handleChangeRole(member, role) {
    if (role === "admin" && !(await ask({ title: `Make ${member.name} an admin?`, body: "They'll be able to invite, remove and reassign people.", confirmLabel: "Make admin" }))) return;
    setChangingRoleId(member.id);
    setRemoveError("");
    try {
      await setTeammateRole(member.id, role);
      retry();
      loadUsage();
    } catch (err) {
      setRemoveError(err.message || "Couldn't change their role.");
    } finally {
      setChangingRoleId(null);
    }
  }

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

  // The agency can switch presence off (/dashboard/privacy) - then the API
  // sends none and the page shows workload only.
  const presenceOn = (recruiters || []).some((r) => r.presenceRaw);
  const OFF = { state: "offline", online: false, lastActiveAt: null, message: null, until: null };
  const members = (recruiters || []).map((r) => ({ ...r, livePresence: r.presenceRaw ? computePresence(r.presenceRaw, now) : OFF }));
  // You're here, whatever the last heartbeat said (unless you've hidden it).
  const withYou = members.map((m) =>
    presenceOn && m.id === user?.id && m.livePresence.state === "offline" ? { ...m, livePresence: { ...m.livePresence, state: "active", online: true } } : m
  );
  const sorted = [...withYou].sort(
    (a, b) =>
      PRESENCE_ORDER.indexOf(a.livePresence.state) - PRESENCE_ORDER.indexOf(b.livePresence.state) ||
      (b.livePresence.lastActiveAt || "").localeCompare(a.livePresence.lastActiveAt || "")
  );
  const groups = {
    online: sorted.filter((m) => m.livePresence.state === "active" || m.livePresence.state === "idle"),
    busy: sorted.filter((m) => m.livePresence.state === "busy" || m.livePresence.state === "away"),
    offline: sorted.filter((m) => m.livePresence.state === "offline" || m.livePresence.state === "hidden"),
  };
  const shown = filter === "all" ? sorted : groups[filter];
  const me = withYou.find((m) => m.id === user?.id) || null;
  const totalOverdue = members.reduce((sum, r) => sum + r.overdue, 0);
  const totalActive = members.reduce((sum, r) => sum + r.activeCandidates, 0);
  const screenedToday = members.reduce((sum, r) => sum + (r.screenedToday || 0), 0);
  const lastOnline = groups.offline.find((m) => m.livePresence.lastActiveAt);

  function onMyStatusSaved(updated) {
    setRecruiters((list) => list?.map((r) => (r.id === user?.id ? { ...r, presenceRaw: updated, presence: updated.presence } : r)));
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      {confirmDialog}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Team workspace
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Team
            </h1>
            {status === "ready" && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] mt-1" style={{ color: INK_MUTED }}>
                {presenceOn && (
                <span className="inline-flex items-center gap-1.5">
                  <PresenceDot state="active" size={8} ring="transparent" />
                  {groups.online.length} online
                </span>
                )}
                {presenceOn && groups.busy.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <PresenceDot state="busy" size={8} ring="transparent" />
                    {groups.busy.length} busy or away
                  </span>
                )}
                <span>
                  {totalActive} active candidates{totalOverdue > 0 ? ` · ${totalOverdue} overdue follow-up${totalOverdue === 1 ? "" : "s"}` : ""}
                </span>
              </p>
            )}
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 self-start"
            style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
          >
            ← Dashboard
          </Link>
        </header>

        {status === "ready" && members.length > 0 && presenceOn && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <SummaryTile label="Online now" dot="active" value={groups.online.length} sub={groups.online.length ? groups.online.map((m) => m.name.split(" ")[0]).join(", ") : "Nobody right now"} active={filter === "online"} onClick={() => setFilter((f) => (f === "online" ? "all" : "online"))} />
            <SummaryTile label="Busy or away" dot="busy" value={groups.busy.length} sub={groups.busy[0]?.livePresence.message || (groups.busy.length ? "Heads down" : "No one")} active={filter === "busy"} onClick={() => setFilter((f) => (f === "busy" ? "all" : "busy"))} />
            <SummaryTile label="Offline" dot="offline" value={groups.offline.length} sub={lastOnline ? `${lastOnline.name.split(" ")[0]} was on ${timeAgo(lastOnline.livePresence.lastActiveAt, now)}` : "Everyone's here"} active={filter === "offline"} onClick={() => setFilter((f) => (f === "offline" ? "all" : "offline"))} />
            <SummaryTile label="Screened today" value={screenedToday} sub={totalOverdue ? `${totalOverdue} follow-up${totalOverdue === 1 ? "" : "s"} overdue` : "No overdue follow-ups"} active={false} onClick={() => setFilter("all")} />
          </div>
        )}

        {removeError && (
          <p role="alert" className="text-[12px]" style={{ color: "var(--score-low)" }}>{removeError}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <section aria-label="Team members" className="space-y-4 min-w-0">
            {status === "ready" && members.length > 1 && presenceOn && (
              <div className="flex flex-wrap items-center gap-2">
                {[
                  ["all", "Everyone", sorted.length],
                  ["online", "Online", groups.online.length],
                  ["busy", "Busy or away", groups.busy.length],
                  ["offline", "Offline", groups.offline.length],
                ].map(([k, label, count]) => {
                  const on = filter === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFilter(k)}
                      aria-pressed={on}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ background: on ? "var(--forest)" : "white", color: on ? "white" : INK_MUTED, border: `1px solid ${on ? "var(--forest)" : "var(--border)"}` }}
                    >
                      {label}
                      <span className="text-[10px] tabular-nums px-1.5 rounded-full" style={{ background: on ? "rgba(255,255,255,0.25)" : "var(--mist)" }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
                <span className="ml-auto text-[11.5px]" style={{ color: INK_FAINT }}>
                  Updates live
                </span>
              </div>
            )}

            {status === "loading" && <TeamSkeleton />}
            {status === "error" && <ErrorState onRetry={retry} />}
            {status === "ready" && shown.length === 0 && (
              <div className="rounded-[14px] p-8 text-center text-[13px]" style={{ ...CARD, color: INK_MUTED }}>
                No one is {filter === "online" ? "online" : filter === "busy" ? "busy or away" : "offline"} right now.
              </div>
            )}
            {status === "ready" && shown.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shown.map((r) => (
                  <MemberCard
                    key={r.id}
                    member={r}
                    isYou={r.id === user?.id}
                    presence={presenceOn ? r.livePresence : null}
                    now={now}
                    canRemove={canManage && r.id !== user?.id && r.role === "member"}
                    canChangeRole={canManage && r.id !== user?.id && (r.role === "member" || r.role === "admin")}
                    changingRole={changingRoleId === r.id}
                    onChangeRole={handleChangeRole}
                    removing={removingId === r.id}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-[76px]">
            {status === "ready" && me && (
              <MyStatusCard key={`${me.presenceRaw?.status || "auto"}-${me.presenceRaw?.hidden ? "h" : "s"}`} me={me} presence={me.livePresence} enabled={presenceOn} onSaved={onMyStatusSaved} />
            )}
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
          </aside>
        </div>
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

