import { loadCareersAgency, listPublicJobs } from "@/lib/public-jobs";
import { jobsFeedXml } from "@/lib/careers";
import { siteUrl } from "@/lib/mailer";

// GET /jobs/<slug>/feed.xml - the agency's published jobs as an
// Indeed-style XML feed, for job boards and aggregators that take one.
export async function GET(request, { params }) {
  const { slug } = await params;
  const agency = await loadCareersAgency(slug);
  if (!agency) return new Response("Not found", { status: 404 });
  const jobs = await listPublicJobs(agency);
  return new Response(jobsFeedXml(jobs, agency, siteUrl()), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
