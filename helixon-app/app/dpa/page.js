export default function DPA() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-stone-900">Helixon</a>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">
          Data Processing Agreement
        </h1>
        <p className="text-stone-500 text-sm mb-8">
          For agencies requiring a formal DPA, please email hello@helixon.co.uk and we will
          send a signed copy within one working day.
        </p>

        <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6 text-sm text-stone-700 space-y-4">
          <p><strong>Between:</strong> [Agency Name] (Data Controller)</p>
          <p><strong>And:</strong> [Your Company Name] Ltd (Data Processor)</p>

          <h2 className="text-base font-bold text-stone-900 mt-4">1. Subject matter</h2>
          <p>
            The Processor provides CV screening and recruitment workflow services to the
            Controller via the Helixon platform.
          </p>

          <h2 className="text-base font-bold text-stone-900">2. Nature of processing</h2>
          <p>
            Processing candidate CV data to generate match scores, summaries, and draft
            communications on documented instruction of the Controller.
          </p>

          <h2 className="text-base font-bold text-stone-900">3. Types of personal data</h2>
          <p>
            Name, contact details, employment history, education, skills, and any other
            information contained in submitted CVs.
          </p>

          <h2 className="text-base font-bold text-stone-900">4. Processor obligations</h2>
          <p>
            The Processor shall: process personal data only on documented instructions; ensure
            appropriate technical and organisational security measures; not engage sub-processors
            without prior written consent; delete or return all personal data upon termination
            of services; assist the Controller in fulfilling data subject rights requests.
          </p>

          <h2 className="text-base font-bold text-stone-900">5. Sub-processors</h2>
          <p>
            Current sub-processors: Anthropic (AI processing), Supabase (database, EU region),
            Vercel (hosting). Full list maintained at helixon.co.uk/privacy.
          </p>

          <h2 className="text-base font-bold text-stone-900">6. Duration</h2>
          <p>For the term of the subscription agreement.</p>
        </div>

        {/* Contact prompt for agencies that need a signed copy */}
        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
          <p className="text-emerald-800 font-medium mb-1">Need a signed DPA?</p>
          <p className="text-emerald-700">
            Email{" "}
            <a href="mailto:hello@helixon.co.uk" className="underline">
              hello@helixon.co.uk
            </a>{" "}
            with your agency name and we will send a countersigned copy within one working day.
          </p>
        </div>
      </div>
    </main>
  );
}