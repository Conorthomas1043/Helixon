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

import DashboardNav from "@/components/DashboardNav";
import Link from "next/link";
import PresenceDot from "@/components/PresenceDot";
import { CARD, INK, INK_FAINT, INK_MUTED } from "@/lib/candidate-format";
import { PRESENCE_ORDER, computePresence, timeAgo } from "@/lib/presence";
import { getRecruiters as fetchRecruiters, getTeamSeatUsage, removeTeammate, setTeammateRole } from "@/lib/dashboard-api";
import { reportQuietly } from "@/lib/report-error";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { useUser } from "@clerk/nextjs";
import { RemoveDialog, TeamInvitePanel } from "./_components/invite";
import { MemberCard, SummaryTile } from "./_components/members";
import { ErrorState, TeamSkeleton } from "./_components/states";
import { MyStatusCard } from "./_components/status";

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
        .catch(reportQuietly);
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
            <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Team workspace
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Team
            </h1>
            {status === "ready" && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] mt-1" style={{ color: INK_MUTED }}>
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
            className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 self-start"
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
          <p role="alert" className="text-[13px]" style={{ color: "var(--score-low)" }}>{removeError}</p>
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
                      className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ background: on ? "var(--forest)" : "white", color: on ? "white" : INK_MUTED, border: `1px solid ${on ? "var(--forest)" : "var(--border)"}` }}
                    >
                      {label}
                      <span className="text-[12px] tabular-nums px-1.5 rounded-full" style={{ background: on ? "rgba(255,255,255,0.25)" : "var(--mist)" }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
                <span className="ml-auto text-[12.5px]" style={{ color: INK_FAINT }}>
                  Updates live
                </span>
              </div>
            )}

            {status === "loading" && <TeamSkeleton />}
            {status === "error" && <ErrorState onRetry={retry} />}
            {status === "ready" && shown.length === 0 && (
              <div className="rounded-[14px] p-8 text-center text-[14px]" style={{ ...CARD, color: INK_MUTED }}>
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
