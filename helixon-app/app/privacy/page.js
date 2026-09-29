import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import PrivacyToc, { PrintButton } from "./PrivacyToc";

// Two roles, and the notice covers both (UK GDPR Arts. 13 and 14):
//   - processor for candidate data an agency puts into Helixon (the
//     agency is the controller - see /dpa);
//   - controller for our own customers' account, billing and usage data,
//     and for visitors to this website.

const CONTACT = "hello@helixon.co.uk";
const UPDATED = "29 September 2026";

const SECTIONS = [
  { id: "who", title: "Who we are" },
  { id: "roles", title: "Our two roles" },
  { id: "data", title: "What data is processed" },
  { id: "basis", title: "Why, and our lawful basis" },
  { id: "ai", title: "AI and automated decisions" },
  { id: "processors", title: "Who we share it with" },
  { id: "transfers", title: "International transfers" },
  { id: "retention", title: "How long we keep it" },
  { id: "rights", title: "Your rights" },
  { id: "complaints", title: "Complaints" },
  { id: "security", title: "Security" },
  { id: "changes", title: "Changes to this notice" },
  { id: "contact", title: "Contact us" },
];

const GLANCE = [
  { icon: "shield", title: "Never sold, never used for training", body: "We don't sell personal data or use CVs to train AI models." },
  { icon: "pin", title: "Stored in Switzerland", body: "Recognised by the UK and EU as giving adequate protection." },
  { icon: "people", title: "Agencies control candidate data", body: "We process it only on their instructions." },
  { icon: "check", title: "A person makes the decision", body: "AI scores support recruiters - they don't decide." },
  { icon: "clock", title: "Deleted when no longer needed", body: "Inactive candidates are removed automatically." },
  { icon: "key", title: "Your data, your rights", body: "Access, correct, delete or move it at any time." },
];

const DATA_GROUPS = [
  {
    heading: "Candidate data",
    tag: "Processed for agencies",
    items: [
      "CVs and what they contain: name, contact details, location, employment history, education, skills, and anything else the candidate included",
      "The AI assessment of each CV against a role: match score, summary, strengths, concerns and suggested interview questions",
      "What recruiters record: pipeline stage, notes, tags, next actions, emails drafted or sent, talent pool details, feedback requests",
    ],
  },
  {
    heading: "Customer data",
    tag: "Helixon is controller",
    items: [
      "Account details: name, email address, agency name, role in the team",
      "Billing details: plan and payment status (card details are held by Stripe, not us)",
      "Usage: analyses run, and which features are used",
      "Team presence, where the agency has it switched on: when you have Helixon open and when you last used it, plus any status you set yourself. We never record what you click or type. You can hide your presence at any time and the agency can switch the feature off; either way, what was recorded is deleted.",
      "Security data: IP addresses and technical logs used for rate limiting, fraud prevention and fixing errors",
    ],
  },
  {
    heading: "Website visitors",
    tag: "Helixon is controller",
    items: [
      "Messages you send to the website chat assistant, and details you give in contact or demo request forms",
      "Analytics about how the site is used, only if you accept optional cookies (see our Cookie Policy)",
    ],
  },
];

const BASES = [
  ["Candidate data", "The agency's lawful basis - usually its legitimate interests in recruiting, or steps at the candidate's request before a contract. We process it only on the agency's documented instructions (Article 28), and agencies confirm they have a lawful basis each time they screen a CV. That confirmation is recorded."],
  ["Your account and the service", "Performance of a contract - Article 6(1)(b)"],
  ["Billing and financial records", "Legal obligation - Article 6(1)(c)"],
  ["Security, preventing abuse, error monitoring", "Our legitimate interests in keeping Helixon safe and working - Article 6(1)(f)"],
  ["Team presence", "The agency's legitimate interest in knowing which colleagues are available - Article 6(1)(f). Records availability only, never activity; each person can hide it and the agency can switch it off."],
  ["Answering enquiries and demo requests", "Our legitimate interests in responding to you - Article 6(1)(f)"],
  ["Optional analytics and session replay", "Your consent - Article 6(1)(a). Withdraw it any time from the cookie banner."],
];

const PROCESSORS = [
  ["Anthropic", "AI analysis of CVs and job descriptions", "United States"],
  ["Voyage AI", "Skill-matching embeddings for CV analysis", "United States"],
  ["Google (Gemini API)", "The website chat assistant", "United States"],
  ["Supabase", "Database and file storage", "Switzerland"],
  ["Vercel", "Application hosting", "United States"],
  ["Upstash (via Vercel)", "Rate limiting - IP addresses and account ids, kept up to an hour", "United States"],
  ["Clerk", "Sign-in and accounts", "United States"],
  ["Stripe", "Billing and payments", "EU / United States"],
  ["Resend", "Sending email", "EU / United States"],
  ["Sentry", "Error monitoring; session replay only with your consent", "EU (Germany)"],
  ["PostHog", "Product analytics, only with your consent", "EU"],
];

