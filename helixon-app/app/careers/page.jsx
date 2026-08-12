"use client";
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Careers — culture blurb, benefits, and open roles. Same nav/footer/tokens
// as the rest of the marketing site.
// ═══════════════════════════════════════════════════════════════════════════

function MarketingNav() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const links = [["How it works", "/how-it-works"], ["FAQ", "/faq"], ["Blog", "/blog"], ["Careers", "/careers"], ["Contact", "/contact"], ["Login", "/login"]];
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
          {links.map(([label, href]) => (
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
          {links.map(([label, href]) => (
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
          <a href="/complaints-policy">Complaints</a>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </div>
    </footer>
  );
}

const VALUES = [
  { title: "Built by recruiters, for recruiters", body: "Half the team has agency experience. We build what we'd actually want to use on a Monday morning with 40 CVs in the inbox.", icon: <><circle cx="9" cy="8" r="3" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 8.5a3 3 0 110 6" /><path d="M17.5 14.5c2.5.5 4 2 4 5.5" /></> },
  { title: "Small team, real ownership", body: "You'll ship things that agencies use the same week, not the same quarter. Everyone here works close to the product.", icon: <><path d="M12 2l2.6 6.2L21 9l-5 4.5L17.4 21 12 17.6 6.6 21 8 13.5 3 9l6.4-.8z" /></> },
  { title: "Remote-first, UK-based core", body: "We're distributed across the UK with a London office for anyone who wants a desk. Async by default, no unnecessary meetings.", icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></> },
];

const BENEFITS = [
  "25 days holiday + bank holidays",
  "Flexible, remote-first working",
  "Private health cover",
  "Learning & conference budget",
  "Latest MacBook, your choice of setup",
  "Company equity",
];

const ROLES = [
  { title: "Senior Full-Stack Engineer", team: "Engineering", location: "Remote (UK)", type: "Full-time" },
  { title: "Product Designer", team: "Design", location: "Remote (UK) / London", type: "Full-time" },
  { title: "Customer Success Manager", team: "Customer Success", location: "London", type: "Full-time" },
  { title: "Growth Marketer", team: "Marketing", location: "Remote (UK)", type: "Full-time" },
];

export default function CareersPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-16 text-center">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "var(--mint)", color: "var(--forest)" }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          We're hiring — {ROLES.length} open roles
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5 max-w-xl mx-auto" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Help agencies hire better.
        </h1>
        <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "#5a7a6a" }}>
          We're a small remote-first team building screening tools recruiters actually want to use. Come build it with us.
        </p>
      </section>

      {/* ── Values ───────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-[14px] p-6" style={{ background: "white", border: "1px solid var(--border)" }}>
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-4" style={{ background: "var(--mint)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{v.icon}</svg>
              </div>
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>{v.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#5a7a6a" }}>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="rounded-[16px] p-8" style={{ background: "var(--forest)" }}>
          <h2 className="text-lg font-semibold mb-5 text-white" style={{ fontFamily: "var(--font-display)" }}>What you get</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-center gap-2.5 text-sm" style={{ color: "rgba(255,255,255,0.92)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
                  <path d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Open roles ───────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-24">
        <div className="text-center mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Open roles</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            Come build with us
          </h2>
        </div>

        <div className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 12px 24px -18px rgba(19,32,27,0.25)" }}>
          {ROLES.map((role, i) => (
            <a
              key={role.title}
              href="/contact"
              className="flex items-center justify-between gap-4 px-6 py-5 transition-colors"
              style={{ borderBottom: i < ROLES.length - 1 ? "1px solid var(--border)" : "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mist)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div className="min-w-0">
                <h3 className="text-sm font-semibold mb-1" style={{ color: "#13201b" }}>{role.title}</h3>
                <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: "#8aaa9a" }}>
                  <span>{role.team}</span>
                  <span>·</span>
                  <span>{role.location}</span>
                  <span>·</span>
                  <span>{role.type}</span>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          ))}
        </div>

        <p className="text-xs text-center mt-6" style={{ color: "#8aaa9a" }}>
          Don't see the right role? <a href="/contact" style={{ color: "var(--forest)", fontWeight: 600 }}>Get in touch anyway</a> — we're always open to meeting good people.
        </p>
      </section>

      <Footer />
    </main>
  );
}