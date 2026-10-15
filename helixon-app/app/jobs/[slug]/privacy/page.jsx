// /jobs/<slug>/privacy - the agency's privacy notice for applicants,
// linked from the application form (lib/compliance/privacy-notice.js).

import { notFound } from "next/navigation";
import { agencyNotice, loadCareersAgency } from "@/lib/jobs/public-jobs";
import { JobsHeader, JobsFooter } from "@/components/public/JobsChrome";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const agency = await loadCareersAgency(slug);
  return { title: agency ? `Privacy notice | ${agency.name}` : "Privacy notice" };
}

export default async function AgencyPrivacyPage({ params }) {
  const { slug } = await params;
  const agency = await loadCareersAgency(slug);
  if (!agency) notFound();
  const [heading, ...paras] = agencyNotice(agency).split("\n\n");
  return (
    <>
      <JobsHeader agency={agency} />
      <main className="mx-auto max-w-[760px] px-4 sm:px-6 py-10">
        <article className="rounded-card bg-white p-6 sm:p-8 border border-[var(--border)]">
          <h1 className="text-2xl font-semibold mb-5 text-[var(--ink)] font-display">
            {heading}
          </h1>
          {paras.map((p, i) => (
            <p key={i} className="text-15 leading-relaxed mb-4 whitespace-pre-line text-[var(--ink-soft)]">
              {p}
            </p>
          ))}
        </article>
      </main>
      <JobsFooter agency={agency} />
    </>
  );
}
