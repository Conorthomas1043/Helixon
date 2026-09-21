// app/api/jobs/[id]/channels/route.js
// Manually-logged sourcing-channel spend/clicks for one job - see
// job_channels' migration comment. Combined agency-wide with
// candidates.source in app/api/analytics/timing for apply rate and cost
// per applicant. Helixon doesn't run job ads itself, so these numbers
// come from whatever the recruiter sees in their job board/LinkedIn
// campaign dashboard.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";

const CHANNEL_VALUES = new Set(["referral", "job_board", "linkedin", "direct_sourcing", "agency_database", "other"]);

async function assertOwnsJob(agencyId, jobId) {
  const { data } = await supabase.from("jobs").select("id").eq("id", jobId).eq("agency_id", agencyId).maybeSingle();
  return !!data;
}

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  if (!(await assertOwnsJob(agencyId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("job_channels")
    .select("id, channel, clicks, spend, updated_at")
    .eq("job_id", id)
    .order("channel", { ascending: true });

  if (error) {
    console.error("[jobs/channels] Query failed:", error.message);
    return NextResponse.json({ error: "Failed to load channels." }, { status: 500 });
  }

  return NextResponse.json({ channels: data || [] });
}

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId } = auth;
  const { id } = await params;

  if (!(await assertOwnsJob(agencyId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const channel = body?.channel;
  if (!CHANNEL_VALUES.has(channel)) {
    return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  }
  const clicks = Number(body?.clicks);
  const spend = Number(body?.spend);
  if (!Number.isFinite(clicks) || clicks < 0 || !Number.isFinite(spend) || spend < 0) {
    return NextResponse.json({ error: "Clicks and spend must be non-negative numbers." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("job_channels")
    .upsert(
      {
        agency_id: agencyId,
        job_id: id,
        channel,
        clicks: Math.round(clicks),
        spend: Math.round(spend * 100) / 100,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "job_id,channel" },
    )
    .select("id, channel, clicks, spend, updated_at")
    .single();

  if (error) {
    console.error("[jobs/channels] Upsert failed:", error.message);
    return NextResponse.json({ error: "Failed to save channel data." }, { status: 500 });
  }

  return NextResponse.json({ channel: data });
}
