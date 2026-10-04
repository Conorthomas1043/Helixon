"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SignOutButton, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { useAnalyticsIdentity } from "@/lib/analytics";
import PresenceDot from "@/components/PresenceDot";
import { usePresenceHeartbeat } from "@/lib/hooks/usePresenceHeartbeat";
import { PRESENCE_LABELS, computePresence } from "@/lib/presence";
import { setMyPresence } from "@/lib/dashboard-api";
import { clearLocalCandidateData } from "@/lib/clear-local-data";
import { KeyboardShortcuts, NotificationsBell, SearchPalette } from "@/components/dashboard/NavTools";

// The everyday screens are tabs; everything else sits under "More",
// grouped, so the bar fits without scrolling on a laptop.
const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/analyse", label: "Analyse" },
  { href: "/dashboard/candidates", label: "Candidates" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/jobs", label: "Jobs" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/interviews", label: "Interviews" },
];

const MORE = [
  {
    group: "Sourcing",
    links: [
      { href: "/dashboard/talent-pool", label: "Talent pool" },
      { href: "/dashboard/shortlists", label: "Shortlists" },
      { href: "/analyse/compare", label: "Compare" },
      { href: "/dashboard/email", label: "Email" },
      { href: "/dashboard/import", label: "Import" },
    ],
  },
  {
    group: "Revenue",
    links: [
      { href: "/dashboard/business-development", label: "Business development" },
      { href: "/dashboard/placements", label: "Placements & invoices" },
      { href: "/dashboard/performance", label: "Performance" },
      { href: "/dashboard/analytics", label: "Analytics" },
    ],
  },
  {
    group: "Workspace",
    links: [
      { href: "/dashboard/team", label: "Team" },
      { href: "/dashboard/compliance", label: "Compliance" },
      { href: "/dashboard/settings", label: "Settings" },
    ],
  },
];

const MORE_LINKS = MORE.flatMap((g) => g.links);

// The link for the current page: the most specific match, so
// /analyse/compare lights up "Compare" rather than both it and "Analyse".
function activeTabHref(pathname) {
  const matches = [...TABS, ...MORE_LINKS].filter((t) =>
    t.href === "/dashboard" ? pathname === t.href : pathname === t.href || pathname?.startsWith(`${t.href}/`)
  );
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

// "More" - the rest of the dashboard, grouped. Closes on a pick, Escape or
// a click outside.
function MoreMenu({ activeHref, compact = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = MORE_LINKS.find((l) => l.href === activeHref);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={`${compact ? "px-3" : "px-2 xl:px-3"} py-1.5 rounded-[8px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--forest)]`}
        style={current ? { background: "var(--mint)", color: "var(--forest)", fontWeight: 600 } : {}}
      >
        {current ? current.label : "More"} ▾
      </button>
      {open && (
        <div
          className={`absolute right-0 top-[calc(100%+6px)] z-50 w-[min(92vw,420px)] rounded-[12px] p-3 bg-white grid grid-cols-2 sm:grid-cols-3 gap-3`}
          style={{ border: "1px solid var(--border)", boxShadow: "0 12px 24px -12px rgba(19,32,27,0.25)" }}
        >
          {MORE.map((g) => (
            <div key={g.group}>
              <p className="text-[11px] font-semibold uppercase tracking-widest px-2 mb-1" style={{ color: "var(--ink-faint)" }}>
                {g.group}
              </p>
              {g.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block text-xs px-2 py-1.5 rounded-[8px] hover:bg-[var(--mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
                  style={l.href === activeHref ? { color: "var(--forest)", fontWeight: 600 } : { color: "var(--ink)" }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white ring-2 ring-white"
            style={{ background: "var(--forest)", opacity: t.presence?.online ? 1 : 0.55 }}
          >
            {initials(t.name)}
          </span>
          {t.presence && <PresenceDot state={t.presence.state} size={7} className="absolute -bottom-0.5 -right-0.5" />}
        </span>
      ))}
      {overflow > 0 && (
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ring-2 ring-white" style={{ background: "var(--mist)", color: "var(--ink-soft)" }}>
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
  // Read from the URL on the first render rather than copied in by an effect.
  const [showWelcome, setShowWelcome] = useState(() => searchParams.get("welcome") === "1");

  useAnalyticsIdentity({
    userId: isLoaded && isSignedIn ? userId : null,
    email: userEmail,
    name: userName,
    agencyId: me?.agencyId,
    agencyName: me?.agencyName,
    plan: me?.plan,
  });


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
    if (searchParams.get("welcome") === "1") router.replace(pathname);
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
            <span className="hidden sm:block text-[11px] font-medium mt-0.5 truncate max-w-[220px]" style={{ color: "var(--ink-soft)" }}>
              {workspaceLabel}
            </span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-0.5 xl:gap-1 min-w-0 mx-3 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
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
          <MoreMenu activeHref={activeHref} />
        </div>

        <div className="relative flex items-center gap-2 shrink-0">
          <SearchPalette />
          <NotificationsBell />
          <KeyboardShortcuts />
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
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: "var(--forest)" }}>
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
                  <p className="text-[11px] font-semibold uppercase tracking-widest px-3 pt-1 pb-1" style={{ color: "var(--ink-faint)" }}>Your status</p>
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
              <Link href="/dashboard/settings" className="block text-xs px-3 py-2 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]" style={{ color: "var(--ink)" }} onClick={() => setMenuOpen(false)}>Workspace settings</Link>
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

      {/* Mobile tab row: the tabs scroll; "More" stays put at the end. */}
      <div className="md:hidden flex items-center gap-1 px-4 pb-2 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
        <div className="flex overflow-x-auto gap-1 min-w-0">
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
        <MoreMenu activeHref={activeHref} compact />
      </div>
      {me?.paymentIssue && pathname !== "/billing" && <PaymentIssueBanner issue={me.paymentIssue} />}
    </nav>
  );
}

// Shown on every signed-in page while a renewal payment has failed.
// During Stripe's retries (past_due) everything keeps working, so this is
// the only sign anything is wrong; once it's unpaid, screening has stopped.
// Only the member who pays can fix it, so teammates are told to ask them.
function PaymentIssueBanner({ issue }) {
  const stopped = issue.status === "unpaid";
  return (
    <div role="alert" className="border-t" style={{ background: "#fff7f7", borderColor: "#fecaca" }}>
      <div className="max-w-[1200px] mx-auto px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" style={{ color: "var(--ink)" }}>
        <span>
          <strong style={{ color: "var(--score-low)" }}>Your last Helixon payment didn&apos;t go through.</strong>{" "}
          {stopped
            ? "Screening and email are paused until it's paid."
            : "Everything still works for now; update the payment method to keep it that way."}
        </span>
        {issue.isPayer ? (
          <Link href="/billing" className="font-semibold underline" style={{ color: "var(--score-low)" }}>
            Update payment method
          </Link>
        ) : (
          <span style={{ color: "var(--ink-soft)" }}>Ask whoever manages billing for your agency to update it.</span>
        )}
      </div>
    </div>
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
