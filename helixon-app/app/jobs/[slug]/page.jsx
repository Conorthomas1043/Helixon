// /jobs/<slug> - an agency's public jobs page: every published, open job.

import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCareersAgency, listPublicJobs } from "@/lib/public-jobs";
import { JobsHeader, JobsFooter } from "@/components/public/JobsChrome";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const agency = await loadCareersAgency(slug);
  if (!agency) return { title: "Jobs" };
  return {
    title: `Jobs at ${agency.name}`,
    description: agency.careers_intro?.slice(0, 160) || `Current vacancies with ${agency.name}.`,
    alternates: { types: { "application/xml": `/jobs/${slug}/feed.xml` } },
  };
}

export default async function AgencyJobsPage({ params, searchParams }) {
  const { slug } = await params;
  const { src } = await searchParams;
  const agency = await loadCareersAgency(slug);
  if (!agency) notFound();
  const jobs = await listPublicJobs(agency);
  const srcQuery = typeof src === "string" && /^[a-z0-9-]{1,40}$/i.test(src) ? `?src=${src}` : "";

  return (
    <>
      <JobsHeader agency={agency} />
      <main className="mx-auto max-w-[900px] px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          Current vacancies
        </h1>
        {agency.careers_intro && (
          <p className="text-[15px] leading-relaxed mb-8 max-w-2xl whitespace-pre-line" style={{ color: "var(--ink-soft)" }}>
            {agency.careers_intro}
          </p>
        )}
        {jobs.length === 0 ? (
          <p className="text-[15px] rounded-[14px] bg-white p-8 text-center" style={{ color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
            No open vacancies right now - check back soon.
          </p>
        ) : (
          <ul className="space-y-3">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/jobs/${slug}/${j.id}${srcQuery}`}
                  className="block rounded-[14px] bg-white p-5 transition-shadow hover:shadow-md"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <h2 className="text-[17px] font-semibold" style={{ color: "var(--ink)" }}>{j.title}</h2>
                  <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>
                    {[j.client, j.location, j.employmentType, j.salary].filter(Boolean).join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <JobsFooter agency={agency} />
    </>
  );
}
