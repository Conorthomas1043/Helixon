"use client";

// Part of the team page (app/dashboard/team/page.jsx).

import Link from "next/link";
import PresenceDot from "@/components/PresenceDot";
import { CARD, INK, INK_FAINT, INK_MUTED, RED_BG, RED_STRONG, initials } from "@/lib/candidates/format";
import { presenceLine, timeAgo } from "@/lib/agency/presence";

// Presence colours and wording come from lib/agency/presence.js via PresenceDot.
export const PRESENCE_TEXT = {
  active: "var(--score-strong)",
  hidden: INK_FAINT,
  idle: "var(--ui-warn)",
  busy: "var(--score-low)",
  away: INK_MUTED,
  offline: INK_FAINT,
};

export function Avatar({ name, state, size = 46 }) {
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span
        className="w-full h-full rounded-full flex items-center justify-center font-semibold"
        style={{
          background: state && state !== "offline" ? "var(--mint)" : "var(--mist)",
          // Offline reads as grey initials, not faded green (3.5:1).
          color: state === "offline" || state === "hidden" ? "var(--ink-soft)" : "var(--forest)",
          fontSize: Math.round(size * 0.3),
        }}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
      {state && <PresenceDot state={state} size={Math.round(size * 0.27)} className="absolute bottom-0 right-0" />}
    </span>
  );
}

export function Metric({ label, value, accent }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: accent ?? INK }}>
        {value}
      </p>
      <p className="text-12 uppercase tracking-wide text-[var(--ink-faint)]">
        {label}
      </p>
    </div>
  );
}

export function SummaryTile({ label, value, sub, dot, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="text-left rounded-card p-4 bg-white border transition-colors hover:border-[var(--ink-mute)]"
      style={{ borderColor: active ? "var(--forest)" : "var(--border)", boxShadow: active ? "0 0 0 1px var(--forest)" : "none" }}
    >
      <p className="flex items-center gap-1.5 text-12 font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
        {dot && <PresenceDot state={dot} size={8} />}
        {label}
      </p>
      <p className="text-24 font-semibold tabular-nums leading-none mt-2.5 font-mono text-[var(--ink)]">
        {value}
      </p>
      {sub && <p className="text-13 mt-1.5 truncate text-[var(--ink-faint)]">{sub}</p>}
    </button>
  );
}

export const ROLE_LABELS = { owner: "Owner", admin: "Admin", member: "Member" };

export function MemberCard({ member, isYou, presence, now, canRemove, canChangeRole, changingRole, onChangeRole, removing, onRemove }) {
  const state = presence?.state;
  const line = presence ? presenceLine(presence, now) : null;
  // No fade for offline members: the avatar and presence dot already say so,
  // and fading the whole card took its grey text below 4.5:1.
  return (
    <div className="rounded-card p-5 flex flex-col" style={CARD}>
      <div className="flex items-start gap-3">
        <Avatar name={member.name} state={state} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-15 font-semibold truncate text-[var(--ink)]">
              {member.name}
              {isYou && <span className="font-normal text-[var(--ink-faint)]"> (you)</span>}
            </p>
            <span className="text-12 font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--mist)] text-[var(--ink-soft)]">
              {ROLE_LABELS[member.role] || "Member"}
            </span>
          </div>
          {presence && (
            <p className="flex items-center gap-1.5 text-14 font-semibold mt-1" style={{ color: PRESENCE_TEXT[state] || INK_FAINT }}>
              {state !== "offline" && state !== "hidden" && <PresenceDot state={state} size={7} ring="transparent" />}
              {line}
            </p>
          )}
          {presence?.message && (
            <p className="text-14 mt-1 italic text-[var(--ink)]">
              “{presence.message}”
            </p>
          )}
        </div>
        {member.overdue > 0 && (
          <span className="text-12 font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: RED_BG, color: RED_STRONG }}>
            {member.overdue} overdue
          </span>
        )}
      </div>

      <p className="text-13 mt-3 text-[var(--ink-faint)]">
        {member.lastWorkedAt ? `Last worked on a candidate ${timeAgo(member.lastWorkedAt, now)}` : "No candidate activity yet"}
        {member.screenedToday > 0 ? ` · ${member.screenedToday} screened today` : ""}
      </p>

      <div className="grid grid-cols-4 gap-2 pt-4 mt-3 border-t border-t-[var(--border)]">
        <Metric label="Active" value={member.activeCandidates} />
        <Metric label="To review" value={member.awaitingReview} />
        <Metric label="Interview" value={member.interviewing} />
        <Metric label="Placed" value={member.placed} accent="var(--forest)" />
      </div>

      <div className="flex items-center justify-between mt-4 pt-1">
        <Link
          href={`/dashboard/candidates?recruiterId=${encodeURIComponent(member.id)}`}
          className="inline-flex items-center text-13 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
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
              className="text-13 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50 text-[var(--ink-soft)]"
            >
              {changingRole ? "Saving…" : member.role === "admin" ? "Make member" : "Make admin"}
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(member)}
              disabled={removing}
              className="text-13 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded disabled:opacity-50 text-[var(--ink-faint)]"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
