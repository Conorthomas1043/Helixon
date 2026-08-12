import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/ratelimit";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { analyseSingleCv, extractJob, estimateSalary } from "@/lib/cv-analysis";
import { isAdminUser } from "@/lib/admin-auth";

const MAX_FILES_PER_BATCH = 50;

// How many CVs to analyse in parallel. Each analyseSingleCv call does at
// least one Claude API call (often two, with salary estimation), so this
// is really an "in-flight requests" cap rather than a CPU concern. 5 is a
// safe default that's well within Anthropic's per-account rate limits
// while still cutting batch time roughly 5x vs the old sequential loop.
const CONCURRENCY = 5;

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // legacy .doc
]);

// Simple bounded-concurrency runner. Keeps result order stable (important
// since we sort/display by original index before re-sorting by score).
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, runNext);
  await Promise.all(workers);
  return results;
}

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY");
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!rateLimit(ip)) {
      return Response.json(
        { ok: false, error: "Too many requests. Please try again in an hour." },
        { status: 429 }
      );
    }

    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    const userId = user?.id || null;

    const isAdmin = await isAdminUser(request);

    const form = await request.formData();
    const files = form.getAll("cvs");
    const jobText = form.get("jobText");
    const agencyId = form.get("agencyId");

    if (!files.length || !jobText || !agencyId) {
      return Response.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES_PER_BATCH) {
      return Response.json(
        {
          ok: false,
          error: `Too many files. Please upload ${MAX_FILES_PER_BATCH} or fewer at a time.`,
        },
        { status: 400 }
      );
    }

    // Reject anything that isn't a PDF or Word doc up front, rather than
    // discovering it mid-batch as a per-file parse failure.
    const invalidFile = files.find((f) => !ACCEPTED_MIME_TYPES.has(f.type));
    if (invalidFile) {
      return Response.json(
        {
          ok: false,
          error: `"${invalidFile.name}" isn't a supported file type. Please upload PDF or Word (.docx/.doc) files only.`,
        },
        { status: 400 }
      );
    }

    if (userId && !isAdmin) {
      const { count } = await supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .single();

      const isPaid = sub?.status === "active";

      if (!isPaid && (count || 0) + files.length > 3) {
        return Response.json(
          {
            ok: false,
            upgrade: true,
            message: "This batch would exceed your 3 free analyses. Upgrade to continue.",
            analysesUsed: count,
          },
          { status: 402 }
        );
      }
    }

    const jp = await extractJob(jobText);
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        agency_id: agencyId,
        title: jp.title,
        job_text: jobText,
        parsed: jp,
      })
      .select()
      .single();

    if (jobError) throw new Error(jobError.message);

    // ── Parallel per-CV processing ───────────────────────────────────────
    // Previously this was a sequential `for...of` loop, so a 25-file batch
    // paid the full per-file latency 25 times in a row. Running these
    // concurrently (bounded so we don't blow through API rate limits) is
    // the main lever for batch speed — analysis + insert work is otherwise
    // independent per file.
    const rawResults = await runWithConcurrency(files, CONCURRENCY, async (file) => {
      const fileName = file.name || "Unknown file";
      try {
        const { cvText, extracted: ex, result } = await analyseSingleCv(file, jobText, jp);

        const salary = await estimateSalary(cvText, jobText).catch((e) => {
          console.warn("[bulk] Salary estimate failed (non-fatal):", e.message);
          return null;
        });

        const { data: cand, error: candError } = await supabase
          .from("candidates")
          .insert({
            agency_id: agencyId,
            name: ex.name,
            cv_text: cvText,
            extracted: ex,
          })
          .select()
          .single();

        if (candError) throw new Error(candError.message);

        const { error: scoreError } = await supabase.from("scores").insert({
          agency_id: agencyId,
          candidate_id: cand.id,
          job_id: job.id,
          match_score: result.match_score,
          recommendation: result.recommendation,
          result: { ...result, salary_estimate: salary },
          user_id: userId,
          source: "bulk",
        });

        if (scoreError) throw new Error(scoreError.message);

        return {
          fileName,
          name: ex.name,
          candidateId: cand.id,
          jobId: job.id,

          email: ex.email,
          phone: ex.phone,
          linkedin: ex.linkedin,
          github: ex.github,
          portfolio_url: ex.portfolio_url,
          location: ex.location,
          current_title: ex.current_title,
          current_employer: ex.current_employer,
          notice_period: ex.notice_period,
          willing_to_relocate: ex.willing_to_relocate,

          education: ex.education,
          certifications: ex.certifications,
          languages: ex.languages,
          experience_breakdown: ex.experience_breakdown,
          cv_quality_issues: ex.cv_quality_issues,

          ...result,
          salary_estimate: salary,
        };
      } catch (err) {
        return {
          fileName,
          error: true,
          errorMessage: err.message,
        };
      }
    });

    // ── Duplicate detection ──────────────────────────────────────────────
    // Done as a second pass over the settled results, since contact info
    // for every candidate now arrives roughly "at once" rather than in
    // strict sequence, and dedup doesn't need to be inline with the
    // analysis itself.
    const seenContacts = new Map(); // normalised email/phone -> first fileName seen
    const results = rawResults.map((r) => {
      if (r.error) return r;
      const emailKey = r.email?.toLowerCase().trim();
      const phoneKey = r.phone?.replace(/[\s\-()]/g, "");
      const dupKey = emailKey || phoneKey || null;
      let duplicateOf = null;
      if (dupKey) {
        if (seenContacts.has(dupKey)) {
          duplicateOf = seenContacts.get(dupKey);
        } else {
          seenContacts.set(dupKey, r.fileName);
        }
      }
      return { ...r, duplicate_of: duplicateOf };
    });

    results.sort((a, b) => {
      if (a.error && !b.error) return 1;
      if (!a.error && b.error) return -1;
      if (a.error && b.error) return 0;
      return (b.match_score || 0) - (a.match_score || 0);
    });

    return Response.json({ ok: true, results, jobId: job.id });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}