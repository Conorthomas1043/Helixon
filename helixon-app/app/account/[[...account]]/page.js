"use client";

import { UserProfile } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// This renders inside app/account/layout.jsx's content slot - the shared
// header (AppNav), page hero, and tab sidebar (SettingsNav) all come from
// the layout already. This file used to duplicate all of that itself
// (its own header, its own sidebar, its own hero) wrapped around this
// same Clerk widget, which is why the account pages showed two stacked
// copies of the whole shell. Only the tab-specific content belongs here.
//
// Clerk's <UserProfile path="/account" routing="path"> only recognises
// two of the four SettingsNav tabs as real internal sections: the base
// path (/account) for Profile, and /account/security for Security.
// Notifications and Danger zone aren't Clerk concepts, and there's no
// Helixon-specific UI built for those yet - visiting either previously
// still rendered the Clerk widget, which silently fell back to its
// default Profile view while the heading above it kept whatever copy
// happened to be selected. That combination (nav tab highlighted as
// "active", heading and widget both showing Profile content) is a real,
// user-visible bug: it looks like the Notifications/Danger zone page
// loaded, but the content is just Profile again. Rendering an honest
// "not built yet" placeholder for those two routes instead - still a
// visible gap, but no longer a misleading one.
const TAB_COPY = {
  "/account": {
    eyebrow: "Account",
    title: "Your profile.",
    body: "Manage your personal information, email addresses and account security.",
  },
  "/account/security": {
    eyebrow: "Security",
    title: "Your security.",
    body: "Manage your password, two-factor authentication and active sessions.",
  },
  "/account/notifications": {
    eyebrow: "Notifications",
    title: "Notification preferences.",
    body: "Control what Helixon emails you about.",
  },
  "/account/danger": {
    eyebrow: "Danger zone",
    title: "Delete your account.",
    body: "Permanently remove your account and its data.",
  },
};

// The only two sections Clerk's <UserProfile> actually renders content
// for - see the comment above TAB_COPY.
const CLERK_ROUTES = new Set(["/account", "/account/security"]);

export default function AccountPage() {
  const pathname = usePathname();
  const copy = TAB_COPY[pathname] || TAB_COPY["/account"];
  const isClerkRoute = CLERK_ROUTES.has(pathname);

  return (
    <>
      {/* Heading */}
      <div
        className="mb-9"
        style={{ animation: `profileIn 700ms ${EASE} both` }}
      >
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.24em] text-[#087a5b]">
          {copy.eyebrow}
        </p>
        <h1 className="text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[48px]">
          {copy.title}
        </h1>
        <p className="mt-4 max-w-[560px] text-[16px] leading-7 text-[#638279]">
          {copy.body}
        </p>
      </div>

      {/* Clerk (Profile / Security) or an honest placeholder (Notifications / Danger zone) */}
      <div
        className="overflow-hidden rounded-[28px] border border-white/80 bg-white/65 shadow-[0_25px_80px_rgba(35,87,70,0.10)] backdrop-blur-[28px]"
        style={{ animation: `profileIn 800ms ${EASE} 80ms both` }}
      >
        {isClerkRoute ? (
          <UserProfile
            path="/account"
            routing="path"
            appearance={{
              variables: {
                colorPrimary: "#087a5b",
                colorText: "#10221d",
                colorTextSecondary: "#648178",
                colorBackground: "transparent",
                colorInputBackground: "rgba(255,255,255,0.72)",
                colorInputText: "#10221d",
                borderRadius: "14px",
                fontFamily: "inherit",
              },
              elements: {
                rootBox: { width: "100%" },
                cardBox: {
                  width: "100%",
                  maxWidth: "none",
                  boxShadow: "none",
                  border: "none",
                  background: "transparent",
                },
                card: {
                  width: "100%",
                  maxWidth: "none",
                  boxShadow: "none",
                  border: "none",
                  background: "transparent",
                },
                navbar: {
                  background: "rgba(255,255,255,0.35)",
                  borderRight: "1px solid rgba(180,205,195,0.35)",
                },
                navbarButton: { borderRadius: "12px" },
                // Clerk gives this pane its own fixed-height internal
                // scroll area by default, sized for a modal popup. Embedded
                // inline like this, that meant content taller than Clerk's
                // assumed modal height got clipped by our own rounded
                // card's overflow-hidden (there to clip square corners,
                // not to hide content) - the page looked "cut off early"
                // with no visible way to scroll the rest into view.
                // Letting this pane size to its actual content instead
                // means the page's own scroll shows all of it.
                scrollBox: { background: "transparent" },
                pageScrollBox: { background: "transparent", height: "auto", maxHeight: "none", overflow: "visible" },
                profileSectionPrimaryButton: { borderRadius: "12px" },
                formButtonPrimary: {
                  background: "#087a5b",
                  borderRadius: "12px",
                  boxShadow: "0 7px 18px rgba(8,122,91,0.16)",
                },
                formFieldInput: {
                  borderRadius: "12px",
                  border: "1px solid #d7e4df",
                  background: "rgba(255,255,255,0.72)",
                },
                footer: { background: "transparent" },
              },
            }}
          />
        ) : (
          <div className="px-8 py-14 text-center sm:px-14">
            <p className="mx-auto mb-2 text-[15px] font-semibold text-[#10221d]">Not built yet</p>
            <p className="mx-auto max-w-[420px] text-[14px] leading-6 text-[#638279]">
              This section doesn&apos;t exist yet. Need something here sooner? Email{" "}
              <a href="mailto:support@helixon.co.uk" className="font-semibold text-[#087a5b] hover:underline">
                support@helixon.co.uk
              </a>
              .
            </p>
          </div>
        )}
      </div>

      {/* Helixon information */}
      <div
        className="mt-6 grid gap-5 sm:grid-cols-2"
        style={{ animation: `profileIn 800ms ${EASE} 160ms both` }}
      >
        <InfoCard
          icon={<ShieldIcon />}
          eyebrow="Security"
          title="Protected by Clerk"
          text="Passwords, sessions, email verification and authentication security are managed by Clerk."
        />
        <InfoCard
          icon={<WorkspaceIcon />}
          eyebrow="Account"
          title="Helixon workspace"
          text="Your Helixon-specific organisation and recruitment data remains separate from your Clerk authentication identity."
        />
      </div>

      {/* FIX: global so keyframes aren't scoped away from inline styles */}
      <style jsx global>{`
        @keyframes profileIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </>
  );
}

function InfoCard({ icon, eyebrow, title, text }) {
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/55 p-6 shadow-[0_15px_45px_rgba(35,87,70,0.06)] backdrop-blur-xl">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#e6f3ef] text-[#087a5b]">
        {icon}
      </div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#709188]">
        {eyebrow}
      </p>
      <h2 className="text-[17px] font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 text-[14px] leading-6 text-[#6b8980]">{text}</p>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12l1.7 1.7 3.5-3.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WorkspaceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M3 21h18M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}