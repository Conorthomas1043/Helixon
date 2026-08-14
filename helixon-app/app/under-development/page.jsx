"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// The password itself lives ONLY server-side now (SITE_GATE_PASSWORD env
// var, checked in app/api/site-gate/route.ts). This component just POSTs
// what the visitor typed and reacts to the server's answer — there's
// nothing to read out of the shipped JS anymore.

function DiggingScene() {
  return (
    <svg
      viewBox="0 0 200 130"
      width="160"
      height="104"
      aria-hidden="true"
      style={{ display: "block", margin: "0 auto 20px" }}
    >
      {/* ground */}
      <ellipse cx="100" cy="112" rx="72" ry="7" fill="var(--border)" opacity="0.6" />
      {/* dirt mound */}
      <path d="M60 112 Q78 92 104 98 Q122 101 118 112 Z" fill="var(--mint)" />

      <g className="dig-figure">
        {/* legs, bent in a digging crouch */}
        <path d="M94 76 L88 108 L98 108 L101 84" fill="var(--forest)" />
        <path d="M101 84 L112 106 L122 106 L107 76" fill="var(--forest)" />

        {/* torso */}
        <path d="M88 50 Q86 66 93 80 L109 80 Q114 65 110 48 Z" fill="var(--forest)" />

        {/* back arm, reaching down to the shovel handle */}
        <path d="M92 54 Q78 62 70 78" stroke="var(--forest)" strokeWidth="7" strokeLinecap="round" fill="none" />
        {/* front arm, gripping higher on the handle */}
        <path d="M106 52 Q92 58 78 68" stroke="var(--forest)" strokeWidth="7" strokeLinecap="round" fill="none" />

        {/* head */}
        <circle cx="100" cy="38" r="12" fill="var(--forest)" />

        {/* hard hat */}
        <path d="M87 34 Q100 18 113 34 Z" fill="var(--gold, #e0a72e)" />
        <rect x="85" y="32" width="30" height="5" rx="2.5" fill="var(--gold, #e0a72e)" />
      </g>

      {/* shovel */}
      <g className="dig-shovel">
        <line x1="70" y1="78" x2="54" y2="118" stroke="var(--ink-soft)" strokeWidth="4" strokeLinecap="round" />
        <path d="M46 112 L62 112 L58 128 Q54 132 50 128 Z" fill="var(--ink-faint)" />
      </g>
    </svg>
  );
}

function GateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("from") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || success) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/site-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        /* ignore */
      }

      if (!res.ok || !data?.ok) {
        setError(data?.error || "That's not it — try again.");
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setPassword("");
        return;
      }

      // Server confirmed the password and set the real (signed, httpOnly)
      // cookie. Now actually leave the gate page.
      setSuccess(true);
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 900);
    } catch {
      setError("Network hiccup. Try again?");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "var(--mist)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at 50% 0%, rgba(11,110,79,0.08), transparent 60%)",
        }}
      />

      {/* A few drifting specks of dust — quiet ambient motion, not a joke. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="drift-dust"
            style={{
              left: `${18 + i * 16}%`,
              animationDelay: `${i * 1.6}s`,
              animationDuration: `${7 + i}s`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-[440px]">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center"
            style={{ background: "var(--forest)" }}
          >
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span
            className="text-base font-semibold tracking-tight"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            Helixon
          </span>
        </div>

        <div
          className="rounded-[22px] p-8 sm:p-10 text-center transition-all duration-500"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.7)",
            boxShadow: "0 50px 100px -30px rgba(11,26,20,0.25)",
            transform: success ? "scale(1.02)" : "scale(1)",
          }}
        >
          {success ? (
            <>
              <div className="mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center pop-in" style={{ background: "var(--mint)" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h1
                className="text-[1.6rem] font-semibold tracking-tight mb-2"
                style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
              >
                You're in
              </h1>
              <p className="text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
                Taking you through now.
              </p>
            </>
          ) : (
            <>
              <DiggingScene />

              <h1
                className="text-[1.7rem] sm:text-3xl font-semibold tracking-tight leading-[1.1] mb-3"
                style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
              >
                Under construction
              </h1>

              <p className="text-[13.5px] leading-relaxed mb-8" style={{ color: "var(--ink-soft)" }}>
                We're making some changes behind the scenes. If you have the password, you can get through now.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div
                  className="relative rounded-[12px] mb-3.5"
                  style={{
                    border: `1.5px solid ${error ? "rgba(192,57,43,0.5)" : "var(--border)"}`,
                    animation: shake ? "shake 0.4s ease" : "none",
                  }}
                >
                  <input
                    ref={inputRef}
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="Password"
                    autoComplete="off"
                    disabled={loading}
                    aria-invalid={error ? "true" : "false"}
                    aria-describedby={error ? "dev-gate-error" : undefined}
                    className="w-full bg-transparent text-sm outline-none px-4 py-3.5 text-center"
                    style={{ color: "var(--ink)" }}
                  />
                </div>

                {error && (
                  <p
                    id="dev-gate-error"
                    role="alert"
                    className="text-[12.5px] mb-4"
                    style={{ color: "var(--score-low)" }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="btn-forest w-full text-white font-semibold py-3.5 rounded-[12px] text-sm transition-all flex items-center justify-center gap-2"
                  style={{
                    background: loading ? "var(--ink-mute)" : "var(--forest)",
                    boxShadow: loading ? "none" : "0 12px 24px -10px rgba(11,58,42,0.5)",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Checking…
                    </>
                  ) : (
                    "Unlock"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: "var(--ink-mute)" }}>
          © {new Date().getFullYear()} Helixon. Screen candidates in seconds.
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
        }
        .pop-in { animation: popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }

        @keyframes driftUp {
          0%   { transform: translateY(100vh); opacity: 0; }
          10%  { opacity: 0.25; }
          90%  { opacity: 0.25; }
          100% { transform: translateY(-5vh); opacity: 0; }
        }
        .drift-dust {
          position: absolute;
          top: 0;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--ink-mute);
          animation-name: driftUp;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes digBob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-3px) rotate(-3deg); }
        }
        .dig-figure {
          transform-origin: 100px 90px;
          animation: digBob 1.6s ease-in-out infinite;
        }
        @keyframes shovelPoke {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-3px, -4px) rotate(-8deg); }
        }
        .dig-shovel {
          transform-origin: 70px 78px;
          animation: shovelPoke 1.6s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .drift-dust, .dig-figure, .dig-shovel { animation: none; display: none; }
          .pop-in { animation: none; }
        }
      `}</style>
    </main>
  );
}

export default function UnderDevelopmentPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <GateForm />
    </Suspense>
  );
}