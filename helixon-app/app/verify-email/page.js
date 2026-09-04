"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function AmbientBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #eef4f0 0%, #e7f0ea 45%, #dcebe0 100%)" }} />
      <div className="absolute w-[560px] h-[560px] rounded-full blur-3xl animate-[driftA_20s_ease-in-out_infinite]" style={{ background: "var(--mint)", opacity: 0.5, top: "-14%", left: "30%" }} />
      <div className="absolute w-[400px] h-[400px] rounded-full blur-3xl animate-[driftB_24s_ease-in-out_infinite]" style={{ background: "var(--signal, #f59e0b)", opacity: 0.12, bottom: "-8%", right: "18%" }} />
      <svg className="absolute inset-0 w-full h-full opacity-[0.05] mix-blend-overlay">
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}

// ── Ring that fills in smoothly while verifying - a quiet, premium loader ──
function VerifyRing({ state }) {
  const circumference = 2 * Math.PI * 34;
  return (
    <div className="relative w-20 h-20 mx-auto mb-6">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          cx="40" cy="40" r="34" fill="none"
          stroke={state === "error" ? "#dc2626" : "var(--forest)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={state === "verifying" ? circumference * 0.25 : 0}
          style={{
            transition: `stroke-dashoffset 0.6s ${EASE}, stroke 0.3s ease`,
            animation: state === "verifying" ? "spin 1.1s linear infinite" : "none",
            transformOrigin: "40px 40px",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {state === "verifying" && (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.8" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
        )}
        {state === "success" && (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: `checkIn 0.4s ${EASE} 0.15s both` }}>
            <path d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
        {state === "error" && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        )}
      </div>
    </div>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Supabase's confirmation link carries token_hash + type, not a bare
  // "token" - both are required by verifyOtp(). We also expect the email
  // itself to be present in the link (added when the link is generated -
  // see note on the signup route) purely so the resend button below has
  // something to resend to; it isn't sent to verifyOtp.
  const tokenHash = searchParams?.get("token_hash");
  const type = searchParams?.get("type") || "signup";
  const email = searchParams?.get("email");

  const [state, setState] = useState("verifying"); // verifying | success | expired | error
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!tokenHash) { setState("error"); return; }
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token_hash: tokenHash, type }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.ok && data?.ok) {
          setState("success");
          setTimeout(() => { router.push("/"); router.refresh(); }, 1800);
        } else if (data?.error === "expired") {
          setState("expired");
        } else {
          setState("error");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    const t = setTimeout(verify, 900); // brief delay so the ring animation reads intentionally, not flashy
    return () => { cancelled = true; clearTimeout(t); };
  }, [tokenHash, type, router]);

  async function handleResend() {
    if (!email) return; // no address to send to - link was malformed/missing it
    setResending(true);
    try {
      await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } catch {
      // silent - resend failures aren't critical path, the button stays available
    } finally {
      setResending(false);
    }
  }

  const copy = {
    verifying: { title: "Verifying your email", body: "Just a moment while we confirm your link." },
    success:   { title: "Email verified", body: "Redirecting you to your workspace…" },
    expired:   { title: "This link has expired", body: "Verification links are only valid for a short while. Request a new one below." },
    error:     { title: "We couldn't verify that link", body: "It may have already been used, or the link may be broken. Try requesting a new one." },
  }[state];

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <AmbientBg />

      <div
        className="relative w-full max-w-sm rounded-[22px] p-8 sm:p-9 text-center"
        style={{ background: "rgba(255,255,255,0.78)", backdropFilter: "blur(26px)", WebkitBackdropFilter: "blur(26px)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 40px 80px -32px rgba(19,32,27,0.28), 0 1px 0 rgba(255,255,255,0.85) inset", animation: `panelIn 0.5s ${EASE}` }}
      >
        <a href="/" className="inline-flex items-center gap-2 mb-8" aria-label="Helixon home">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
        </a>

        <div key={state} style={{ animation: `panelIn 0.35s ${EASE}` }}>
          <VerifyRing state={state === "expired" ? "error" : state} />

          <h1 className="text-lg font-semibold tracking-tight mb-1.5" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>{copy.title}</h1>
          <p className="text-[13px] leading-relaxed mb-6" style={{ color: "#5a7a6a" }}>{copy.body}</p>

          {(state === "expired" || state === "error") && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || resent || !email}
                title={!email ? "This link is missing the email address needed to resend" : undefined}
                className="w-full text-white font-semibold py-3 rounded-[12px] text-sm transition-all flex items-center justify-center gap-2"
                style={{ background: resending || resent || !email ? "#b0c4ba" : "var(--forest)", cursor: resending || resent || !email ? "not-allowed" : "pointer", boxShadow: resending || resent || !email ? "none" : "0 12px 24px -10px rgba(11,58,42,0.5)" }}
                onMouseEnter={(e) => { if (!resending && !resent && email) e.currentTarget.style.background = "var(--forest-deep)"; }}
                onMouseOut={(e) => { if (!resending && !resent && email) e.currentTarget.style.background = "var(--forest)"; }}
              >
                {resending ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Sending…
                  </>
                ) : resent ? "New link sent - check your inbox" : !email ? "Go to sign in to resend" : "Resend verification email"}
              </button>
              <a href="/login" className="block text-[13px] font-medium hover:underline" style={{ color: "var(--forest)" }}>Back to sign in</a>
            </div>
          )}

          {state === "success" && (
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full" style={{ background: "var(--forest)", animation: `fillBar 1.8s ${EASE} forwards` }} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes panelIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes checkIn { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fillBar { from { width: 0%; } to { width: 100%; } }
        @keyframes driftA { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-30px, 25px) scale(1.08); } }
        @keyframes driftB { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(25px, -20px) scale(1.05); } }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; } }
      `}</style>
    </main>
  );
}

// ── Default export - wraps the content in Suspense, required by Next.js
//    App Router whenever a page reads useSearchParams(). ────────────────
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}