"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SignOutButton, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import PresenceDot from "@/components/PresenceDot";
import { usePresenceHeartbeat } from "@/lib/hooks/usePresenceHeartbeat";
import { PRESENCE_LABELS, computePresence } from "@/lib/presence";
import { setMyPresence } from "@/lib/dashboard-api";
import { clearLocalCandidateData } from "@/lib/clear-local-data";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/analyse", label: "Analyse" },
  { href: "/analyse/compare", label: "Compare" },
  { href: "/dashboard/candidates", label: "Candidates" },
  { href: "/dashboard/talent-pool", label: "Talent pool" },
  { href: "/dashboard/shortlists", label: "Shortlists" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/jobs", label: "Jobs" },
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

// The tab for the current page: the most specific match, so /analyse/compare
// lights up "Compare" rather than both it and "Analyse".
function activeTabHref(pathname) {
  const matches = TABS.filter((t) =>
    t.href === "/dashboard" ? pathname === t.href : pathname === t.href || pathname?.startsWith(`${t.href}/`)
  );
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

function initials(name) {
  return (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

// Small stack of teammate initials, Agency-plan only - a quiet, constant
// reminder that this is a shared workspace, not just a personal one.
// Pulls from the same GET /api/team the Team page itself uses.
function TeammateStack({ teammates }) {
  if (!teammates || teammates.length < 2) return null;
  const order = { active: 0, busy: 1, idle: 2, away: 3, offline: 4 };
  const shown = [...teammates].sort((a, b) => (order[a.presence?.state] ?? 4) - (order[b.presence?.state] ?? 4)).slice(0, 4);
  const overflow = teammates.length - shown.length;
  return (
    <Link
      href="/dashboard/team"
      className="hidden lg:flex items-center -space-x-1.5 mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)] rounded-full"
      aria-label={`${teammates.length} people on your team`}
      title={teammates.map((t) => `${t.name} - ${PRESENCE_LABELS[t.presence?.state] || "Offline"}`).join("\n")}
    >
      {shown.map((t) => (
        <span key={t.id} className="relative">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white ring-2 ring-white"
            style={{ background: "var(--forest)", opacity: t.presence?.online ? 1 : 0.55 }}
          >
            {initials(t.name)}
          </span>
          {t.presence && <PresenceDot state={t.presence.state} size={7} className="absolute -bottom-0.5 -right-0.5" />}
        </span>
      ))}
      {overflow > 0 && (
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold ring-2 ring-white" style={{ background: "var(--mist)", color: "var(--ink-soft)" }}>
          +{overflow}
        </span>
      )}
    </Link>
  );
}

function DashboardNavContent() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = user?.id;
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const userName = user?.fullName;
  const pathname = usePathname();
  const activeHref = activeTabHref(pathname);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [me, setMe] = useState(null); // { firstName, agencyName, plan }
  const [teammates, setTeammates] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || !posthog.__loaded) return;

    const properties = {};
    if (userEmail) properties.email = userEmail;
    if (userName) properties.name = userName;

    posthog.identify(userId, properties);
  }, [isLoaded, isSignedIn, userId, userEmail, userName]);

  // Workspace name + plan for the nav strip and the teammate stack -
  // fetched here (not read from any single page's own data) since this
  // component renders independently on every dashboard route.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setMe(d.user);
      })
      .catch(() => {});
  }, []);

  // Every signed-in page reports that this person is here (Team page presence).
  usePresenceHeartbeat(Boolean(isSignedIn));

  // Teammates (with their presence), refreshed every minute so the dots stay
  // current on a page left open.
  useEffect(() => {
    if (me?.plan !== "agency") return;
    const load = () =>
      fetch("/api/team", { credentials: "include" })
        .then((r) => r.json())
        .then((rows) => {
          if (Array.isArray(rows)) setTeammates(rows);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [me?.plan]);

  const mine = teammates?.find((t) => t.id === userId) || null;
  // null when the workspace has presence switched off (/dashboard/privacy).
  const myPresence = mine?.presenceRaw ? computePresence(mine.presenceRaw) : null;
  async function setStatus(status) {
    setMenuOpen(false);
    try {
      const updated = await setMyPresence({ status });
      setTeammates((list) => list?.map((t) => (t.id === userId ? { ...t, presenceRaw: updated, presence: updated.presence } : t)));
    } catch {
      // The Team page shows the real state; nothing else to do here.
    }
  }

  // Shows a one-time post-login greeting in the workspace-name slot rather
  // than a separate banner taking up page space. Clerk's <SignIn/>
  // redirects here with ?welcome=1 (see app/login) - stripped from the URL
  // immediately via replace() so a manual refresh doesn't re-show it.
  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      setShowWelcome(true);
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname/router intentionally excluded: this should only react to the query param changing, not to every route change
  }, [searchParams]);

  useEffect(() => {
    if (!showWelcome) return;
    const t = setTimeout(() => setShowWelcome(false), 6000);
    return () => clearTimeout(t);
  }, [showWelcome]);

  const displayName = userName || userEmail || "Your account";
  const initialsLabel = initials(userName || userEmail);

  // Only greet by name once one has actually loaded from either source -
  // otherwise (a brief window on first paint, or if Clerk/api/auth/me
  // hasn't resolved yet) this would fall back to "Your account"'s first
  // word ("Your"), which is worse than a plain, name-less greeting.
  const firstName = me?.firstName || (userName ? userName.split(" ")[0] : null);
  const workspaceLabel = showWelcome
    ? (firstName ? `Welcome back, ${firstName}.` : "Welcome back.")
    : me?.agencyName || "Built for recruitment agencies";

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1200px] mx-auto px-6 h-[56px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group min-w-0" aria-label="Helixon home">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105 shrink-0" style={{ background: "var(--forest)" }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span className="flex flex-col leading-none min-w-0">
            <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>Helixon</span>
            <span className="hidden sm:block text-[10px] font-medium mt-0.5 truncate max-w-[220px]" style={{ color: "var(--ink-soft)" }}>
              {workspaceLabel}
            </span>
          </span>
        </Link>

        {/* Ten tabs don't all fit between md and xl - the row scrolls rather
            than pushing the account controls off the edge. */}
        <div className="hidden md:flex items-center gap-0.5 xl:gap-1 min-w-0 mx-3 overflow-x-auto text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
          {TABS.map((t) => {
            const active = t.href === activeHref;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="px-2 xl:px-3 py-1.5 rounded-[8px] whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--forest)]"
                style={active ? { background: "var(--mint)", color: "var(--forest)", fontWeight: 600 } : {}}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        <div className="relative flex items-center gap-2 shrink-0">
          <TeammateStack teammates={teammates} />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]"
            style={{ border: "1px solid var(--border)" }}
          >
            <span className="relative">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: "var(--forest)" }}>
                {initialsLabel}
              </span>
              {myPresence && myPresence.state !== "hidden" && <PresenceDot state={myPresence.state === "offline" ? "active" : myPresence.state} size={8} className="absolute -bottom-0.5 -right-0.5" />}
            </span>
            <span className="text-[11px] font-medium hidden sm:block" style={{ color: "var(--ink)" }}>{userName || userEmail}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-[12px] p-1.5 bg-white" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 24px -12px rgba(19,32,27,0.25)" }}>
              {myPresence && (
                <div className="pb-1.5 mb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest px-3 pt-1 pb-1" style={{ color: "var(--ink-faint)" }}>Your status</p>
                  {[
                    [null, "active", "Automatic", "Active or idle, from what you're doing"],
                    ["busy", "busy", "Busy", "Heads down - teammates see you're busy"],
                    ["away", "away", "Away", "Stepped out"],
                  ].map(([value, dot, label, hint]) => {
                    const current = (mine?.presenceRaw?.status ?? null) === value && (value === null || myPresence.state === value);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setStatus(value)}
                        title={hint}
                        className="w-full flex items-center gap-2 text-left text-xs px-3 py-1.5 rounded-[8px] hover:bg-[var(--mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
                        style={{ color: "var(--ink)", fontWeight: current ? 600 : 400 }}
                      >
                        <PresenceDot state={dot} size={8} />
                        {label}
                        {current && <span className="ml-auto" style={{ color: "var(--forest)" }}>✓</span>}
                      </button>
                    );
                  })}
                  <Link href="/dashboard/team#my-status" className="block text-[11px] px-3 pt-1 hover:underline" style={{ color: "var(--forest)" }} onClick={() => setMenuOpen(false)}>
                    Add a message or end time →
                  </Link>
                </div>
              )}
              <Link href="/account" className="block text-xs px-3 py-2 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]" style={{ color: "var(--ink)" }} onClick={() => setMenuOpen(false)}>Account settings</Link>
              <Link href="/billing" className="block text-xs px-3 py-2 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]" style={{ color: "var(--ink)" }} onClick={() => setMenuOpen(false)}>Billing</Link>
              <Link href="/dashboard/privacy" className="block text-xs px-3 py-2 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]" style={{ color: "var(--ink)" }} onClick={() => setMenuOpen(false)}>Data &amp; privacy</Link>
              {me?.plan === "agency" && (
                <Link href="/dashboard/team" className="block text-xs px-3 py-2 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]" style={{ color: "var(--ink)" }} onClick={() => setMenuOpen(false)}>Invite teammate</Link>
              )}
              <SignOutButton redirectUrl="/login">
                <button
                  type="button"
                  onClick={() => {
                    if (posthog.__loaded) posthog.reset();
                    clearLocalCandidateData();
                  }}
                  className="w-full text-left block text-xs px-3 py-2 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]"
                  style={{ color: "var(--score-low)" }}
                >
                  Log out
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
      </div>

      {/* Mobile tab row */}
      <div className="md:hidden flex overflow-x-auto gap-1 px-4 pb-2 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
        {TABS.map((t) => {
          const active = t.href === activeHref;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="px-3 py-1.5 rounded-[8px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]"
              style={active ? { background: "var(--mint)", color: "var(--forest)", fontWeight: 600 } : {}}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// useSearchParams() (for the post-login ?welcome=1 flag) requires a
// Suspense boundary in the app router, or static prerendering fails the
// build - wrapping it here means every page that already does
// `<DashboardNav />` gets that for free instead of needing its own
// Suspense boundary around the nav.
function DashboardNavFallback() {
  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b h-[56px]" style={{ borderColor: "var(--border)" }} aria-hidden="true" />
  );
}

export default function DashboardNav() {
  return (
    <Suspense fallback={<DashboardNavFallback />}>
      <DashboardNavContent />
    </Suspense>
  );
}
