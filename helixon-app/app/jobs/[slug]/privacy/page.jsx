// /jobs/<slug>/privacy - the agency's privacy notice for applicants,
// linked from the application form (lib/privacy-notice.js).

import { notFound } from "next/navigation";
import { agencyNotice, loadCareersAgency } from "@/lib/public-jobs";
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
        <article className="rounded-[14px] bg-white p-6 sm:p-8" style={{ border: "1px solid var(--border)" }}>
          <h1 className="text-2xl font-semibold mb-5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            {heading}
          </h1>
          {paras.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed mb-4 whitespace-pre-line" style={{ color: "var(--ink-soft)" }}>
              {p}
            </p>
          ))}
        </article>
      </main>
      <JobsFooter agency={agency} />
    </>
  );
}
