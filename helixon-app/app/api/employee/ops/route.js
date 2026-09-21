// Previously this route authenticated via a Supabase Auth Bearer token and
// looked the caller up by employees.email - but employees don't have
// Supabase Auth accounts; they log in through lib/employee-auth.js's own
// username/password + cookie-session system (see lib/session.js). That
// mismatch meant this route could never actually be called: it 403'd
// unconditionally (see the same fix already applied to
// app/api/employee/shared-todos/route.js). Its frontend read a token from
// window.__HELIXON_ACCESS_TOKEN__, which nothing in the app ever sets -
// confirming the whole path was orphaned. Rewritten to use the same
// getCurrentEmployeeId() session check every other /api/employee/* route
// uses.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentEmployeeId } from "@/lib/session";
import { groupBy, classifyAcquisition } from "@/lib/ops/attribution";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  try {
    const employeeId = await getCurrentEmployeeId();
    if (!employeeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = client();
    // NOTE: employees has no `email` column (see the identical note in
    // app/api/employee/shared-todos/route.js) - selecting one here used to
    // make this query fail on every single call, which this route treated
    // as "not an employee" and answered with a 403 regardless of who was
    // asking. That made /employee/ops permanently broken for everyone.
    const employee = await supabase
      .from("employees")
      .select("id,username,display_name,full_name")
      .eq("id", employeeId)
      .maybeSingle();
    if (employee.error || !employee.data) return NextResponse.json({ error: "Employee access required" }, { status: 403 });

    const [agencies, candidates, jobs, analyses, demos] = await Promise.all([
      supabase.from("agencies").select("id,plan_name,analyses_used,analyses_limit").limit(1000),
      supabase.from("candidates").select("id").limit(1000),
      supabase.from("jobs").select("id").limit(1000),
      supabase.from("analyses").select("id").limit(1000),
      supabase.from("demo_requests").select("utm_source,utm_medium,utm_campaign,referrer,created_at").limit(1000),
    ]);

    return NextResponse.json({
      employee: employee.data,
      kpis: { agencies: agencies.data?.length || 0, candidates: candidates.data?.length || 0, jobs: jobs.data?.length || 0, analyses: analyses.data?.length || 0, leads: demos.data?.length || 0 },
      sales: { agenciesByPlan: groupBy(agencies.data || [], x => x.plan_name || "Unknown").map(([plan,count]) => ({ plan,count })) },
      seo: { channels: groupBy((demos.data || []).map(x => ({ ...x, channel: classifyAcquisition(x) })), x => x.channel).map(([channel,count]) => ({ channel,count })) },
    });
  } catch (error) {
    console.error("Employee ops error", error);
    return NextResponse.json({ error: "Unable to load employee operations" }, { status: 500 });
  }
}
