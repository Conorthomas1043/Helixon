import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getServicesSnapshot } from "@/lib/ops/live-services";
import { getFullHealthChecksSnapshot } from "@/lib/ops/health-checks";

// Single combined "is the site actually working" snapshot: the existing
// live-services checks (Stripe/Clerk/Redis/Resend/Sentry) plus the database
// itself, the AI providers the product runs on, and a live check that a
// curated set of public pages still return 200 - see lib/ops/health-checks.js
// for why each of those didn't already exist. Split into two files by what
// they check (paid third-party services vs this app's own infrastructure),
// merged here so the admin page/mobile tab only needs one request.
export async function GET() {
  try {
    await requireAdminSession();

    const [services, checks] = await Promise.all([getServicesSnapshot(), getFullHealthChecksSnapshot()]);

    return NextResponse.json(
      { ...services, ...checks },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin health data error", error);
    return NextResponse.json({ error: "Unable to load health data" }, { status: 500 });
  }
}
