// The /faq questions and answers. Kept out of components/FaqPage.jsx (a
// client component) so the server route can also publish them as
// FAQPage structured data for search results.
export const FAQ_GROUPS = [
  {
    group: "Getting started",
    items: [
      { q: "Is there a free trial?", a: "There isn't a free trial, but you can get a demo and see Helixon run on your own CVs before you pay anything. Plans are billed monthly with no contract, so you can cancel anytime, and every plan includes unlimited analyses from day one." },
      { q: "What file types can I upload?", a: "PDF and Word (.docx) CVs. If you're working from something else, exporting to PDF first works fine." },
      { q: "How long does an analysis take?", a: "Under a minute per CV - reading the CV, parsing the job description, analysing fit and generating the score." },
    ],
  },
  {
    group: "Scoring & accuracy",
    items: [
      { q: "How is the match score calculated?", a: "It weighs how closely a candidate's experience, skills, and seniority match what the job description asks for - not a keyword count. Equivalent experience under a different title still scores fairly." },
      { q: "Can I use my own job description instead of a preset?", a: "Yes - paste in your own job description at the analysis step and Helixon reads it the same way it reads the presets." },
      { q: "What if I disagree with a score?", a: "You can leave feedback on any analysis, which feeds into your agency's accuracy rate on the dashboard and helps you spot patterns in where the scoring runs hot or cold for your roles." },
    ],
  },
  {
    group: "Data & privacy",
    items: [
      { q: "Is my data used to train any model?", a: "No. CVs and job descriptions are processed only to generate your analysis and are never used for training." },
      { q: "Where is data stored?", a: "In Switzerland, which the UK and EU recognise as adequate, encrypted at rest and in transit, in line with GDPR. Our Data Processing Agreement has the full detail." },
      { q: "Can I delete my data?", a: "Yes - deleting your account from Account settings removes all analyses, candidates, and billing history permanently." },
    ],
  },
  {
    group: "Billing",
    items: [
      { q: "Can I cancel anytime?", a: "Yes, there's no lock-in on Individual or Agency. Cancel from Billing and you'll keep access until the end of your current billing period." },
      { q: "Is there a cap on how many analyses I can run?", a: "No - Individual and Agency plans both include unlimited analyses, with no monthly cap to track or roll over." },
      { q: "Do you offer invoicing for agencies?", a: "Agency plans can be invoiced directly - reach out via the Contact page and we'll set that up." },
    ],
  },
];
