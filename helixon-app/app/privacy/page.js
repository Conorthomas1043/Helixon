import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

// Two roles, and the notice covers both (UK GDPR Arts. 13 and 14):
//   - processor for candidate data an agency puts into Helixon (the
//     agency is the controller - see /dpa);
//   - controller for our own customers' account, billing and usage data,
//     and for visitors to this website.
const SECTIONS = [
  {
    title: "Who we are",
    body: [
      "Helixon provides AI-assisted CV screening and recruitment workflow software to recruitment agencies. Helixon is not yet operated through an incorporated company - this section will be updated with our registered company name, number and address once incorporation is complete. Until then, the contact below is the right channel for any privacy query or data protection request.",
      "Where this notice says \"we\", it means Helixon.",
    ],
    contactEmail: "hello@helixon.co.uk",
  },
  {
    title: "Our two roles",
    body: [
      "Candidate data: when a recruitment agency uploads a CV or adds a candidate, the agency decides why and how that data is used - it is the data controller, and Helixon processes the data on its behalf under our Data Processing Agreement (/dpa). If you are a candidate, the agency's own privacy notice applies to you, and the agency is who you contact about your data. We help agencies answer those requests.",
      "Our customers and website visitors: for the people who use Helixon (recruiters and agency staff), and for visitors to this website, Helixon is the data controller. The rest of this notice explains both.",
    ],
  },
  {
    title: "What data is processed",
    groups: [
      {
        heading: "Candidate data (processed for agencies)",
        items: [
          "CVs and what they contain: name, contact details, location, employment history, education, skills, and anything else the candidate included",
          "The AI assessment of each CV against a role: match score, summary, strengths, concerns and suggested interview questions",
          "What recruiters record: pipeline stage, notes, tags, next actions, emails drafted or sent, talent pool details, feedback requests",
        ],
      },
      {
        heading: "Customer data (Helixon is controller)",
        items: [
          "Account details: name, email address, agency name, role in the team",
          "Billing details: plan and payment status (card details are held by Stripe, not us)",
          "Usage: analyses run, and which features are used",
          "Team presence, where the agency has it switched on: when you have Helixon open and when you last used it, plus any status you set yourself (busy, away and a short message). We never record what you click or type. You can hide your presence at any time, and the agency can switch the feature off; either way, what was recorded is deleted.",
          "Security data: IP addresses and technical logs used for rate limiting, fraud prevention and fixing errors",
        ],
      },
      {
        heading: "Website visitors",
        items: [
          "Messages you send to the website chat assistant, and details you give in contact or demo request forms",
          "Analytics about how the site is used, only if you accept optional cookies (see our Cookie Policy)",
        ],
      },
    ],
  },
  {
    title: "Why we process it, and our lawful basis",
    list: [
      "Candidate data: only to provide Helixon to the agency, on its documented instructions (Article 28). The lawful basis is the agency's - usually its legitimate interests in recruiting, or steps taken at the candidate's request before a contract. Agencies confirm they have a lawful basis each time they screen a CV, and that confirmation is recorded.",
      "Providing your account and the service you signed up for: performance of a contract (Article 6(1)(b)).",
      "Billing and keeping financial records: legal obligation (Article 6(1)(c)).",
      "Security, preventing abuse, and error monitoring: our legitimate interests in keeping Helixon safe and working (Article 6(1)(f)).",
      "Team presence: the agency's legitimate interest in knowing which colleagues are available (Article 6(1)(f)). It records only availability, not activity, can be hidden by each person and switched off by the agency.",
      "Answering enquiries and demo requests: our legitimate interests in responding to you (Article 6(1)(f)).",
      "Optional analytics and session replay: your consent (Article 6(1)(a)), which you can withdraw at any time from the cookie banner.",
    ],
  },
  {
    title: "AI assessments and automated decision-making",
    body: [
      "Helixon uses AI (Anthropic's Claude models, with Voyage AI embeddings for skill matching) to compare a CV against a role's requirements and produce a match score, summary and suggested questions. The AI is instructed to judge only job-relevant skills and experience, and never to take account of protected characteristics such as age, sex, ethnicity, religion or disability. Agencies can also screen \"blind\", which removes names, contact details and employers from what the AI sees.",
      "The assessment supports a recruiter's decision; it is not the decision. Helixon does not make decisions about candidates solely by automated means, and every report tells the recruiter to review it before acting. A candidate can ask the agency for a person to review how they were assessed, and to explain it.",
      "CVs sometimes contain special category data (for example health information, religion or a photo). It is processed only because it is in the CV; it is not used for scoring, and agencies should ask candidates not to include it.",
    ],
  },
  {
    title: "Who we share it with (sub-processors)",
    body: ["We use these providers to run Helixon. Each is bound by a data processing agreement, and none may use the data for its own purposes. We do not sell personal data, and we do not use CV data to train AI models."],
    list: [
      "Anthropic - AI analysis of CVs and job descriptions (United States)",
      "Voyage AI - skill-matching embeddings for CV analysis (United States)",
      "Google (Gemini API) - the website chat assistant (United States)",
      "Supabase - database and file storage (Zurich, Switzerland)",
      "Vercel - application hosting (United States, with a global edge network)",
      "Upstash (provisioned through Vercel) - rate limiting; holds IP addresses and account ids for up to an hour",
      "Clerk - sign-in and accounts (United States)",
      "Stripe - billing and payments (EU / United States)",
      "Resend - sending email (EU / United States)",
      "Sentry - error monitoring, and session replay only with your consent (EU - Germany)",
      "PostHog - product analytics, only with your consent (EU)",
    ],
  },
  {
    title: "International transfers",
    body: [
      "Our database is in Switzerland, which the UK and EU recognise as giving adequate protection. Where a provider processes data in the United States or another country without an adequacy decision, the transfer is covered by the UK International Data Transfer Addendum and the EU Standard Contractual Clauses (or, where the provider is certified, the UK Extension to the EU-US Data Privacy Framework), with additional safeguards such as encryption in transit and at rest. You can ask us for a copy of the relevant safeguards.",
    ],
  },
  {
    title: "How long we keep it",
    list: [
      "Candidate data: each agency sets a retention period (6, 12, 24 or 36 months; 12 by default). Candidates with no activity for that long are deleted automatically, CV files included. Talent pool entries lapse after the same period unless the agency renews them. Everything is deleted 90 days after an agency cancels its subscription. Agencies can delete any candidate at any time.",
      "Your account: while it is open. If you delete it, your name and presence details are removed from the agency's workspace, and notes or history you wrote are shown as \"Former team member\".",
      "Billing records: six years, as UK tax law requires.",
      "Team presence: overwritten as you use Helixon; deleted straight away if you hide it or the agency switches it off.",
      "Rate-limiting records: up to one hour. Error reports: up to 90 days.",
      "Website enquiries: up to two years after our last contact. Chat assistant messages are not stored by Helixon.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You have the right to access your personal data, to have it corrected or erased, to restrict or object to how it is used, to data portability, and to withdraw consent where we rely on it. You also have the right not to be subject to a decision based solely on automated processing that significantly affects you.",
      "Candidates: please contact the agency that holds your data - it is the controller and can export, correct or erase everything it holds about you in Helixon. If you contact us, we will pass your request to the agency.",
      "Helixon customers and website visitors: contact us at the address below. We will respond within one month.",
    ],
  },
  {
    title: "Complaints",
    body: [
      "If you are unhappy with how your data is handled, please contact us first so we can put it right. You also have the right to complain to the Information Commissioner's Office (ico.org.uk, 0303 123 1113), or to the data protection authority where you live or work.",
    ],
  },
  {
    title: "Security",
    body: [
      "Data is encrypted in transit and at rest. Every agency's data is kept separate and can only be reached through checks that the person asking belongs to that agency. Original CV files are held privately and only opened through links that expire after a minute. Access by Helixon staff is limited and logged.",
    ],
  },
  {
    title: "Changes to this notice",
    body: ["We will update this notice when how we handle data changes, and tell customers about significant changes by email."],
  },
  {
    title: "Contact",
    body: ["For privacy queries or to exercise your rights: hello@helixon.co.uk"],
  },
];

