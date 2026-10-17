// The homepage. A server component: the static sections render to HTML
// with no client JavaScript. The interactive pieces (previews, tabs, FAQ,
// buy buttons, signed-in hero copy) come from home-interactive.jsx.
import Button from "@/components/landing/Button";
import ChatWidget from "@/components/landing/ChatWidget";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import CtaBand from "@/components/marketing/CtaBand";
import AnalysisExample from "@/components/landing/AnalysisExample";
import HeroDemo from "@/components/landing/HeroDemo";
import LandingMotion from "@/components/landing/LandingMotion";
import ScrollStory from "@/components/landing/ScrollStory";
import { PLAN_FEATURES } from "@/lib/billing/plan-features";
import {
  BuyPlanButton,
  DashboardPreview,
  FAQSection,
  HeroActions,
  HeroBadge,
  HeroSubtitle,
  Reveal,
  TrustStrip,
} from "@/components/landing/home-interactive";

/* ── Example analysis - a full report on three very different roles ───── */

function AnalysisExampleSection() {
  return (
    <section id="example" className="max-w-[1100px] mx-auto px-6 py-24">
      <Reveal>
        <div className="text-center mb-10">
          <p className="text-12 font-semibold uppercase tracking-widest mb-3 text-[var(--ink-faint)]">See a real analysis</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 text-[var(--ink)] font-display text-balance">
            Not just a score — the reasons behind it
          </h2>
          <p className="text-16 leading-relaxed max-w-xl mx-auto text-[var(--ink-soft)]">
            Every candidate gets a report like this: how they meet each requirement, the line in their CV that proves it,
            what still needs checking, and what to ask at interview. Warehouse floor or boardroom.
            Helixon helps you decide &mdash; the final call is always yours.
          </p>
        </div>
      </Reveal>
      <Reveal>
        <AnalysisExample />
      </Reveal>
    </section>
  );
}


/* ── How it works: the story from a pile of CVs to a placement, told as
   the visitor scrolls (components/landing/ScrollStory). It replaces a
   "by hand versus with Helixon" comparison and a tabbed workflow preview,
   which told the same story twice. ── */

function StorySection() {
  return (
    <section id="how" className="py-24 bg-[var(--bg)] border-t border-t-[var(--border-soft)] border-b border-b-[var(--border-soft)]">
      <div className="max-w-[1100px] mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14 lg:mb-6">
            <p className="text-12 font-semibold uppercase tracking-widest mb-3 text-[var(--ink-faint)]">How it works</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 text-[var(--ink)] font-display text-balance">
              The bottleneck isn&rsquo;t hiring. It&rsquo;s everything before the shortlist.
            </h2>
            <p className="text-16 leading-relaxed max-w-xl mx-auto text-[var(--ink-soft)]">
              By hand it&rsquo;s open, read, compare, note, repeat, fifty times over. Here&rsquo;s the same job in Helixon.
            </p>
          </div>
        </Reveal>
        <ScrollStory />
      </div>
    </section>
  );
}


/* ── Dashboard section - the "after the screening" half of the product.
   Every other section on this page is about scoring a CV; this is the one
   that shows what the recruiter manages afterwards, and how a team shares
   it. ── */

const DASHBOARD_POINTS = [
  "Every open role, every candidate and every score in one view",
  "Stalled candidates and unreviewed strong matches surfaced automatically",
  "Time to fill, offer acceptance, source of hire and fee income — real agency analytics, not just a candidate list",
  "Notes, tags and shortlists shared across your team, with a full audit trail of who screened what and when",
];

