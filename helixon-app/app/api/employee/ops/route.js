// Employees don't have Supabase Auth accounts; they log in through
// lib/employee/auth.js's own username/password + cookie-session system
// (see lib/employee/session.js). So this route uses the same employeeAccess()
// session check as every other /api/employee/* route, not a Bearer token.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { employeeAccess } from "@/lib/employee/session";
import { groupBy, classifyAcquisition } from "@/lib/ops/attribution";
import { reportError } from "@/lib/report-error";
import { fetchAll } from "@/lib/fetch-all";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  try {
    const { employeeId, forbidden } = await employeeAccess("platform", "view");
    if (forbidden) return forbidden;
    if (!employeeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = client();
    // NOTE: employees has no `email` column (see the identical note in
    // app/api/employee/shared-todos/route.js) - selecting one would make
    // this query fail on every call, which this route treats as "not an
    // employee" and answers with a 403 regardless of who is asking.
    const employee = await supabase
      .from("employees")
      .select("id,username,display_name,full_name")
      .eq("id", employeeId)
      .maybeSingle();
    if (employee.error || !employee.data) return NextResponse.json({ error: "Employee access required" }, { status: 403 });

    // Totals are counted by the database (a row pull stops at 1,000, which
    // would cap every KPI there); the breakdowns read every row.
    const count = (table) => supabase.from(table).select("id", { count: "exact", head: true });
    const [agencies, candidates, jobs, analyses, demos] = await Promise.all([
      fetchAll((from, to) => supabase.from("agencies").select("id,plan_name,analyses_used,analyses_limit").order("id").range(from, to)),
      count("candidates"),
      count("jobs"),
      count("analyses"),
      fetchAll((from, to) => supabase.from("demo_requests").select("id,utm_source,utm_medium,utm_campaign,referrer,created_at").order("id").range(from, to)),
    ]);

    return NextResponse.json({
      employee: employee.data,
      kpis: { agencies: agencies.data?.length || 0, candidates: candidates.count || 0, jobs: jobs.count || 0, analyses: analyses.count || 0, leads: demos.data?.length || 0 },
      sales: { agenciesByPlan: groupBy(agencies.data || [], x => x.plan_name || "Unknown").map(([plan,count]) => ({ plan,count })) },
      seo: { channels: groupBy((demos.data || []).map(x => ({ ...x, channel: classifyAcquisition(x) })), x => x.channel).map(([channel,count]) => ({ channel,count })) },
    });
  } catch (error) {
    reportError("Employee ops error", error);
    return NextResponse.json({ error: "Unable to load employee operations" }, { status: 500 });
  }
}
