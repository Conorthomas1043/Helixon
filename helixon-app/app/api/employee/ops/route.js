import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { groupBy, classifyAcquisition } from "../../../../lib/ops/attribution";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = client();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = userData.user.email.toLowerCase();
    const employee = await supabase.from("employees").select("id,email,linked_test_user_id").ilike("email", email).maybeSingle();
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