export default function Privacy() {
  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <MarketingNav active="privacy" />

      <section className="max-w-[900px] mx-auto px-6 pt-16 pb-14">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          Privacy Policy
        </h1>
        <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>Last updated: 29 September 2026</p>
      </section>

      <section className="max-w-[900px] mx-auto px-6 pb-24">
        <div className="rounded-[16px] p-8" style={{ background: "white", border: "1px solid var(--border)" }}>
          <div className="space-y-10">
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <h2 className="text-base font-semibold tracking-tight mb-2.5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                  {s.title}
                </h2>
                {s.body?.map((p, i) => (
                  <p key={i} className="text-xs leading-relaxed mb-2.5" style={{ color: "var(--ink-soft)" }}>{p}</p>
                ))}
                {s.contactEmail && (
                  <p className="text-xs leading-relaxed mb-2.5" style={{ color: "var(--ink-soft)" }}>
                    Contact: <a href={`mailto:${s.contactEmail}`} style={{ color: "var(--forest)", fontWeight: 600 }}>{s.contactEmail}</a>
                  </p>
                )}
                {s.groups?.map((g) => (
                  <div key={g.heading} className="mb-3">
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--ink)" }}>{g.heading}</p>
                    <ul className="space-y-1.5 list-disc pl-4">
                      {g.items.map((item) => (
                        <li key={item} className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                                {s.list && (
                  <ul className="space-y-1.5 list-disc pl-4">
                    {s.list.map((item) => (
                      <li key={item} className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}