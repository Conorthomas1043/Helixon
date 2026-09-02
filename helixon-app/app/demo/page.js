"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FloatField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  textarea = false,
  required = true,
}) {
  const [focused, setFocused] = useState(false);

  const active = focused || value.length > 0;

  const Tag = textarea ? "textarea" : "input";

  return (
    <div
      className="relative rounded-[12px] mb-3.5"
      style={{
        border: `1.5px solid ${
          error
            ? "rgba(192,57,43,0.5)"
            : focused
              ? "var(--forest)"
              : "var(--border)"
        }`,
        boxShadow: focused
          ? "0 0 0 4px var(--mint)"
          : "none",
        transition: `all 0.2s ${EASE}`,
      }}
    >
      <label
        htmlFor={id}
        className="absolute left-3.5 select-none pointer-events-none transition-all"
        style={{
          top: active
            ? "7px"
            : textarea
              ? "14px"
              : "50%",
          transform:
            active || textarea
              ? "translateY(0)"
              : "translateY(-50%)",
          fontSize: active ? "10px" : "13.5px",
          fontWeight: active ? 600 : 400,
          letterSpacing: active ? "0.03em" : "0",
          color: active
            ? "var(--forest)"
            : "var(--ink-faint)",
          textTransform: active
            ? "uppercase"
            : "none",
          transitionTimingFunction: EASE,
          transitionDuration: "0.2s",
        }}
      >
        {label}
      </label>

      <Tag
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
        aria-describedby={
          error ? `${id}-error` : undefined
        }
        className="w-full bg-transparent text-sm outline-none resize-none"
        style={{
          color: "var(--ink)",
          padding: active
            ? "22px 14px 8px"
            : "14px",
          transition: `padding 0.2s ${EASE}`,
        }}
      />
    </div>
  );
}

