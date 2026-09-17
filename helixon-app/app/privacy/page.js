import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

const SECTIONS = [
  {
    title: "Who we are",
    body: [
      "Helixon is operated by [YOUR COMPANY NAME] Ltd, registered in England and Wales (Company No. [YOUR NUMBER]). We provide AI-powered CV screening and recruitment workflow tools to recruitment agencies.",
    ],
    contactEmail: "hello@helixon.co.uk",
  },
  {
    title: "What data we process",
    body: ["When recruitment agencies use Helixon we process:"],
    list: [
      "CV data submitted by the agency (candidate personal data including name, contact details, employment history, and education)",
      "Job description data submitted by the agency",
      "Usage data (analyses run, scores generated, timestamps)",
      "Account data (agency name, user email addresses)",
    ],
  },
  {
    title: "Legal basis for processing",
    body: [
      "We process candidate CV data on behalf of our agency customers under Article 6(1)(b) GDPR (processing necessary for the performance of a contract) and Article 6(1)(f) (legitimate interests of the recruitment process).",
    ],
  },
  {
    title: "How we use the data",
    body: [
      "CV data is processed solely to generate match scores, candidate summaries, and drafted communications as requested by the agency. We do not use CV data to train AI models. We do not sell candidate data to any third party.",
    ],
  },
  {
    title: "Third party processors",
    list: [
      "Anthropic (Claude API) - AI processing of CV and job data",
      "Supabase - Database hosting (EU region)",
      "Vercel - Application hosting",
    ],
  },
  {
    title: "Data retention",
    body: [
      "CV data is retained for the duration of the agency subscription plus 90 days after cancellation, then permanently deleted on request.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "Candidates whose data is processed have the right to access, rectify, erase, and port their data. Requests should be directed to the recruitment agency who submitted the data, who acts as the data controller.",
    ],
  },
  {
    title: "Contact",
    body: ["For privacy queries: hello@helixon.co.uk"],
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
        <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>Last updated: June 2026</p>
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