const RETENTION = [
  ["Candidate data", "Each agency chooses 6, 12, 24 or 36 months (12 by default). Candidates with no activity for that long are deleted automatically, CV files included. Talent pool entries lapse after the same period unless renewed. Everything is deleted 90 days after an agency cancels. Agencies can delete any candidate at any time."],
  ["Your account", "While it's open. If you delete it, your name and presence details are removed from the agency's workspace, and notes or history you wrote show as \"Former team member\"."],
  ["Billing records", "Six years, as UK tax law requires."],
  ["Team presence", "Overwritten as you use Helixon; deleted straight away if you hide it or the agency switches it off."],
  ["Rate-limiting records", "Up to one hour."],
  ["Error reports", "Up to 90 days."],
  ["Website enquiries", "Up to two years after our last contact. Chat assistant messages are not stored by Helixon."],
];

const RIGHTS = ["Access", "Correction", "Erasure", "Restriction", "Objection", "Portability", "Withdraw consent", "Human review of automated decisions"];

/* ── Small pieces ─────────────────────────────────────────────────────── */

const ICONS = {
  shield: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />,
  pin: (
    <>
      <path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l3 3M15 8l2 2" />
    </>
  ),
};

function Glyph({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function Section({ id, index, title, children }) {
  return (
    <section id={id} className="scroll-mt-28 py-9 first:pt-0 border-b last:border-b-0 last:pb-0" style={{ borderColor: "var(--border)" }}>
      <h2 className="flex items-baseline gap-3 text-[21px] font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--forest)", fontFamily: "var(--font-mono)" }}>
          {String(index).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="space-y-4 text-[14.5px] leading-[1.75]" style={{ color: "var(--ink-soft)" }}>
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-[10px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--forest)" }} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Two-column "label | detail" rows - for bases and retention.
function Rows({ rows, head }) {
  return (
    <div className="rounded-[14px] border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <div className="hidden sm:grid grid-cols-[200px_1fr] gap-4 text-[11px] font-semibold uppercase tracking-widest px-5 py-2.5" style={{ background: "var(--mint)", color: "var(--forest)" }}>
        <span>{head[0]}</span>
        <span>{head[1]}</span>
      </div>
      {rows.map(([k, v], i) => (
        <div key={k} className="grid sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 px-5 py-3.5 text-[14px]" style={{ background: i % 2 ? "var(--mist)" : "white" }}>
          <span className="font-semibold" style={{ color: "var(--ink)" }}>
            {k}
          </span>
          <span className="leading-relaxed">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Callout({ children, tone = "mint" }) {
  return (
    <div className="rounded-[14px] px-5 py-4 text-[14px] leading-relaxed" style={{ background: tone === "mint" ? "var(--mint)" : "var(--mist)", color: "var(--ink)" }}>
      {children}
    </div>
  );
}

const US_ONLY = (where) => /United States/.test(where) && !/EU/.test(where);

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function Privacy() {
  return (
    <div className="min-h-screen" style={{ background: "var(--mist)" }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="privacy" />
      <main id="main-content">

      <header className="bg-white border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1120px] mx-auto px-6 pt-14 pb-12">
          <p className="text-[12px] font-medium mb-4" style={{ color: "var(--ink-faint)" }}>
            <Link href="/" className="hover:underline">
              Helixon
            </Link>
            <span className="mx-1.5">/</span>Legal
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Privacy Policy
          </h1>
          <p className="text-[16px] leading-relaxed max-w-2xl mb-6" style={{ color: "var(--ink-soft)" }}>
            How Helixon handles the personal data of candidates, the recruiters who use Helixon, and visitors to this website - in plain
            English, under UK GDPR and EU GDPR.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]" style={{ color: "var(--ink-soft)" }}>
            <span>
              <strong style={{ color: "var(--ink)" }}>Last updated:</strong> {UPDATED}
            </span>
            <span>
              <strong style={{ color: "var(--ink)" }}>Questions:</strong>{" "}
              <a href={`mailto:${CONTACT}`} className="font-semibold" style={{ color: "var(--forest)" }}>
                {CONTACT}
              </a>
            </span>
            <PrintButton />
          </div>
        </div>
      </header>

      {/* At a glance */}
      <section aria-labelledby="glance" className="max-w-[1120px] mx-auto px-6 pt-12">
        <h2 id="glance" className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--ink-faint)" }}>
          At a glance
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GLANCE.map((g) => (
            <div key={g.title} className="rounded-[16px] bg-white border p-5 flex gap-4" style={{ borderColor: "var(--border)" }}>
              <span className="w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "var(--mint)", color: "var(--forest)" }}>
                <Glyph name={g.icon} />
              </span>
              <span>
                <span className="block text-[14.5px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
                  {g.title}
                </span>
                <span className="block text-[13px] leading-relaxed mt-1" style={{ color: "var(--ink-soft)" }}>
                  {g.body}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-6 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] gap-0 lg:gap-14 items-start">
        {/* Sticky under the nav on small screens (the contents bar), and a
            full-height column on large ones (the side list sticks in it). */}
        <aside className="sticky top-[56px] z-30 lg:static lg:z-auto lg:self-stretch">
          <PrivacyToc sections={SECTIONS} />
        </aside>

        <article className="bg-white rounded-[20px] border px-6 sm:px-10 py-10 min-w-0" style={{ borderColor: "var(--border)" }}>
          <Section id="who" index={1} title="Who we are">
            <p>
              Helixon provides AI-assisted CV screening and recruitment workflow software to recruitment agencies. Where this notice says
              &ldquo;we&rdquo;, it means Helixon.
            </p>
            <Callout tone="mist">
              Helixon is not yet operated through an incorporated company. This section will be updated with our registered company name,
              number and address once incorporation is complete. Until then, contact us at{" "}
              <a href={`mailto:${CONTACT}`} className="font-semibold" style={{ color: "var(--forest)" }}>
                {CONTACT}
              </a>{" "}
              for any privacy query or request.
            </Callout>
          </Section>

          <Section id="roles" index={2} title="Our two roles">
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ["Candidate data", "The recruitment agency", "When an agency uploads a CV or adds a candidate, the agency decides how that data is used - it is the data controller. We process it on its behalf under our Data Processing Agreement. Candidates should contact the agency about their data; we help agencies answer those requests."],
                ["Customers and visitors", "Helixon", "For the recruiters and agency staff who use Helixon, and for visitors to this website, we are the data controller. The rest of this notice covers both roles."],
              ].map(([what, who, body]) => (
                <div key={what} className="rounded-[16px] border p-5" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
                    {what}
                  </p>
                  <p className="text-[15px] font-semibold mt-1" style={{ color: "var(--ink)" }}>
                    Controller: <span style={{ color: "var(--forest)" }}>{who}</span>
                  </p>
                  <p className="text-[13.5px] leading-relaxed mt-2">{body}</p>
                </div>
              ))}
            </div>
            <p className="text-[13.5px]">
              See the{" "}
              <a href="/dpa" className="font-semibold underline underline-offset-2" style={{ color: "var(--forest)" }}>
                Data Processing Agreement
              </a>{" "}
              for our commitments as a processor.
            </p>
          </Section>

          <Section id="data" index={3} title="What data is processed">
            <div className="space-y-6">
              {DATA_GROUPS.map((g) => (
                <div key={g.heading}>
                  <p className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                      {g.heading}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>
                      {g.tag}
                    </span>
                  </p>
                  <Bullets items={g.items} />
                </div>
              ))}
            </div>
          </Section>

          <Section id="basis" index={4} title="Why we process it, and our lawful basis">
            <Rows head={["Purpose", "Lawful basis"]} rows={BASES} />
          </Section>

          <Section id="ai" index={5} title="AI assessments and automated decision-making">
            <p>
              Helixon uses AI - Anthropic&apos;s Claude models, with Voyage AI embeddings for skill matching - to compare a CV against a
              role&apos;s requirements and produce a match score, summary and suggested questions. The AI is instructed to judge only
              job-relevant skills and experience, and never to take account of protected characteristics such as age, sex, ethnicity,
              religion or disability. Agencies can also screen &ldquo;blind&rdquo;, which removes names, contact details and employers from
              what the AI sees.
            </p>
            <Callout>
              <strong>The assessment supports a recruiter&apos;s decision - it isn&apos;t the decision.</strong> Helixon never makes decisions
              about candidates solely by automated means, and every report tells the recruiter to review it before acting. A candidate can
              ask the agency for a person to review how they were assessed, and to explain it.
            </Callout>
            <p>
              CVs sometimes contain special category data, such as health information, religion or a photo. It is processed only because it
              is in the CV; it isn&apos;t used for scoring, and agencies should ask candidates not to include it.
            </p>
          </Section>

          <Section id="processors" index={6} title="Who we share it with">
            <p>
              These providers help us run Helixon. Each is bound by a data processing agreement and none may use the data for its own
              purposes. We don&apos;t sell personal data, and we don&apos;t use CV data to train AI models.
            </p>
            <div className="rounded-[14px] border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <div className="hidden sm:grid grid-cols-[170px_1fr_150px] gap-4 text-[11px] font-semibold uppercase tracking-widest px-5 py-2.5" style={{ background: "var(--mint)", color: "var(--forest)" }}>
                <span>Provider</span>
                <span>What for</span>
                <span>Where</span>
              </div>
              {PROCESSORS.map(([name, purpose, where], i) => (
                <div key={name} className="grid sm:grid-cols-[170px_1fr_150px] gap-1 sm:gap-4 items-center px-5 py-3 text-[14px]" style={{ background: i % 2 ? "var(--mist)" : "white" }}>
                  <span className="font-semibold" style={{ color: "var(--ink)" }}>
                    {name}
                  </span>
                  <span className="leading-snug">{purpose}</span>
                  <span>
                    <span
                      className="inline-block text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: US_ONLY(where) ? "#fdf6e9" : "var(--mint)", color: US_ONLY(where) ? "#8a5a12" : "var(--forest)" }}
                    >
                      {where}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
              Transfers to the United States are protected as described in the next section.
            </p>
          </Section>

          <Section id="transfers" index={7} title="International transfers">
            <p>
              Our database is in Switzerland, which the UK and EU recognise as giving adequate protection. Where a provider processes data in
              the United States or another country without an adequacy decision, the transfer is covered by the UK International Data
              Transfer Addendum and the EU Standard Contractual Clauses (or, where the provider is certified, the UK Extension to the EU-US
              Data Privacy Framework), with additional safeguards such as encryption in transit and at rest.
            </p>
            <p>You can ask us for a copy of the relevant safeguards.</p>
          </Section>

          <Section id="retention" index={8} title="How long we keep it">
            <Rows head={["Data", "Kept for"]} rows={RETENTION} />
          </Section>

          <Section id="rights" index={9} title="Your rights">
            <div className="flex flex-wrap gap-2">
              {RIGHTS.map((r) => (
                <span key={r} className="text-[13px] font-semibold px-3 py-1.5 rounded-full border bg-white" style={{ borderColor: "var(--border)", color: "var(--ink)" }}>
                  {r}
                </span>
              ))}
            </div>
            <p>
              You have the right to access your personal data, to have it corrected or erased, to restrict or object to how it is used, to
              data portability, and to withdraw consent where we rely on it. You also have the right not to be subject to a decision based
              solely on automated processing that significantly affects you.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Callout>
                <strong>Candidates</strong> - contact the agency that holds your data. It is the controller and can export, correct or erase
                everything it holds about you in Helixon. If you contact us, we&apos;ll pass your request to the agency.
              </Callout>
              <Callout tone="mist">
                <strong>Helixon customers and website visitors</strong> - contact us at{" "}
                <a href={`mailto:${CONTACT}`} className="font-semibold" style={{ color: "var(--forest)" }}>
                  {CONTACT}
                </a>
                . We&apos;ll respond within one month.
              </Callout>
            </div>
          </Section>

          <Section id="complaints" index={10} title="Complaints">
            <p>If you&apos;re unhappy with how your data is handled, please contact us first so we can put it right.</p>
            <Callout tone="mist">
              You also have the right to complain to the <strong>Information Commissioner&apos;s Office</strong> -{" "}
              <a href="https://ico.org.uk/make-a-complaint/" className="font-semibold underline underline-offset-2" style={{ color: "var(--forest)" }} rel="noopener noreferrer" target="_blank">
                ico.org.uk
              </a>
              , 0303 123 1113 - or to the data protection authority where you live or work.
            </Callout>
          </Section>

          <Section id="security" index={11} title="Security">
            <Bullets
              items={[
                "Data is encrypted in transit and at rest.",
                "Every agency's data is kept separate, and only reachable through checks that the person asking belongs to that agency.",
                "Original CV files are held privately and opened only through links that expire after a minute.",
                "Access by Helixon staff is limited and logged.",
              ]}
            />
          </Section>

          <Section id="changes" index={12} title="Changes to this notice">
            <p>We&apos;ll update this notice when how we handle data changes, and tell customers about significant changes by email.</p>
          </Section>

          <Section id="contact" index={13} title="Contact us">
            <div className="rounded-[16px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: "var(--forest)", color: "white" }}>
              <div>
                <p className="text-[16px] font-semibold">Privacy questions or requests</p>
                <p className="text-[13.5px] mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
                  We reply within one month - usually much sooner.
                </p>
              </div>
              <a
                href={`mailto:${CONTACT}`}
                className="inline-flex items-center justify-center text-[14px] font-semibold px-5 py-2.5 rounded-full bg-white shrink-0"
                style={{ color: "var(--forest)" }}
              >
                {CONTACT}
              </a>
            </div>
          </Section>
        </article>
      </div>

      </main>
      <MarketingFooter />
    </div>
  );
}