export default function DemoRequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    if (!name.trim()) {
      setError("Let us know your name.");
      return;
    }

    if (!EMAIL_RE.test(email.trim())) {
      setError(
        "Enter a valid work email address."
      );
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams(
        window.location.search
      );

      const res = await fetch(
        "/api/demo-request",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            company: company.trim(),
            message: message.trim(),

            utm_source:
              params.get("utm_source"),
            utm_medium:
              params.get("utm_medium"),
            utm_campaign:
              params.get("utm_campaign"),
            utm_term:
              params.get("utm_term"),
            utm_content:
              params.get("utm_content"),

            referrer:
              document.referrer || null,
          }),
        }
      );

      let data = null;

      try {
        data = await res.json();
      } catch {
        // Ignore invalid JSON responses.
      }

      if (!res.ok || !data?.ok) {
        setError(
          data?.error ||
            "Something went wrong. Please try again."
        );
        return;
      }

      setSuccess(true);
    } catch {
      setError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{
        background: "var(--mist)",
      }}
    >
      {/* Navigation */}
      <nav
        className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b"
        style={{
          borderColor: "var(--border)",
        }}
        aria-label="Main"
      >
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 group"
            aria-label="Helixon home"
          >
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105"
              style={{
                background:
                  "var(--forest)",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 28 28"
                fill="none"
                aria-hidden="true"
              >
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
                  fill="var(--signal)"
                />
              </svg>
            </div>

            <span className="flex flex-col leading-none">
              <span
                className="text-sm font-semibold tracking-tight"
                style={{
                  color: "var(--ink)",
                  fontFamily:
                    "var(--font-display)",
                }}
              >
                Helixon
              </span>

              <span
                className="hidden sm:block text-[9px] font-medium mt-0.5"
                style={{
                  color:
                    "var(--ink-faint)",
                }}
              >
                Screen candidates in seconds
              </span>
            </span>
          </Link>

          <Link
            href="/login"
            className="text-xs font-medium"
            style={{
              color: "var(--ink-soft)",
            }}
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-16 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px circle at 50% 0%, rgba(11,110,79,0.08), transparent 60%)",
          }}
        />

        <div className="relative w-full max-w-[480px]">
          <div
            className="rounded-[22px] p-8 sm:p-10"
            style={{
              background: "white",
              border:
                "1px solid var(--border)",
              boxShadow:
                "var(--shadow-raise, 0 20px 40px -20px rgba(19,32,27,0.18))",
            }}
          >
            {success ? (
              <div className="text-center py-6">
                <div
                  className="mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      "var(--mint)",
                  }}
                >
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--forest)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>

                <h1
                  className="text-[1.5rem] font-semibold tracking-tight mb-2"
                  style={{
                    color: "var(--ink)",
                    fontFamily:
                      "var(--font-display)",
                  }}
                >
                  Request sent
                </h1>

                <p
                  className="text-[13.5px] leading-relaxed mb-8"
                  style={{
                    color: "var(--ink-soft)",
                  }}
                >
                  Thanks,{" "}
                  {name.split(" ")[0]}.
                  {" "}
                  Someone from our team will
                  reach out to{" "}
                  {email} within one business
                  day to find a time.
                </p>

                <Link
                  href="/"
                  className="text-xs font-medium hover:underline"
                  style={{
                    color: "var(--forest)",
                  }}
                >
                  ← Back to home
                </Link>
              </div>
            ) : (
              <>
                <div
                  className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-5"
                  style={{
                    background:
                      "var(--mint)",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--forest)"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                  </svg>
                </div>

                <h1
                  className="text-[1.6rem] sm:text-[1.8rem] font-semibold tracking-tight leading-[1.1] mb-2"
                  style={{
                    color: "var(--ink)",
                    fontFamily:
                      "var(--font-display)",
                  }}
                >
                  Get a demo
                </h1>

                <p
                  className="text-[13.5px] leading-relaxed mb-7"
                  style={{
                    color: "var(--ink-soft)",
                  }}
                >
                  Tell us a bit about your team
                  and we&apos;ll walk you through
                  how Helixon fits into your
                  screening process.
                </p>

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="mb-4 flex items-start gap-2.5 p-3 rounded-[10px]"
                    style={{
                      background: "#fef2f2",
                      border:
                        "1px solid #fecaca",
                    }}
                  >
                    <svg
                      className="mt-0.5 shrink-0"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--score-low)"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                      />
                    </svg>

                    <p
                      id="demo-error"
                      className="text-[13px]"
                      style={{
                        color:
                          "var(--score-low)",
                      }}
                    >
                      {error}
                    </p>
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  noValidate
                >
                  <FloatField
                    id="demo-name"
                    label="Full name"
                    value={name}
                    onChange={(e) => {
                      setName(
                        e.target.value
                      );

                      if (error) {
                        setError("");
                      }
                    }}
                    autoComplete="name"
                  />

                  <FloatField
                    id="demo-email"
                    label="Work email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(
                        e.target.value
                      );

                      if (error) {
                        setError("");
                      }
                    }}
                    autoComplete="email"
                  />

                  <FloatField
                    id="demo-company"
                    label="Company (optional)"
                    value={company}
                    onChange={(e) =>
                      setCompany(
                        e.target.value
                      )
                    }
                    autoComplete="organization"
                    required={false}
                  />

                  <FloatField
                    id="demo-message"
                    label="What are you hoping to solve? (optional)"
                    value={message}
                    onChange={(e) =>
                      setMessage(
                        e.target.value
                      )
                    }
                    required={false}
                    textarea
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    className="btn-forest w-full text-white font-semibold py-3.5 rounded-[12px] text-sm transition-all flex items-center justify-center gap-2 mt-2"
                    style={{
                      background: loading
                        ? "var(--ink-mute)"
                        : "var(--forest)",

                      boxShadow: loading
                        ? "none"
                        : "0 12px 24px -10px rgba(11,58,42,0.5)",

                      cursor: loading
                        ? "not-allowed"
                        : "pointer",

                      opacity: loading
                        ? 0.85
                        : 1,
                    }}
                  >
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin"
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />

                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>

                        Sending…
                      </>
                    ) : (
                      <>
                        Request demo

                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          <p
            className="text-center text-[11px] mt-6"
            style={{
              color: "var(--ink-mute)",
            }}
          >
            Ready to use Helixon?{" "}
            <Link
              href="/signup"
              className="font-medium hover:underline"
              style={{
                color: "var(--ink-faint)",
              }}
            >
              Create your account
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="border-t"
        style={{
          borderColor:
            "var(--border)",
        }}
      >
        <div className="max-w-[1100px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span
            className="text-[11px]"
            style={{
              color:
                "var(--ink-faint)",
            }}
          >
            © {new Date().getFullYear()}{" "}
            Helixon. Screen candidates in
            seconds.
          </span>

          <Link
            href="/login"
            className="text-[11px] hover:underline"
            style={{
              color:
                "var(--ink-faint)",
            }}
          >
            Login
          </Link>
        </div>
      </footer>
    </main>
  );
}