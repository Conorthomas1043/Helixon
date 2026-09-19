import { rateLimit, getClientIp } from "@/lib/ratelimit";

// Receives Content-Security-Policy violation reports (the policy is currently
// report-only - see next.config.mjs). Nothing here is trusted or stored: each
// report is trimmed to a handful of short fields and written to the server log
// so it shows up in Vercel's logs, where you can see which sources the policy
// would block before turning enforcement on.
//
// Unauthenticated by necessity (browsers send reports on their own), so it's
// rate-limited, size-capped and never echoes anything back.

const MAX_BODY_BYTES = 10_000;
const MAX_REPORTS_PER_HOUR = 200;

function short(value) {
  return typeof value === "string" ? value.slice(0, 200).replace(/[\r\n]+/g, " ") : undefined;
}

export async function POST(request) {
  if (!(await rateLimit(`csp-report:${getClientIp(request)}`, MAX_REPORTS_PER_HOUR))) {
    return new Response(null, { status: 204 });
  }

  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 204 });

    const parsed = JSON.parse(text);
    // Two formats exist: {"csp-report": {...}} (report-uri) and an array of
    // {type, body} (Reporting API).
    const reports = Array.isArray(parsed) ? parsed.map((r) => r?.body) : [parsed?.["csp-report"]];

    for (const r of reports.slice(0, 5)) {
      if (!r || typeof r !== "object") continue;
      console.warn(
        "[csp-report]",
        JSON.stringify({
          directive: short(r["violated-directive"] || r.effectiveDirective),
          blocked: short(r["blocked-uri"] || r.blockedURL),
          page: short(r["document-uri"] || r.documentURL),
          source: short(r["source-file"] || r.sourceFile),
          disposition: short(r.disposition),
        }),
      );
    }
  } catch {
    // Malformed report - ignore.
  }

  return new Response(null, { status: 204 });
}
