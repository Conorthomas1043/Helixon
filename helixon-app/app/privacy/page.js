export default function Privacy() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-stone-900">Helixon</a>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 prose prose-stone">
        <h1>Privacy Policy</h1>
        <p className="text-stone-500 text-sm">Last updated: June 2026</p>

        <h2>Who we are</h2>
        <p>
          Helixon is operated by [YOUR COMPANY NAME] Ltd, registered in England and Wales
          (Company No. [YOUR NUMBER]). We provide AI-powered CV screening and recruitment
          workflow tools to recruitment agencies.
        </p>
        <p>
          Contact: <a href="mailto:hello@helixon.co.uk">hello@helixon.co.uk</a>
        </p>

        <h2>What data we process</h2>
        <p>When recruitment agencies use Helixon we process:</p>
        <ul>
          <li>CV data submitted by the agency (candidate personal data including name, contact details, employment history, and education)</li>
          <li>Job description data submitted by the agency</li>
          <li>Usage data (analyses run, scores generated, timestamps)</li>
          <li>Account data (agency name, user email addresses)</li>
        </ul>

        <h2>Legal basis for processing</h2>
        <p>
          We process candidate CV data on behalf of our agency customers under Article 6(1)(b)
          GDPR (processing necessary for the performance of a contract) and Article 6(1)(f)
          (legitimate interests of the recruitment process).
        </p>

        <h2>How we use the data</h2>
        <p>
          CV data is processed solely to generate match scores, candidate summaries, and drafted
          communications as requested by the agency. We do not use CV data to train AI models.
          We do not sell candidate data to any third party.
        </p>

        <h2>Third party processors</h2>
        <ul>
          <li>Anthropic (Claude API) - AI processing of CV and job data</li>
          <li>Supabase - Database hosting (EU region)</li>
          <li>Vercel - Application hosting</li>
        </ul>

        <h2>Data retention</h2>
        <p>
          CV data is retained for the duration of the agency subscription plus 90 days after
          cancellation, then permanently deleted on request.
        </p>

        <h2>Your rights</h2>
        <p>
          Candidates whose data is processed have the right to access, rectify, erase, and port
          their data. Requests should be directed to the recruitment agency who submitted the
          data, who acts as the data controller.
        </p>

        <h2>Contact</h2>
        <p>For privacy queries: hello@helixon.co.uk</p>
      </div>
    </main>
  );
}