"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import Logo from "@/components/marketing/Logo";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// What happens after "Request demo". Saying it up front takes the
// uncertainty (and the fear of a hard sell) out of handing over an email.
// Each line matches a promise made elsewhere: the reply window is the one
// on the success screen, and "your own CVs" / "no obligation" are what the
// homepage and /pricing say a demo is.
const NEXT_STEPS = [
  { title: "We reply within one business day", body: "Someone from our team emails you to find a time that suits." },
  { title: "We run it on your own CVs", body: "Bring a live role and a few CVs, and see the ranked shortlist and the reasoning behind each score." },
  { title: "You decide, no obligation", body: "Ask anything about pricing, your team or data handling. No pressure to sign up on the call." },
];

function FloatField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  inputRef,
  textarea = false,
  required = true,
}) {
  const [focused, setFocused] = useState(false);

  const active = focused || value.length > 0;

  const Tag = textarea ? "textarea" : "input";

  return (
    <div className="mb-3.5">
      <div
        className="relative rounded-[12px]"
        style={{
          border: `1.5px solid ${error ? "rgba(192,57,43,0.6)" : focused ? "var(--forest)" : "var(--border)"}`,
          boxShadow: focused ? "0 0 0 4px var(--mint)" : "none",
          transition: `all 0.2s ${EASE}`,
        }}
      >
        <label
          htmlFor={id}
          className="absolute left-3.5 select-none pointer-events-none transition-all"
          style={{
            top: active ? "7px" : textarea ? "14px" : "50%",
            transform: active || textarea ? "translateY(0)" : "translateY(-50%)",
            fontSize: active ? "10px" : "13.5px",
            fontWeight: active ? 600 : 400,
            letterSpacing: active ? "0.03em" : "0",
            color: error ? "var(--score-low)" : active ? "var(--forest)" : "var(--ink-faint)",
            textTransform: active ? "uppercase" : "none",
            transitionTimingFunction: EASE,
            transitionDuration: "0.2s",
          }}
        >
          {label}
        </label>

        <Tag
          ref={inputRef}
          id={id}
          type={!textarea ? type : undefined}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          required={required}
          rows={textarea ? 4 : undefined}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full bg-transparent text-sm outline-none resize-none"
          style={{
            color: "var(--ink)",
            padding: active ? "22px 14px 8px" : "14px",
            transition: `padding 0.2s ${EASE}`,
          }}
        />
      </div>
      {/* Errors sit under the field they belong to, so the visitor sees
          what to fix without hunting, and a screen reader announces it
          with the field (via aria-describedby above). */}
      {error && (
        <p id={`${id}-error`} className="text-[12px] mt-1.5 ml-1" style={{ color: "var(--score-low)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function CheckIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function DemoRequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const successRef = useRef(null);

  // Focus the first field only with a mouse/trackpad. On a phone it threw
  // the keyboard up over the page before the visitor had read what the
  // form was for.
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) nameRef.current?.focus();
  }, []);

  // Move focus to the confirmation so keyboard and screen-reader users
  // land on it rather than on a button that no longer exists.
  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);

  function clearFieldError(key) {
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: "" }));
    if (error) setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    const nextErrors = {};
    if (!name.trim()) nextErrors.name = "Let us know your name.";
    if (!EMAIL_RE.test(email.trim())) nextErrors.email = "Enter a valid work email address.";
    setFieldErrors(nextErrors);
    if (nextErrors.name) {
      nameRef.current?.focus();
      return;
    }
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams(window.location.search);

      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          message: message.trim(),

          utm_source: params.get("utm_source"),
          utm_medium: params.get("utm_medium"),
          utm_campaign: params.get("utm_campaign"),
          utm_term: params.get("utm_term"),
          utm_content: params.get("utm_content"),

          referrer: document.referrer || null,
        }),
      });

      let data = null;

      try {
        data = await res.json();
      } catch {
        // Ignore invalid JSON responses.
      }

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }

      if (posthog.__loaded) {
        posthog.capture("demo_request_submitted");
      }
      setSuccess(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--mist)" }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      {/* Deliberately a stripped-down nav: this is the page the whole site
          funnels to, so it offers no detours away from the form. */}
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }} aria-label="Main">
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Logo showTagline />
          <Link href="/login" className="inline-flex items-center min-h-[44px] text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
            Login
          </Link>
        </div>
      </nav>

      <main id="main-content" className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(600px circle at 50% 0%, rgba(11,110,79,0.08), transparent 60%)" }}
          />

          <div className="relative w-full max-w-[1000px] grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-10 lg:gap-14 items-center">
            {/* What the visitor gets for their email address. On phones it
                follows the form so the form stays above the fold. */}
            <section aria-labelledby="demo-expect" className="order-2 lg:order-1">
              <h2
                id="demo-expect"
                className="text-[11px] font-semibold uppercase tracking-widest mb-5"
                style={{ color: "var(--ink-faint)" }}
              >
                What happens next
              </h2>
              <ol className="space-y-5">
                {NEXT_STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{ background: "var(--mint)", color: "var(--forest)" }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{step.title}</span>
                      <span className="block text-sm leading-relaxed mt-0.5" style={{ color: "var(--ink-soft)" }}>{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <ul className="flex flex-wrap gap-2 mt-8">
                {["Swiss-hosted", "GDPR-ready", "Never used to train AI"].map((chip) => (
                  <li key={chip} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full" style={{ background: "white", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>
                    <CheckIcon size={12} />
                    {chip}
                  </li>
                ))}
              </ul>
            </section>

            <div className="order-1 lg:order-2 w-full max-w-[480px] mx-auto">
              <div
                className="rounded-[22px] p-8 sm:p-10"
                style={{
                  background: "white",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-raise, 0 20px 40px -20px rgba(19,32,27,0.18))",
                }}
              >
                {success ? (
                  <div className="text-center py-6">
                    <div className="mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "var(--mint)" }}>
                      <CheckIcon size={26} />
                    </div>

                    <h1
                      ref={successRef}
                      tabIndex={-1}
                      className="text-[1.5rem] font-semibold tracking-tight mb-2 outline-none"
                      style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
                    >
                      Request sent
                    </h1>

                    <p className="text-[13.5px] leading-relaxed mb-6" style={{ color: "var(--ink-soft)" }}>
                      Thanks, {name.trim().split(" ")[0]}. Someone from our team will reach out to {email.trim()} within
                      one business day to find a time.
                    </p>

                    {/* Keep the momentum: something useful to look at while
                        they wait, rather than a dead end. */}
                    <div className="flex flex-col gap-2.5">
                      <Link
                        href="/#example"
                        className="btn-forest inline-flex items-center justify-center gap-2 w-full text-white font-semibold py-3 rounded-[12px] text-sm min-h-[44px]"
                        style={{ background: "var(--forest)" }}
                      >
                        See an example analysis
                      </Link>
                      <Link href="/" className="inline-flex items-center justify-center min-h-[44px] text-xs font-medium hover:underline" style={{ color: "var(--forest)" }}>
                        Back to home
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1
                      className="text-[1.6rem] sm:text-[1.8rem] font-semibold tracking-tight leading-[1.1] mb-2"
                      style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
                    >
                      See Helixon on your own CVs
                    </h1>

                    <p className="text-[13.5px] leading-relaxed mb-7" style={{ color: "var(--ink-soft)" }}>
                      Tell us a bit about your team. We&apos;ll reply within one business day and walk you
                      through how Helixon fits your screening process.
                    </p>

                    {error && (
                      <div
                        role="alert"
                        className="mb-4 flex items-start gap-2.5 p-3 rounded-[10px]"
                        style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
                      >
                        <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--score-low)" strokeWidth={2} aria-hidden="true">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                          />
                        </svg>
                        <p className="text-[13px]" style={{ color: "var(--score-low)" }}>{error}</p>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate>
                      <FloatField
                        id="demo-name"
                        label="Full name"
                        value={name}
                        inputRef={nameRef}
                        error={fieldErrors.name}
                        onChange={(e) => {
                          setName(e.target.value);
                          clearFieldError("name");
                        }}
                        autoComplete="name"
                      />

                      <FloatField
                        id="demo-email"
                        label="Work email"
                        type="email"
                        value={email}
                        inputRef={emailRef}
                        error={fieldErrors.email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          clearFieldError("email");
                        }}
                        autoComplete="email"
                      />

                      <FloatField
                        id="demo-company"
                        label="Company (optional)"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        autoComplete="organization"
                        required={false}
                      />

                      <FloatField
                        id="demo-message"
                        label="What are you hoping to solve? (optional)"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required={false}
                        textarea
                      />

                      <button
                        type="submit"
                        disabled={loading}
                        aria-busy={loading}
                        className="btn-forest w-full text-white font-semibold py-3.5 rounded-[12px] text-sm transition-all flex items-center justify-center gap-2 mt-2 min-h-[48px]"
                        style={{
                          background: "var(--forest)",
                          boxShadow: loading ? "none" : "0 12px 24px -10px rgba(11,58,42,0.5)",
                          cursor: loading ? "wait" : "pointer",
                          opacity: loading ? 0.8 : 1,
                        }}
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Sending…
                          </>
                        ) : (
                          <>
                            Request demo
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <path d="M5 12h14M13 6l6 6-6 6" />
                            </svg>
                          </>
                        )}
                      </button>

                      <p className="text-[11px] leading-relaxed text-center mt-3" style={{ color: "var(--ink-faint)" }}>
                        We&apos;ll use these details to arrange your demo. See our{" "}
                        <Link href="/privacy" className="underline">privacy policy</Link>.
                      </p>
                    </form>
                  </>
                )}
              </div>

              <p className="text-center text-xs mt-6" style={{ color: "var(--ink-faint)" }}>
                Ready to start now?{" "}
                <Link href="/pricing" className="font-semibold hover:underline" style={{ color: "var(--forest)" }}>
                  View plans
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
            © {new Date().getFullYear()} Helixon. AI CV screening for recruitment agencies.
          </span>
          <Link href="/privacy" className="text-[11px] hover:underline" style={{ color: "var(--ink-faint)" }}>
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
