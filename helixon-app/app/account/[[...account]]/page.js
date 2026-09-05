"use client";

import { UserProfile } from "@clerk/nextjs";
import Link from "next/link";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export default function AccountPage() {
  return (
    <main className="min-h-screen relative overflow-hidden bg-[#f4f8f6] text-[#10221d]">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-[15%] -top-[20%] h-[650px] w-[650px] rounded-full opacity-50 blur-[100px]"
          style={{
            background:
              "radial-gradient(circle, rgba(42,164,125,0.18) 0%, rgba(42,164,125,0) 70%)",
          }}
        />

        <div
          className="absolute right-[-10%] top-[25%] h-[600px] w-[600px] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(215,195,120,0.18) 0%, rgba(215,195,120,0) 70%)",
          }}
        />

        <div
          className="absolute bottom-[-20%] left-[30%] h-[650px] w-[650px] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(89,181,153,0.16) 0%, rgba(89,181,153,0) 70%)",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 h-[64px] border-b border-[#dbe7e2] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1280px] items-center px-6 lg:px-10">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 transition-opacity duration-300 hover:opacity-75"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#087a5b] shadow-[0_5px_16px_rgba(8,122,91,0.18)]">
              <div className="relative h-4 w-4">
                <span className="absolute left-0 top-[2px] h-[3px] w-[11px] rounded-full bg-white" />
                <span className="absolute bottom-[2px] right-0 h-[3px] w-[8px] rounded-full bg-white" />
                <span className="absolute right-0 top-[2px] h-[3px] w-[3px] rounded-full bg-[#e86b63]" />
              </div>
            </div>

            <span className="text-[18px] font-semibold tracking-[-0.03em]">
              Helixon
            </span>
          </Link>

          <nav className="ml-12 hidden items-center gap-9 md:flex">
            <Link
              href="/scoring"
              className="text-[15px] font-medium text-[#55766c] transition-colors hover:text-[#10221d]"
            >
              Scoring
            </Link>

            <Link
              href="/dashboard"
              className="text-[15px] font-medium text-[#55766c] transition-colors hover:text-[#10221d]"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Page */}
      <div className="relative z-10 mx-auto flex max-w-[1280px]">
        {/* Sidebar */}
        <aside className="hidden w-[230px] shrink-0 border-r border-[#dbe7e2] px-7 pt-12 lg:block">
          <nav className="space-y-2">
            <Link
              href="/account"
              className="flex items-center gap-4 rounded-[13px] bg-[#e4f2ed] px-4 py-3 text-[15px] font-medium text-[#087a5b]"
            >
              <UserIcon />
              Profile
            </Link>

            <div className="flex items-center gap-4 rounded-[13px] px-4 py-3 text-[15px] font-medium text-[#5c7b72]">
              <ShieldIcon />
              Security
            </div>

            <div className="flex items-center gap-4 rounded-[13px] px-4 py-3 text-[15px] font-medium text-[#5c7b72]">
              <BellIcon />
              Notifications
            </div>

            <div className="mt-3 flex items-center gap-4 rounded-[13px] px-4 py-3 text-[15px] font-medium text-[#e53935]">
              <WarningIcon />
              Danger zone
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1 px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
          <div className="mx-auto max-w-[900px]">
            {/* Heading */}
            <div
              className="mb-9"
              style={{
                animation: `profileIn 700ms ${EASE} both`,
              }}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#087a5b] shadow-[0_7px_20px_rgba(8,122,91,0.16)]">
                    <div className="relative h-4 w-4">
                      <span className="absolute left-0 top-[2px] h-[3px] w-[11px] rounded-full bg-white" />
                      <span className="absolute bottom-[2px] right-0 h-[3px] w-[8px] rounded-full bg-white" />
                      <span className="absolute right-0 top-[2px] h-[3px] w-[3px] rounded-full bg-[#e86b63]" />
                    </div>
                  </div>

                  <span className="text-[19px] font-semibold tracking-[-0.035em]">
                    Helixon
                  </span>
                </div>

                <Link
                  href="/dashboard"
                  className="text-[15px] font-medium text-[#54776c] transition-colors hover:text-[#10221d]"
                >
                  ← Dashboard
                </Link>
              </div>

              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.24em] text-[#087a5b]">
                Account
              </p>

              <h1 className="text-[48px] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-[56px]">
                Your profile.
              </h1>

              <p className="mt-4 max-w-[650px] text-[18px] leading-7 text-[#638279]">
                Manage your personal information, email addresses and account
                security.
              </p>
            </div>

            {/* Clerk */}
            <div
              className="overflow-hidden rounded-[28px] border border-white/80 bg-white/65 shadow-[0_25px_80px_rgba(35,87,70,0.10)] backdrop-blur-[28px]"
              style={{
                animation: `profileIn 800ms ${EASE} 80ms both`,
              }}
            >
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
                    rootBox: {
                      width: "100%",
                    },

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

                    navbarButton: {
                      borderRadius: "12px",
                    },

                    pageScrollBox: {
                      background: "transparent",
                    },

                    profileSectionPrimaryButton: {
                      borderRadius: "12px",
                    },

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

                    footer: {
                      background: "transparent",
                    },
                  },
                }}
              />
            </div>

            {/* Helixon information */}
            <div
              className="mt-6 grid gap-5 sm:grid-cols-2"
              style={{
                animation: `profileIn 800ms ${EASE} 160ms both`,
              }}
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
          </div>
        </section>
      </div>

      <style jsx>{`
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
    </main>
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

      <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
        {title}
      </h2>

      <p className="mt-2 text-[14px] leading-6 text-[#6b8980]">{text}</p>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 20c.7-3.5 3-5.5 7-5.5s6.3 2 7 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
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

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10 21h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l9 17H3L12 3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r=".8" fill="currentColor" />
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