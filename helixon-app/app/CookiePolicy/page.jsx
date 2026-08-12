"use client";
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon — Cookie policy.
// Same legal-page shell as the DPA (nav/footer/type), but lighter weight —
// no sticky TOC needed at this length. Signature element: a cookie-category
// table that mirrors the actual categories set, not a generic prose wall.
// ═══════════════════════════════════════════════════════════════════════════

const COOKIE_CATEGORIES = [
  {
    name: "Strictly necessary",
    required: true,
    purpose: "Keep you signed in, remember your session, and protect against cross-site request forgery.",
    examples: "session_id, csrf_token",
    duration: "Session / 30 days",
  },
  {
    name: "Preferences",
    required: false,
    purpose: "Remember display settings, such as which columns you last showed in your analysis history.",
    examples: "ui_prefs",
    duration: "1 year",
  },
  {
    name: "Analytics",
    required: false,
    purpose: "Understand how the product is used, in aggregate, so we can improve it. No data is sold or shared for advertising.",
    examples: "_ph_id (PostHog, EU-hosted)",
    duration: "1 year",
  },
];

function ToggleRow({ category }) {
  const [on, setOn] = useState(category.required ? true : true);
  return (
    <div className="rounded-[12px] border p-5" style={{ borderColor: "var(--border)", background: "white" }}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="text-[13px] font-semibold" style={{ color: "#13201b" }}>{category.name}</h3>
          {category.required && (
            <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>
              Always on
            </span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={category.required}
          onClick={() => setOn((v) => !v)}
          className="shrink-0 w-10 h-6 rounded-full relative transition-colors"
          style={{ background: on ? "var(--forest)" : "var(--border)", opacity: category.required ? 0.6 : 1, cursor: category.required ? "not-allowed" : "pointer" }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
            style={{ transform: on ? "translateX(18px)" : "translateX(2px)" }}
          />
        </button>
      </div>
      <p className="text-[12px] leading-relaxed mb-3" style={{ color: "#5a7a6a" }}>{category.purpose}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px]" style={{ color: "#8aaa9a" }}>
        <span><strong style={{ color: "#5a7a6a" }}>Examples:</strong> {category.examples}</span>
        <span><strong style={{ color: "#5a7a6a" }}>Duration:</strong> {category.duration}</span>
      </div>
    </div>
  );
}

export default function CookiePolicyPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <main
      className="min-h-screen"
      style={{
        background: "var(--mist)",
        "--forest": "#0b6e4f",
        "--forest-deep": "#085a41",
        "--mint": "#e3f0e9",
        "--mist": "#f6f8f6",
        "--border": "#dde6e1",
        "--signal": "#f59e0b",
        "--font-display": "'Fraunces', Georgia, serif",
        "--font-mono": "'IBM Plex Mono', monospace",
      }}
    >
      {/* ── Nav (shared shell) ──────────────────────────────────────────── */}
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
            <a href="/#how" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>How it works</a>
            <a href="/#pricing" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Pricing</a>
            <a href="/login" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Login</a>
          </div>

          <div className="flex items-center gap-2">
            <a href="/" className="text-xs font-semibold px-4 py-1.5 rounded-[10px] transition-colors text-white hidden sm:block" style={{ background: "var(--forest)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-deep)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}>
              Try now
            </a>
            <button type="button" onClick={() => setMobileNavOpen((v) => !v)} aria-expanded={mobileNavOpen} aria-label="Open menu"
              className="sm:hidden w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ color: "#13201b" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
              </svg>
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="sm:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
            {[["How it works", "/#how"], ["Pricing", "/#pricing"], ["Login", "/login"]].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>{label}</a>
            ))}
          </div>
        )}
      </nav>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 pt-14 pb-10">
          <p className="text-[11px] font-medium mb-3" style={{ color: "#8aaa9a" }}>
            <a href="/" className="hover:underline">Helixon</a> <span className="mx-1">/</span> Legal
          </p>
          <h1 className="text-3xl sm:text-[38px] font-semibold tracking-tight leading-tight mb-4" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            Cookie Policy
          </h1>
          <p className="text-sm leading-relaxed max-w-xl" style={{ color: "#5a7a6a" }}>
            This explains what cookies Helixon sets, why, and how to control them. It applies to helixon.io and
            the Helixon app.
          </p>
          <p className="text-[11px] mt-5" style={{ color: "#5a7a6a" }}>
            <strong style={{ color: "#13201b" }}>Effective:</strong> 1 August 2026
          </p>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="max-w-[680px] mx-auto px-6 py-14">

        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-3" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            What are cookies?
          </h2>
          <p className="text-[13px] leading-relaxed" style={{ color: "#4a6357" }}>
            Cookies are small text files stored on your device when you visit a website. We use them, and similar
            technologies like local storage, to keep you signed in, remember your preferences, and understand how
            the product is used so we can improve it.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            Cookie categories
          </h2>
          <div className="space-y-3">
            {COOKIE_CATEGORIES.map((c) => (
              <ToggleRow key={c.name} category={c} />
            ))}
          </div>
          <p className="text-[11px] mt-3" style={{ color: "#8aaa9a" }}>
            Toggles above are illustrative — manage your live preferences any time from the cookie settings link in
            the site footer.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-3" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            Third-party cookies
          </h2>
          <p className="text-[13px] leading-relaxed" style={{ color: "#4a6357" }}>
            We do not use third-party advertising cookies, and we do not allow ad networks to track visitors across
            Helixon. Our analytics provider is EU-hosted and configured not to sell or share data with third
            parties.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-3" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            Managing cookies in your browser
          </h2>
          <p className="text-[13px] leading-relaxed mb-3" style={{ color: "#4a6357" }}>
            Most browsers let you block or delete cookies through their settings. Note that blocking strictly
            necessary cookies will prevent you from staying signed in to Helixon.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[13px]" style={{ color: "#4a6357" }}>
            <li>Chrome: Settings → Privacy and security → Cookies</li>
            <li>Safari: Settings → Privacy → Manage Website Data</li>
            <li>Firefox: Settings → Privacy & Security → Cookies and Site Data</li>
          </ul>
        </section>

        <section className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight mb-3" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            Changes to this policy
          </h2>
          <p className="text-[13px] leading-relaxed" style={{ color: "#4a6357" }}>
            We'll update this page if the cookies we use change, and update the effective date above. For material
            changes, we'll show a notice on your next visit.
          </p>
        </section>

        <div className="pt-6 mt-6 border-t text-[12px]" style={{ borderColor: "var(--border)", color: "#8aaa9a" }}>
          Questions about cookies? Contact <a href="mailto:privacy@helixon.io" className="font-semibold" style={{ color: "var(--forest)" }}>privacy@helixon.io</a>.
        </div>
      </div>

      {/* ── Footer (shared shell) ───────────────────────────────────────── */}
      <footer className="border-t bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px]" style={{ color: "#8aaa9a" }}>© {new Date().getFullYear()} Helixon. Screen candidates in seconds.</span>
          <div className="flex gap-4 text-[11px]" style={{ color: "#8aaa9a" }}>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/dpa">DPA</a>
            <a href="/cookies" style={{ color: "var(--forest)", fontWeight: 600 }}>Cookies</a>
            <a href="/login">Login</a>
          </div>
        </div>
      </footer>
    </main>
  );
}