function DashboardSection() {
  return (
    <section id="dashboard" className="py-24 bg-[var(--bg)] border-t border-t-[var(--border-soft)] border-b border-b-[var(--border-soft)]">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-center">
          <Reveal>
            <p className="text-12 font-semibold uppercase tracking-widest mb-3 text-[var(--ink-faint)]">The dashboard</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 text-[var(--ink)] font-display text-balance">
              Screening is the start. This is where the desk gets run.
            </h2>
            <p className="text-16 leading-relaxed mb-6 text-[var(--ink-soft)]">
              Scores are only useful if they turn into placements. Helixon keeps every
              role, candidate and stage in one place, so nothing sits waiting in
              someone&rsquo;s inbox.
            </p>
            <ul className="space-y-3">
              {DASHBOARD_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-16 leading-relaxed text-[var(--ink-soft)]">
                  <svg className="shrink-0 mt-1" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
            <Button as="a" href="/demo" variant="outline" className="mt-7 min-h-[44px]">Get a demo</Button>
          </Reveal>

          <Reveal delay={90}>
            <DashboardPreview />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Features - grouped by recruiter outcome, not by feature name ────────── */

// No compliance group: the trust section above covers it.
const FEATURE_GROUPS = [
  {
    title: "Screen faster",
    icon: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
    body: "Get through a full pile of CVs in the time it used to take to read three.",
    items: ["Bulk CV upload against one role", "PDF and Word CVs, tables and columns included", "Fast, consistent parsing"],
  },
  {
    title: "Make better screening decisions",
    icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
    body: "See more than a score \u2014 see the reasoning behind it.",
    items: ["Match scoring against the role", "Standout factors", "Possible red flags", "Blind screening, with protected characteristics excluded from scoring"],
  },
  // The product is a whole agency system, not only a screener; the page
  // said so in one section and the metadata not at all, so buyers looking
  // for an ATS/CRM didn't learn they'd found one (docs/ux-research-audit.md, R1).
  {
    title: "Run the whole desk",
    icon: "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18",
    body: "Everything after the shortlist, in the same place.",
    items: ["Pipeline, jobs and clients", "Client shortlists with one-tap feedback", "Interviews, offers and placements", "Invoices, targets and agency analytics"],
  },
];

function FeatureGroups() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {FEATURE_GROUPS.map((g) => (
        <div key={g.title} className="lift-on-hover rounded-card p-7 bg-[var(--mist)] border border-[var(--border)]">
          <span className="mb-5 w-10 h-10 rounded-btn flex items-center justify-center bg-[var(--mint)] text-[var(--forest)] border border-[var(--mint-line)]" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={g.icon} />
            </svg>
          </span>
          <h3 className="text-base font-semibold mb-2 text-[var(--ink)]">{g.title}</h3>
          <p className="text-sm leading-relaxed mb-5 text-[var(--ink-soft)]">{g.body}</p>
          <ul className="space-y-2.5">
            {g.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--ink-soft)]">
                <svg className="shrink-0 mt-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── Trust / GDPR - a dedicated, weightier section since candidates' data is involved ── */

const TRUST_PILLARS = [
  { title: "European data storage", body: "Candidate data is stored in Switzerland, which the UK and EU recognise as adequate. AI analysis uses providers bound by UK and EU transfer safeguards." },
  { title: "Encrypted throughout", body: "Encrypted at rest and in transit, end to end." },
  { title: "Never used to train models", body: "Candidate data is never used to train Helixon or anyone else's models." },
  { title: "Full audit trail", body: "Every score, note and status change is timestamped and attributed." },
];

function TrustSection() {
  return (
    <section className="brand-texture py-20 bg-[var(--brand-surface)]">
      <div className="relative max-w-[1100px] mx-auto px-6">
        <Reveal>
          <div className="text-center mb-12">
            <p className="text-12 font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.8)" }}>Trust & compliance</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-display text-balance">
              Candidate data, handled properly
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {TRUST_PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 60}>
              <div className="rounded-card p-6 h-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <h3 className="text-15 font-semibold mb-2 text-white">{p.title}</h3>
                {/* 0.85 white on the card's tint measured 4.46:1; this is 5:1. */}
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.93)" }}>{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="text-center">
          <a href="/dpa" className="inline-flex items-center min-h-[44px] text-sm font-medium hover:underline" style={{ color: "rgba(255,255,255,0.9)" }}>Read our Data Processing Agreement →</a>
        </div>
      </div>
    </section>
  );
}


/* ── Pricing plans - a "get a demo" tile plus the two paid plans. What each
   plan includes comes from lib/billing/plan-features, shared with /pricing. ── */

const PLANS = [
  {
    name: "Not sure yet?", price: "Demo", period: "on your own CVs",
    features: ["Full platform walkthrough", "Run it on your own CVs and roles", "No obligation"],
    cta: "Get a demo", highlight: false, action: "demo",
  },
  {
    name: "Individual", price: "£249", period: "/ month",
    features: PLAN_FEATURES.individual,
    cta: "Buy Individual", highlight: false, plan: "individual",
  },
  {
    name: "Agency", price: "£349", period: "/ month",
    features: PLAN_FEATURES.agency,
    cta: "Buy Agency", highlight: true, plan: "agency",
  },
];

/* ── FAQ - reordered around actual buying objections ──────────────────────── */

const FAQS = [
  { q: "How does Helixon score candidates?", a: "Each CV is compared against the job description you provide \u2014 skills, experience, seniority and role fit \u2014 to produce a single match score, alongside the standout factors and possible red flags behind it." },
  { q: "Does Helixon replace recruiter judgement?", a: "No. Helixon surfaces the score, standout factors and possible red flags so you can review candidates faster. The final call on who to interview or hire is always yours." },
  { q: "Can I upload multiple CVs for one role?", a: "Yes. Drop in up to 50 CVs against a single role at once and come back to a ranked, sortable shortlist instead of dozens of separate files." },
  { q: "What happens to candidate data?", a: "It's stored in Switzerland, which the UK and EU recognise as adequate, encrypted at rest and in transit, and never used to train any model. See our Data Processing Agreement for full detail." },
  { q: "Can my recruiting team collaborate?", a: "Yes, on the Agency plan, for up to 5 people. Shortlists, notes and tags are shared across your team, with a full audit trail of who screened what." },
  { q: "How much does Helixon cost?", a: "Individual is \u00a3249 a month and Agency is \u00a3349 a month, both with unlimited screening. If you're not sure which fits your team, book a demo and we'll walk you through it." },
  { q: "Can I cancel anytime?", a: "Yes. Individual and Agency plans are billed monthly with no long-term contract. Cancel from your account settings and you'll keep access until the end of the billing period." },
];


/* ── Page ──────────────────────────────────────────────────────────────── */

// FAQPage structured data from the same questions the page shows.
const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--mist)] text-[var(--ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD).replace(/</g, "\\u003c") }} />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="home" />

      {/* Motion's features load after the page; see LandingMotion. */}
      <LandingMotion>
      <main id="main-content">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div className="relative">
          <div className="hero-backdrop" aria-hidden="true" />
          <section className="relative max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,28rem)] gap-14 items-center">
              <div>
                <span
                  className="fade-up-in inline-flex items-center gap-1.5 text-13 font-semibold px-3 py-1.5 rounded-full mb-6 bg-[var(--mint)] text-[var(--forest)] border border-[var(--mint-line)]"
                  style={{ "--stagger-delay": "0ms" }}
                >
                  <svg className="w-[0.85em] h-[0.85em] shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  <HeroBadge />
                </span>

                <h1
                  className="fade-up-in text-4xl sm:text-52 font-semibold tracking-tight leading-[1.06] mb-5 text-balance text-[var(--ink)] font-display"
                  style={{ "--stagger-delay": "70ms" }}
                >
                  Screen every CV for a role in the time it takes to{" "}
                  <span className="relative inline-block text-[var(--forest)]">
                    read one.
                    {/* Drawn in once by CSS (.hero-underline), so it needs no JavaScript. */}
                    <svg className="hero-underline" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M3 8.5C48 3.5 120 2.5 197 6.5" pathLength="1" />
                    </svg>
                  </span>
                </h1>

                <p
                  className="fade-up-in text-16 sm:text-lg leading-relaxed mb-8 max-w-lg text-[var(--ink-soft)]"
                  style={{ "--stagger-delay": "140ms" }}
                >
                  <HeroSubtitle />
                </p>

                <HeroActions />
              </div>

              <div className="fade-up-in" style={{ "--stagger-delay": "160ms" }}>
                <HeroDemo />
              </div>
            </div>
          </section>
        </div>

        {/* ── Trust strip ─────────────────────────────────────────────────── */}
        <TrustStrip />

        {/* ── Example analysis report: the strongest proof, straight after the hero ── */}
        <AnalysisExampleSection />

        {/* ── How it works, told as you scroll ─────────────────────────────── */}
        <StorySection />

        {/* ── Dashboard (the manage-the-desk half, shared by the team) ─────── */}
        <DashboardSection />

        {/* ── Trust / GDPR ─────────────────────────────────────────────────── */}
        <TrustSection />

        {/* ── Features, grouped by outcome ─────────────────────────────────── */}
        <section id="features" className="py-24 bg-[var(--bg)] border-t border-t-[var(--border-soft)] border-b border-b-[var(--border-soft)]">
          <div className="max-w-[1100px] mx-auto px-6">
            <Reveal>
              <div className="text-center mb-12">
                <p className="text-12 font-semibold uppercase tracking-widest mb-3 text-[var(--ink-faint)]">Capabilities</p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 text-[var(--ink)] font-display text-balance">
                  Built for the volume agency recruiters actually handle
                </h2>
                <p className="text-16 leading-relaxed max-w-xl mx-auto text-[var(--ink-soft)]">
                  The parts that matter when you&rsquo;re screening dozens of CVs a week, not
                  a demo that only holds up on one perfect candidate.
                </p>
              </div>
            </Reveal>
            <Reveal><FeatureGroups /></Reveal>
          </div>
        </section>

        {/* ── Pricing / buy ───────────────────────────────────────────────── */}
        <section id="pricing" className="max-w-[1100px] mx-auto px-6 py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-12 font-semibold uppercase tracking-widest mb-3 text-[var(--ink-faint)]">Pricing</p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 text-[var(--ink)] font-display text-balance">
                Plans built around how agencies actually screen
              </h2>
              <p className="text-16 leading-relaxed max-w-xl mx-auto text-[var(--ink-soft)]">
                Book a demo to see it run on your own CVs, or start on a plan today.
                Monthly billing, no long-term contract.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[900px] mx-auto items-stretch">
            {PLANS.map((plan) => (
              // On a phone the recommended plan comes first, not below the demo card.
              <Reveal key={plan.name} className={plan.highlight ? "order-first md:order-none" : ""}>
                <div
                  className={`rounded-2xl p-6 flex flex-col relative h-full ${plan.highlight ? "pt-8" : ""}`}
                  style={{
                    background: plan.highlight ? "var(--brand-surface)" : "var(--bg)",
                    border: plan.highlight ? "1px solid var(--brand-surface)" : "1px solid var(--border)",
                    boxShadow: plan.highlight ? "0 12px 28px -12px rgba(11,110,79,0.5)" : "none",
                  }}
                >
                  {/* Centred on the card's top edge and allowed to wrap, so it
                      stays on screen at large text sizes. */}
                  {plan.highlight && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-max max-w-[calc(100%-2rem)] text-center text-12 font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[var(--mint)] text-[var(--forest)] border border-[var(--forest)]"
                    >
                      Recommended for agencies
                    </span>
                  )}
                  <h3 className="text-12 font-semibold uppercase tracking-widest mb-3" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1.5 mb-6">
                    <span className={`text-36 font-semibold leading-none tabular-nums font-display ${plan.highlight ? "text-white" : "text-[var(--ink)]"}`}>{plan.price}</span>
                    <span className="text-13" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}>{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-7 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: plan.highlight ? "rgba(255,255,255,0.92)" : "var(--ink-soft)" }}>
                        <svg className="shrink-0 mt-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.highlight ? "rgba(255,255,255,0.9)" : "var(--forest)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.action === "demo" ? (
                    <Button
                      as="a"
                      href="/demo"
                      variant="primary"
                      size="block"
                      className="min-h-[44px]"
                    >
                      {plan.cta}
                    </Button>
                  ) : (
                    <BuyPlanButton plan={plan.plan} label={plan.cta} highlight={plan.highlight} />
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq" className="py-24 bg-[var(--bg)] border-t border-t-[var(--border-soft)]">
          <div className="max-w-[1100px] mx-auto px-6">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-12 font-semibold uppercase tracking-widest mb-3 text-[var(--ink-faint)]">FAQ</p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ink)] font-display text-balance">
                Questions recruiters usually ask
              </h2>
            </div>
          </Reveal>
          <Reveal><FAQSection faqs={FAQS} /></Reveal>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <Reveal>
          <CtaBand
            heading="Your next great hire is already in that pile of CVs."
            body="Find them in minutes, not hours. Get a demo and we'll show you how."
          />
        </Reveal>

      </main>
      </LandingMotion>

      <MarketingFooter />
      <ChatWidget />
    </div>
  );
}
