// The homepage. A server component: the static sections render to HTML
// with no client JavaScript. The interactive pieces (previews, tabs, FAQ,
// buy buttons, signed-in hero copy) come from home-interactive.jsx.
import Button from "@/components/landing/Button";
import ChatWidget from "@/components/landing/ChatWidget";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import CtaBand from "@/components/marketing/CtaBand";
import AnalysisExample from "@/components/landing/AnalysisExample";
import { PLAN_FEATURES, PLAN_FOR, agencyPerSeatNote, placementFeeExample } from "@/lib/plan-features";
import {
  BulkPreviewCard,
  BuyPlanButton,
  DashboardPreview,
  FAQSection,
  HeroActions,
  HeroBadge,
  HeroSubtitle,
  ProductWorkflowSection,
  RecruiterWorkspaceDemo,
  Reveal,
  TrustStrip,
} from "@/components/landing/home-interactive";

/* ── Example analysis - a full report on three very different roles ───── */

function AnalysisExampleSection() {
  return (
    <section id="example" className="max-w-[1100px] mx-auto px-6 py-24">
      <Reveal>
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>See a real analysis</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Not just a score — the reasons behind it
          </h2>
          <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
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


/* ── Pain / before-after: two workflows, side by side ────────────────────── */

const MANUAL_STEPS = ["Open the CV", "Read it top to bottom", "Open the job description", "Compare by eye", "Note it down somewhere", "Decide", "Repeat, 50 times"];
const HELIXON_STEPS = ["Upload the CVs", "Helixon analyses each one", "Candidates are ranked", "Review the strongest matches", "Shortlist and move on"];

function TimelineColumn({ label, steps, tone }) {
  const accent = tone === "forest" ? "var(--forest)" : "var(--ink-mute)";
  return (
    <div className="rounded-[16px] p-7 h-full" style={{ background: "white", border: "1px solid var(--border)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-6" style={{ color: tone === "forest" ? "var(--forest)" : "var(--ink-faint)" }}>{label}</p>
      <ol className="relative pl-5">
        <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px" style={{ background: "var(--border)" }} aria-hidden="true" />
        {steps.map((step) => (
          <li key={step} className="relative pb-5 last:pb-0">
            <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full" style={{ background: tone === "forest" ? accent : "white", border: `2px solid ${accent}` }} aria-hidden="true" />
            <span className="text-sm" style={{ color: "var(--ink)" }}>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BeforeAfterSection() {
  return (
    <section className="max-w-[1100px] mx-auto px-6 py-24">
      <Reveal>
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            The bottleneck isn&rsquo;t hiring. It&rsquo;s everything before the shortlist.
          </h2>
          <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
            Most agencies still screen the way they did a decade ago — one CV, one tab,
            one spreadsheet at a time.
          </p>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Reveal><TimelineColumn label="Screening by hand" steps={MANUAL_STEPS} tone="muted" /></Reveal>
        <Reveal delay={80}><TimelineColumn label="Screening with Helixon" steps={HELIXON_STEPS} tone="forest" /></Reveal>
      </div>
    </section>
  );
}


/* ── Bulk screening - the volume story, told without invented numbers ────── */


function BulkScreeningSection() {
  const stages = [
    { label: "Upload the batch", detail: "Up to 50 CVs at once, against a single role" },
    { label: "Helixon scores each one", detail: "Every CV compared against the same job spec" },
    { label: "Review a ranked list", detail: "Sorted by fit, with the reasoning attached" },
  ];

  const nodes = stages.flatMap((s, i) => {
    const items = [
      <Reveal key={`stage-${i}`} delay={i * 80}>
        <div className="rounded-[14px] p-6 text-center h-full" style={{ background: "white", border: "1px solid var(--border)" }}>
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold mb-3" style={{ background: "var(--mint)", color: "var(--forest)" }}>{i + 1}</span>
          <p className="text-[15px] font-semibold mb-1.5" style={{ color: "var(--ink)" }}>{s.label}</p>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{s.detail}</p>
        </div>
      </Reveal>,
    ];
    if (i < stages.length - 1) {
      items.push(
        <svg key={`arrow-${i}`} className="hidden sm:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    }
    return items;
  });

  return (
    <section className="max-w-[1100px] mx-auto px-6 py-24">
      <Reveal>
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Bulk screening</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            One role. Dozens of CVs. One ranked shortlist.
          </h2>
          <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
            Every candidate for a role is scored against the same spec, so the comparison
            holds up — and a weak CV never blocks the rest of the batch.
          </p>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 max-w-3xl mx-auto items-center mb-12">
        {nodes}
      </div>
      <Reveal delay={stages.length * 80}>
        <BulkPreviewCard />
      </Reveal>
    </section>
  );
}


/* ── Dashboard section - the "after the screening" half of the product.
   Every other section on this page is about scoring a CV; this is the one
   that shows what the recruiter manages afterwards. ── */

const DASHBOARD_POINTS = [
  "Every open role, every candidate and every score in one view",
  "Stalled candidates and unreviewed strong matches surfaced automatically",
  "Time to fill, offer acceptance, source of hire and fee income — real agency analytics, not just a candidate list",
  "Shared across your team, with a full audit trail of who screened what",
];

function DashboardSection() {
  return (
    <section id="dashboard" className="py-24" style={{ background: "white", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-center">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>The dashboard</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Screening is the start. This is where the desk gets run.
            </h2>
            <p className="text-[15px] leading-relaxed mb-6" style={{ color: "var(--ink-soft)" }}>
              Scores are only useful if they turn into placements. Helixon keeps every
              role, candidate and stage in one place, so nothing sits waiting in
              someone&rsquo;s inbox.
            </p>
            <ul className="space-y-3">
              {DASHBOARD_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  <svg className="shrink-0 mt-1" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={90}>
            <DashboardPreview />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Agency workflow - collaboration is visible, not a footnote ──────────── */

const AGENCY_FLOW = [
  { role: "Recruiter", action: "Screens candidates against the role" },
  { role: "Recruiter", action: "Adds notes and tags" },
  { role: "Team", action: "Shares the shortlist" },
  { role: "Hiring manager", action: "Reviews and moves candidates forward" },
];

function AgencyWorkflowSection() {
  return (
    <section id="agency" className="max-w-[1100px] mx-auto px-6 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>For agencies</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Built for the way agency teams already work
          </h2>
          <p className="text-[15px] leading-relaxed mb-6 max-w-md" style={{ color: "var(--ink-soft)" }}>
            One recruiter screens and the whole team sees the result. Notes, tags and
            shortlists stay together, with a clear record of who screened what and when.
          </p>
          <div className="flex flex-wrap gap-2 mb-7">
            {["Shared shortlists", "Notes & tags", "Audit trail", "Multi-seat access"].map((chip) => (
              <span key={chip} className="text-[13px] font-medium px-3 py-1.5 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>{chip}</span>
            ))}
          </div>
          <Button as="a" href="/demo" variant="outline" className="min-h-[44px]">Get a demo</Button>
        </Reveal>

        <Reveal delay={80}>
          <div className="rounded-[16px] p-7" style={{ background: "white", border: "1px solid var(--border)" }}>
            <ol className="relative pl-6">
              <div className="absolute left-[9px] top-1.5 bottom-1.5 w-px" style={{ background: "var(--border)" }} aria-hidden="true" />
              {AGENCY_FLOW.map((step, i) => (
                <li key={`${step.role}-${i}`} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "var(--forest)" }} aria-hidden="true">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "white" }} />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--forest)" }}>{step.role}</p>
                  <p className="text-sm" style={{ color: "var(--ink)" }}>{step.action}</p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Features - grouped by recruiter outcome, not by feature name ────────── */

const FEATURE_GROUPS = [
  {
    title: "Screen faster",
    body: "Get through a full pile of CVs in the time it used to take to read three.",
    items: ["Bulk CV upload against one role", "PDF and Word CVs, tables and columns included", "Fast, consistent parsing"],
  },
  {
    title: "Make better screening decisions",
    body: "See more than a score \u2014 see the reasoning behind it.",
    items: ["Match scoring against the role", "Standout factors", "Possible red flags", "Blind screening, with protected characteristics excluded from scoring"],
  },
  {
    title: "Stay compliant",
    body: "Built for candidate data from the ground up.",
    items: ["Data stored in Switzerland", "Encryption at rest & in transit", "Full audit trail", "GDPR-ready workflow"],
  },
  // The product is a whole agency system, not only a screener; the page
  // said so in one section and the metadata not at all, so buyers looking
  // for an ATS/CRM didn't learn they'd found one (docs/ux-research-audit.md, R1).
  {
    title: "Run the whole desk",
    body: "Everything after the shortlist, in the same place.",
    items: ["Pipeline, jobs and clients", "Client shortlists with one-tap feedback", "Interviews, offers and placements", "Invoices, targets and agency analytics"],
  },
];

function FeatureGroups() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {FEATURE_GROUPS.map((g) => (
        <div key={g.title} className="rounded-[14px] p-7" style={{ background: "white", border: "1px solid var(--border)" }}>
          <h3 className="text-base font-semibold mb-2" style={{ color: "var(--ink)" }}>{g.title}</h3>
          <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--ink-soft)" }}>{g.body}</p>
          <ul className="space-y-2.5">
            {g.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--ink-soft)" }}>
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
    <section className="py-20" style={{ background: "var(--forest)" }}>
      <div className="max-w-[1100px] mx-auto px-6">
        <Reveal>
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.8)" }}>Trust & compliance</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
              Candidate data, handled properly
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {TRUST_PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 60}>
              <div className="rounded-[14px] p-6 h-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <h3 className="text-[15px] font-semibold mb-2 text-white">{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>{p.body}</p>
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
   plan includes comes from lib/plan-features, shared with /pricing. ── */

const PLANS = [
  {
    name: "Not sure yet?", price: "Demo", period: "on your own CVs", forWhom: "For anyone who wants to see it on a live role before paying.",
    features: ["Full platform walkthrough", "Run it on your own CVs and roles", "No obligation"],
    cta: "Get a demo", highlight: false, action: "demo",
  },
  {
    name: "Individual", price: "£249", period: "/ month", forWhom: PLAN_FOR.individual,
    features: PLAN_FEATURES.individual,
    cta: "Choose Individual", highlight: false, plan: "individual",
  },
  {
    name: "Agency", price: "£349", period: "/ month", forWhom: PLAN_FOR.agency, note: agencyPerSeatNote(),
    features: PLAN_FEATURES.agency,
    cta: "Choose Agency", highlight: true, plan: "agency",
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
    <div className="min-h-screen" style={{ background: "var(--mist)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD).replace(/</g, "\\u003c") }} />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="home" />

      <main id="main-content">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <span
                className="fade-up-in inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full mb-6"
                style={{ background: "var(--mint)", color: "var(--forest)", "--stagger-delay": "0ms" }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                <HeroBadge />
              </span>

              <h1
                className="fade-up-in text-4xl sm:text-[3.25rem] font-semibold tracking-tight leading-[1.06] mb-5"
                style={{ color: "var(--ink)", fontFamily: "var(--font-display)", "--stagger-delay": "70ms" }}
              >
                Screen every CV for a role in the time it takes to read one.
              </h1>

              <p
                className="fade-up-in text-[17px] leading-relaxed mb-8 max-w-lg"
                style={{ color: "var(--ink-soft)", "--stagger-delay": "140ms" }}
              >
                <HeroSubtitle />
              </p>

              <HeroActions />
            </div>

            <div className="fade-up-in" style={{ "--stagger-delay": "160ms" }}>
              <RecruiterWorkspaceDemo />
            </div>
          </div>
        </section>

        {/* ── Trust strip ─────────────────────────────────────────────────── */}
        <TrustStrip />

        {/* ── Pain → before/after ─────────────────────────────────────────── */}
        <BeforeAfterSection />

        {/* ── Product workflow (interactive) ──────────────────────────────── */}
        <ProductWorkflowSection />

        {/* ── Example analysis report ─────────────────────────────────────── */}
        <AnalysisExampleSection />

        {/* ── Bulk screening ───────────────────────────────────────────────── */}
        <BulkScreeningSection />

        {/* ── Dashboard (the manage-the-desk half of the product) ──────────── */}
        <DashboardSection />

        {/* ── Agency workflow ──────────────────────────────────────────────── */}
        <AgencyWorkflowSection />

        {/* ── Trust / GDPR ─────────────────────────────────────────────────── */}
        <TrustSection />

        {/* ── Features, grouped by outcome ─────────────────────────────────── */}
        <section id="features" className="py-24" style={{ background: "white", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
          <div className="max-w-[1100px] mx-auto px-6">
            <Reveal>
              <div className="text-center mb-12">
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Capabilities</p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                  Built for the volume agency recruiters actually handle
                </h2>
                <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
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
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Pricing</p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                One price, unlimited screening, the whole desk included
              </h2>
              <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
                Book a demo to see it run on your own CVs, or start on a plan today.
                Monthly billing, no long-term contract.
              </p>
              <p className="text-[13px] leading-relaxed max-w-xl mx-auto mt-3" style={{ color: "var(--ink-faint)" }}>
                {placementFeeExample()}
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[900px] mx-auto items-stretch">
            {PLANS.map((plan) => (
              <Reveal key={plan.name}>
                <div
                  className="rounded-[16px] p-6 flex flex-col relative h-full"
                  style={{
                    background: plan.highlight ? "var(--forest)" : "white",
                    border: plan.highlight ? "1px solid var(--forest)" : "1px solid var(--border)",
                    boxShadow: plan.highlight ? "0 12px 28px -12px rgba(11,110,79,0.5)" : "none",
                  }}
                >
                  {plan.highlight && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: "var(--mint)", color: "var(--forest)", border: "1px solid var(--forest)" }}
                    >
                      Recommended for agencies
                    </span>
                  )}
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-[2.25rem] font-semibold leading-none" style={{ fontFamily: "var(--font-mono)", color: plan.highlight ? "white" : "var(--ink)" }}>{plan.price}</span>
                    <span className="text-[13px]" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}>{plan.period}</span>
                  </div>
                  {plan.note && (
                    <p className="text-[12px] mb-2" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}>{plan.note}</p>
                  )}
                  <p className="text-[13px] leading-snug mb-6" style={{ color: plan.highlight ? "rgba(255,255,255,0.92)" : "var(--ink-soft)" }}>{plan.forWhom}</p>
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
        <section id="faq" className="py-24" style={{ background: "white", borderTop: "1px solid var(--border-soft)" }}>
          <div className="max-w-[1100px] mx-auto px-6">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>FAQ</p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
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
            body="Find them in minutes, not hours. Get a demo and we'll show you how, or pick a plan and start today."
            secondaryLabel="See pricing"
            secondaryHref="#pricing"
          />
        </Reveal>

      </main>

      <MarketingFooter />
      <ChatWidget />
    </div>
  );
}
