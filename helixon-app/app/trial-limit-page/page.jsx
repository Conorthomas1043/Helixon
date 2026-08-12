"use client";
import { useRef, useState } from "react";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function AmbientBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #eef4f0 0%, #e7f0ea 45%, #dcebe0 100%)" }} />
      <div className="absolute w-[620px] h-[620px] rounded-full blur-3xl animate-[driftA_20s_ease-in-out_infinite]" style={{ background: "var(--mint)", opacity: 0.5, top: "-14%", left: "32%" }} />
      <div className="absolute w-[440px] h-[440px] rounded-full blur-3xl animate-[driftB_24s_ease-in-out_infinite]" style={{ background: "var(--forest)", opacity: 0.1, bottom: "-10%", left: "58%" }} />
      <div className="absolute w-[340px] h-[340px] rounded-full blur-3xl animate-[driftA_28s_ease-in-out_infinite_reverse]" style={{ background: "var(--signal, #f59e0b)", opacity: 0.12, bottom: "12%", left: "72%" }} />
      <svg className="absolute inset-0 w-full h-full opacity-[0.05] mix-blend-overlay">
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}

function GlassPanel({ children, className = "" }) {
  const ref = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 0 });
  function move(e) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }
  return (
    <div
      ref={ref}
      onMouseMove={move}
      className={`relative rounded-[24px] overflow-hidden ${className}`}
      style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(26px)", WebkitBackdropFilter: "blur(26px)", border: "1px solid rgba(255,255,255,0.65)", boxShadow: "0 40px 90px -32px rgba(19,32,27,0.3), 0 1px 0 rgba(255,255,255,0.85) inset" }}
    >
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ background: `radial-gradient(500px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.5), transparent 60%)` }} />
      <div className="relative">{children}</div>
    </div>
  );
}

const PLANS = [
  {
    name: "Solo", price: "£149", period: "/ month",
    features: ["Unlimited analyses", "Bulk upload", "Shortlists & history", "Priority support"],
    href: "YOUR-SOLO-STRIPE-LINK", highlight: true,
  },
  {
    name: "Team", price: "£349", period: "/ month",
    features: ["Everything in Solo", "Multi-seat access", "Shared templates", "Dedicated onboarding"],
    href: "YOUR-TEAM-STRIPE-LINK", highlight: false,
  },
];

export default function TrialLimitPage() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      <AmbientBg />

      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <a href="/" className="flex items-center gap-2.5" aria-label="Helixon home">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
            <span className="text-white text-sm font-bold">H</span>
          </div>
          <span className="text-base font-semibold" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
        </a>
        <a href="/login" className="text-xs font-medium" style={{ color: "#5a7a6a" }}>Sign in</a>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10" style={{ animation: `panelIn 0.5s ${EASE}` }}>
            <div className="w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-6" style={{ background: "var(--forest)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12.75l1.5 1.5 4.5-4.5" /><circle cx="12" cy="12" r="9.75" />
              </svg>
            </div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--forest)" }}>Trial complete</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              You've used your 3 free analyses.
            </h1>
            <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: "#5a7a6a" }}>
              Good news — your account and everything you've scanned so far is saved. Pick a plan to keep screening candidates without limits.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ animation: `panelIn 0.6s ${EASE}` }}>
            {PLANS.map((plan) => (
              <GlassPanel key={plan.name} className={plan.highlight ? "sm:scale-[1.03]" : ""}>
                <div className="p-7">
                  {plan.highlight && (
                    <span className="inline-block text-[9px] font-bold px-2.5 py-1 rounded-full mb-4" style={{ background: "var(--signal, #f59e0b)", color: "#13201b" }}>
                      MOST POPULAR
                    </span>
                  )}
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#8aaa9a" }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#13201b" }}>{plan.price}</span>
                    <span className="text-[12px]" style={{ color: "#8aaa9a" }}>{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5 mb-7">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px]" style={{ color: "#5a7a6a" }}>
                        <svg width="14" height="14" className="shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={plan.href}
                    className="block text-center text-sm font-semibold py-3.5 rounded-[12px] text-white transition-all"
                    style={{ background: "var(--forest)", boxShadow: "0 12px 24px -10px rgba(11,58,42,0.5)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-deep)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}
                  >
                    Choose {plan.name}
                  </a>
                </div>
              </GlassPanel>
            ))}
          </div>

          <p className="text-center text-xs mt-8" style={{ color: "#8aaa9a" }}>
            Not ready yet? <a href="/" className="font-medium hover:underline" style={{ color: "var(--forest)" }}>Back to homepage</a>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes panelIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes driftA { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-34px, 28px) scale(1.09); } }
        @keyframes driftB { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(28px, -22px) scale(1.06); } }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; } }
      `}</style>
    </main>
  );
}