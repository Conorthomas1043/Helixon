import { NextResponse, after } from "next/server";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { cleanEmail, cleanLine } from "@/lib/sanitize";
import { sourceFromParam } from "@/lib/careers";
import { loadPublicJob } from "@/lib/public-jobs";
import { acceptableCv, receiveApplication, screenApplication } from "@/lib/applications";

// POST (multipart) - an application from a public job page
// (components/public/ApplyForm.jsx): slug, jobId, name, email, phone?,
// linkedin?, cv, consent, src?, website (honeypot).
//
// Answers as soon as the application is safely stored; screening runs
// afterwards (lib/applications.js), so the applicant isn't kept waiting.

// Room for the screening that runs after the response.
export const maxDuration = 240;

export async function POST(request) {
  const ip = getClientIp(request);
  if (!(await rateLimit(`apply-ip:${ip}`, 10))) {
    return NextResponse.json({ error: "Too many applications from your connection - please try again later." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 400 });

  // Bots fill in the hidden field; pretend it worked.
  if (String(form.get("website") || "").trim()) return NextResponse.json({ ok: true });

  const found = await loadPublicJob(String(form.get("slug") || ""), String(form.get("jobId") || ""));
  if (!found) return NextResponse.json({ error: "This job is no longer open for applications." }, { status: 404 });

  const name = cleanLine(form.get("name"), 200);
  const email = cleanEmail(form.get("email"));
  if (!name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (form.get("consent") !== "yes") return NextResponse.json({ error: "Please confirm you've read how your data is used." }, { status: 400 });
  const file = form.get("cv");
  const fileError = acceptableCv(file);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  if (!(await rateLimit(`apply-email:${email}`, 5))) {
    return NextResponse.json({ error: "You've sent several applications recently - please try again later." }, { status: 429 });
  }

  const linkedinRaw = cleanLine(form.get("linkedin"), 200);
  const result = await receiveApplication({
    agency: found.agency,
    job: found.job,
    file,
    applicant: {
      name,
      email,
      phone: cleanLine(form.get("phone"), 40) || null,
      linkedin: /linkedin\.com\//i.test(linkedinRaw) ? linkedinRaw : null,
    },
    source: sourceFromParam(String(form.get("src") || "")),
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

  if (!result.duplicate) {
    after(() => screenApplication({ agency: found.agency, job: found.job, candidateId: result.candidateId }));
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
