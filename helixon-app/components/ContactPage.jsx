"use client";
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Contact - simple form + direct channels, same nav/footer/tokens as landing.
// ═══════════════════════════════════════════════════════════════════════════

function MarketingNav() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
            <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "#8aaa9a" }}>Screen candidates in seconds</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-1 text-xs font-medium" style={{ color: "#5a7a6a" }}>
          {[["How it works", "/how-it-works"], ["FAQ", "/faq"], ["Pricing", "/#pricing"], ["Contact", "/contact"], ["Login", "/login"]].map(([label, href]) => (
            <a key={label} href={href} className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{label}</a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a href="/" className="text-xs font-semibold px-4 py-1.5 rounded-[10px] transition-colors text-white hidden sm:block" style={{ background: "var(--forest)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--forest-deep)"} onMouseLeave={e => e.currentTarget.style.background = "var(--forest)"}>
            Try now
          </a>
          <button type="button" onClick={() => setMobileNavOpen(v => !v)} aria-expanded={mobileNavOpen} aria-label="Open menu"
            className="md:hidden w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ color: "#13201b" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
            </svg>
          </button>
        </div>
      </div>
      {mobileNavOpen && (
        <div className="md:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
          {[["How it works", "/how-it-works"], ["FAQ", "/faq"], ["Pricing", "/#pricing"], ["Contact", "/contact"], ["Login", "/login"]].map(([label, href]) => (
            <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>{label}</a>
          ))}
          <a href="/" onClick={() => setMobileNavOpen(false)} className="text-xs font-semibold px-2.5 py-2.5 rounded-[10px] mt-1 text-white text-center" style={{ background: "var(--forest)" }}>Try now</a>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-[11px]" style={{ color: "#8aaa9a" }}>© {new Date().getFullYear()} Helixon. Screen candidates in seconds.</span>
        <div className="flex gap-4 text-[11px]" style={{ color: "#8aaa9a" }}>
          <a href="/how-it-works">How it works</a>
          <a href="/faq">FAQ</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/login">Login</a>
        </div>
      </div>
    </footer>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "0.875rem",
  color: "#13201b",
  background: "white",
};

function inputFocus(e) {
  e.currentTarget.style.borderColor = "var(--forest)";
  e.currentTarget.style.boxShadow = "0 0 0 3px var(--mint)";
}
function inputBlur(e) {
  e.currentTarget.style.borderColor = "var(--border)";
  e.currentTarget.style.boxShadow = "none";
}

const CHANNELS = [
  {
    title: "Sales & pricing",
    body: "Questions about Team plans, invoicing, or multi-seat access.",
    icon: <><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></>,
    email: "sales@helixon.co.uk",
  },
  {
    title: "Support",
    body: "Something not working, or a question about an existing analysis.",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 16.5h.01" /></>,
    email: "support@helixon.co.uk",
  },
  {
    title: "Everything else",
    body: "Partnerships, press, or anything that doesn't fit above.",
    icon: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    email: "hello@helixon.co.uk",
  },
];

// Topic select - value IS the destination inbox, so the form and the API
// route (TOPIC_ROUTING) always agree with no separate label-to-email mapping.
const TOPICS = [
  "support@helixon.co.uk",
  "sales@helixon.co.uk",
  "hello@helixon.co.uk",
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Couldn't send your message.");
      }
      setSent(true);
    } catch (err) {
      setError(err.message || "Couldn't send your message - please try again, or email us directly below.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <MarketingNav />

      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-12 text-center">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "var(--mint)", color: "var(--forest)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
          We usually reply within a day
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5 max-w-xl mx-auto" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Get in touch.
        </h1>
        <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "#5a7a6a" }}>
          Whether it's a question before you sign up or something on an existing account, we're happy to help.
        </p>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6">

          {/* ── Channels ──────────────────────────────────────────────── */}
          <div className="space-y-4">
            {CHANNELS.map((c) => (
              <div key={c.title} className="rounded-[14px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "var(--mint)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold mb-1" style={{ color: "#13201b" }}>{c.title}</h3>
                    <p className="text-xs leading-relaxed mb-2" style={{ color: "#5a7a6a" }}>{c.body}</p>
                    <a href={`mailto:${c.email}`} className="text-xs font-semibold" style={{ color: "var(--forest)" }}>{c.email}</a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Form ──────────────────────────────────────────────────── */}
          <div className="rounded-[16px] p-7" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 12px 24px -18px rgba(19,32,27,0.25)" }}>
            {sent ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-[12px] flex items-center justify-center mx-auto mb-4" style={{ background: "var(--mint)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round"><path d="M4.5 12.75l6 6 9-13.5" /></svg>
                </div>
                <h2 className="font-semibold mb-1.5" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Message sent</h2>
                <p className="text-sm max-w-xs mx-auto" style={{ color: "#5a7a6a" }}>
                  Thanks - we'll get back to you at {email || "your email"} shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-sm font-semibold mb-1" style={{ color: "#13201b" }}>Send us a message</h2>

                {error && (
                  <div role="alert" className="flex items-start gap-2.5 p-3 rounded-[10px]" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                    <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-xs font-semibold mb-1.5" style={{ color: "#13201b" }}>Name</label>
                    <input id="name" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} className="focus:outline-none transition-shadow" onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold mb-1.5" style={{ color: "#13201b" }}>Email</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} className="focus:outline-none transition-shadow" onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                </div>

                <div>
                  <label htmlFor="topic" className="block text-xs font-semibold mb-1.5" style={{ color: "#13201b" }}>Topic</label>
                  <div className="relative">
                    <select
                      id="topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      style={{ ...inputStyle, appearance: "none", paddingRight: "36px", cursor: "pointer" }}
                      className="focus:outline-none transition-shadow"
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    >
                      {TOPICS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a7a6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ right: "14px" }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs font-semibold mb-1.5" style={{ color: "#13201b" }}>Message</label>
                  <textarea
                    id="message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required
                    style={{ ...inputStyle, resize: "vertical" }} className="focus:outline-none transition-shadow"
                    onFocus={inputFocus} onBlur={inputBlur}
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="text-sm font-semibold px-5 py-3 rounded-[10px] text-white transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
                  style={{ background: "var(--forest)", boxShadow: "0 8px 20px -8px rgba(11,110,79,0.5)" }}
                  onMouseEnter={(e) => { if (!sending) e.currentTarget.style.background = "var(--forest-deep)"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}
                >
                  {sending ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>

        </div>
      </section>

      <Footer />
    </main>
  );
}