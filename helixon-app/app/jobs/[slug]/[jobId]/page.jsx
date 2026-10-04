// /jobs/<slug>/<jobId> - one advertised job and its application form.
// Carries schema.org JobPosting data so Google for Jobs can list it, and
// counts visits from tracked links (?src=) against the job's sourcing
// channels.

import { after } from "next/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { loadPublicJob, recordChannelVisit } from "@/lib/public-jobs";
import { jobPostingJsonLd, sourceFromParam } from "@/lib/careers";
import { rateLimit } from "@/lib/ratelimit";
import { siteUrl } from "@/lib/mailer";
import ApplyForm from "@/components/public/ApplyForm";
import { JobsHeader, JobsFooter } from "@/components/public/JobsChrome";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug, jobId } = await params;
  const found = await loadPublicJob(slug, jobId);
  if (!found) return { title: "Job not found" };
  const { agency, publicJob } = found;
  return {
    title: `${publicJob.title}${publicJob.location ? ` - ${publicJob.location}` : ""} | ${agency.name}`,
    description: publicJob.description.slice(0, 160),
    openGraph: { title: publicJob.title, description: publicJob.description.slice(0, 200) },
  };
}

export default async function PublicJobPage({ params, searchParams }) {
  const { slug, jobId } = await params;
  const { src } = await searchParams;
  const found = await loadPublicJob(slug, jobId);
  if (!found) notFound();
  const { agency, job, publicJob } = found;
  const source = sourceFromParam(typeof src === "string" ? src : "");

  if (source.detail) {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    after(async () => {
      if (await rateLimit(`job-visit:${ip}:${job.id}`, 5)) await recordChannelVisit(agency.id, job.id, source.source);
    });
  }

  const url = `${siteUrl()}/jobs/${slug}/${job.id}`;
  const ld = jobPostingJsonLd(publicJob, agency, url);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <JobsHeader agency={agency} />
      <main className="mx-auto max-w-[900px] px-4 sm:px-6 py-10 space-y-6">
        <Link href={`/jobs/${slug}`} className="text-[13px] underline" style={{ color: "var(--ink-soft)" }}>
          ← All vacancies
        </Link>
        <article className="rounded-[14px] bg-white p-6 sm:p-8" style={{ border: "1px solid var(--border)" }}>
          <h1 className="text-3xl font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            {publicJob.title}
          </h1>
          <p className="text-[14px] mt-2" style={{ color: "var(--ink-soft)" }}>
            {[publicJob.client, publicJob.location, publicJob.employmentType, publicJob.seniority, publicJob.salary].filter(Boolean).join(" · ")}
          </p>
          {/* The form sits below the full description; on a phone that's a
              long scroll before an applicant sees any way to apply. */}
          <a
            href="#apply"
            className="inline-flex items-center justify-center mt-5 min-h-[44px] text-[14px] font-semibold px-6 rounded-full"
            style={{ background: "var(--forest)", color: "white" }}
          >
            Apply for this job
          </a>
          <div className="mt-6 text-[15px] leading-relaxed whitespace-pre-line" style={{ color: "var(--ink)" }}>
            {publicJob.description}
          </div>
        </article>
        <ApplyForm slug={slug} jobId={job.id} jobTitle={publicJob.title} src={source.detail} agencyName={agency.name} />
      </main>
      <JobsFooter agency={agency} />
    </>
  );
}
