"use client";

import { UserProfile } from "@clerk/nextjs";
import { useRef, useState } from "react";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export default function ProfilePage() {
const cardRef = useRef(null);
const [spot, setSpot] = useState({ x: 50, y: 0 });

function handleCardMouseMove(e) {
const r = cardRef.current?.getBoundingClientRect();
if (!r) return;

setSpot({
  x: ((e.clientX - r.left) / r.width) * 100,
  y: ((e.clientY - r.top) / r.height) * 100,
});

}

return ( <main className="min-h-screen relative overflow-hidden">
{/* Ambient background — same visual system as Login */} <div
     className="absolute inset-0 overflow-hidden pointer-events-none"
     aria-hidden="true"
   >
<div
className="absolute inset-0"
style={{
background:
"linear-gradient(135deg, #eef4f0 0%, #e7f0ea 45%, #dcebe0 100%)",
}}
/>

    <div
      className="absolute w-[620px] h-[620px] rounded-full blur-3xl animate-[driftA_20s_ease-in-out_infinite]"
      style={{
        background: "var(--mint)",
        opacity: 0.5,
        top: "-14%",
        left: "32%",
      }}
    />

    <div
      className="absolute w-[440px] h-[440px] rounded-full blur-3xl animate-[driftB_24s_ease-in-out_infinite]"
      style={{
        background: "var(--forest)",
        opacity: 0.1,
        bottom: "-10%",
        left: "58%",
      }}
    />

    <div
      className="absolute w-[340px] h-[340px] rounded-full blur-3xl animate-[driftA_28s_ease-in-out_infinite_reverse]"
      style={{
        background: "var(--signal, #f59e0b)",
        opacity: 0.12,
        bottom: "12%",
        left: "72%",
      }}
    />

    <svg className="absolute inset-0 w-full h-full opacity-[0.05] mix-blend-overlay">
      <filter id="profile-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          stitchTiles="stitch"
        />
      </filter>
      <rect
        width="100%"
        height="100%"
        filter="url(#profile-grain)"
      />
    </svg>
  </div>

  {/* Header */}
  <header className="relative z-20 px-6 sm:px-10 lg:px-12 py-6">
    <div className="max-w-6xl mx-auto flex items-center justify-between">
      <a
        href="/"
        className="flex items-center gap-3"
        aria-label="Helixon home"
      >
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center shadow-sm"
          style={{ background: "var(--forest)" }}
        >
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <rect
              x="4"
              y="9"
              width="12"
              height="4.5"
              rx="2.25"
              fill="white"
              opacity="0.55"
            />
            <rect
              x="12"
              y="15.5"
              width="12"
              height="4.5"
              rx="2.25"
              fill="white"
            />
            <circle
              cx="22.5"
              cy="10.5"
              r="1.8"
              fill="var(--signal, #f59e0b)"
            />
          </svg>
        </div>

        <span
          className="text-lg font-semibold tracking-tight"
          style={{
            color: "#13201b",
            fontFamily: "var(--font-display)",
          }}
        >
          Helixon
        </span>
      </a>

      <a
        href="/dashboard"
        className="text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: "#416252" }}
      >
        ← Dashboard
      </a>
    </div>
  </header>

  {/* Main content */}
  <div className="relative z-10 px-6 sm:px-10 pb-16">
    <div className="max-w-6xl mx-auto">
      <div
        className="mb-8"
        style={{
          animation: `panelIn 0.5s ${EASE}`,
        }}
      >
        <p
          className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3"
          style={{ color: "var(--forest)" }}
        >
          Account
        </p>

        <h1
          className="text-[2.4rem] sm:text-[3rem] font-semibold leading-[1.05] tracking-tight"
          style={{
            color: "#13201b",
            fontFamily: "var(--font-display)",
          }}
        >
          Your profile.
        </h1>

        <p
          className="mt-3 text-[15px] max-w-lg leading-relaxed"
          style={{ color: "#5a7a6a" }}
        >
          Manage your personal information, email addresses and
          account security.
        </p>
      </div>

      {/* Glass Clerk container */}
      <div
        ref={cardRef}
        onMouseMove={handleCardMouseMove}
        className="relative rounded-[24px] p-5 sm:p-8 lg:p-10 overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.68)",
          backdropFilter: "blur(26px)",
          WebkitBackdropFilter: "blur(26px)",
          border: "1px solid rgba(255,255,255,0.65)",
          boxShadow:
            "0 40px 80px -32px rgba(19,32,27,0.28), 0 1px 0 rgba(255,255,255,0.85) inset",
          animation: `panelIn 0.6s ${EASE}`,
        }}
      >
        {/* Cursor light */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(
              520px circle at ${spot.x}% ${spot.y}%,
              rgba(255,255,255,0.5),
              transparent 60%
            )`,
          }}
        />

        <div className="relative">
          <UserProfile
            path="/profile"
            routing="path"
            appearance={{
              variables: {
                colorPrimary: "#0b3a2a",
                colorText: "#13201b",
                colorTextSecondary: "#5a7a6a",
                colorInputBackground: "rgba(255,255,255,0.6)",
                colorInputText: "#13201b",
                borderRadius: "12px",
                fontFamily: "inherit",
              },

              elements: {
                rootBox: "!w-full !min-w-0",
                cardBox:
                  "!w-full !min-w-0 !max-w-none shadow-none bg-transparent",
                card:
                  "!w-full !max-w-none shadow-none bg-transparent border-0",
                navbar:
                  "bg-transparent border-0",
                navbarMobileMenuButton:
                  "rounded-[12px]",
                pageScrollBox:
                  "!w-full",
                page: "!w-full",
                profilePage:
                  "!w-full",
                profileSection:
                  "border-b border-black/[0.06]",
                profileSectionPrimaryButton:
                  "text-[#0b3a2a] font-semibold",
                formButtonPrimary:
                  "normal-case text-sm font-semibold rounded-[12px] py-3 shadow-[0_12px_24px_-10px_rgba(11,58,42,0.55)]",
                formFieldInput:
                  "!w-full box-border rounded-[12px]",
                formFieldLabel:
                  "text-[#315141] font-medium",
                headerTitle:
                  "tracking-tight text-[#13201b]",
                headerSubtitle:
                  "text-[13px] text-[#5a7a6a]",
                accordionTriggerButton:
                  "text-[#13201b]",
                menuButton:
                  "rounded-[10px]",
                badge:
                  "rounded-full",
              },
            }}
          />
        </div>
      </div>

      {/* Security / account information */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5"
        style={{
          animation: `panelIn 0.7s ${EASE}`,
        }}
      >
        <div
          className="rounded-[20px] p-5"
          style={{
            background: "rgba(255,255,255,0.48)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.65)",
          }}
        >
          <p
            className="text-[10px] font-semibold tracking-[0.16em] uppercase"
            style={{ color: "#6b8979" }}
          >
            Security
          </p>

          <p
            className="mt-2 text-sm font-semibold"
            style={{ color: "#13201b" }}
          >
            Protected by Clerk
          </p>

          <p
            className="mt-1 text-xs leading-relaxed"
            style={{ color: "#6b8979" }}
          >
            Passwords, sessions, email verification and authentication
            security are managed by Clerk.
          </p>
        </div>

        <div
          className="rounded-[20px] p-5"
          style={{
            background: "rgba(255,255,255,0.48)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.65)",
          }}
        >
          <p
            className="text-[10px] font-semibold tracking-[0.16em] uppercase"
            style={{ color: "#6b8979" }}
          >
            Account
          </p>

          <p
            className="mt-2 text-sm font-semibold"
            style={{ color: "#13201b" }}
          >
            Helixon workspace
          </p>

          <p
            className="mt-1 text-xs leading-relaxed"
            style={{ color: "#6b8979" }}
          >
            Your Helixon-specific organisation and recruitment data
            remains separate from your Clerk authentication identity.
          </p>
        </div>
      </div>
    </div>
  </div>

  <style>{`
    @keyframes panelIn {
      from {
        opacity: 0;
        transform: translateY(14px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes driftA {
      0%, 100% {
        transform: translate(0, 0) scale(1);
      }
      50% {
        transform: translate(-34px, 28px) scale(1.09);
      }
    }

    @keyframes driftB {
      0%, 100% {
        transform: translate(0, 0) scale(1);
      }
      50% {
        transform: translate(28px, -22px) scale(1.06);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
      }
    }
  `}</style>
</main>
);
}
