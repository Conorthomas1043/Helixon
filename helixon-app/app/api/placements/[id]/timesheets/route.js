import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanLine, cleanText, cleanUuid } from "@/lib/sanitize";
import { weekStarting } from "@/lib/placements";

// A contractor's timesheets (weekly hours or days).
//
// POST { weekStarting, quantity, notes? }   add or replace a week
// PATCH { timesheetId, status: "approved"|"rejected", approvedBy? }
// DELETE ?timesheetId=   remove one that hasn't been invoiced

async function placement(auth, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await supabase.from("placements").select("id, kind").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle();
  return data;
}

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const p = await placement(auth, (await params).id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (p.kind !== "contract") return NextResponse.json({ error: "Timesheets are for contract placements." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const week = weekStarting(body.weekStarting);
  const quantity = Number(body.quantity);
  if (!week) return NextResponse.json({ error: "Pick the week." }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 168) return NextResponse.json({ error: "Enter the hours or days worked." }, { status: 400 });
  const { data: existing } = await supabase.from("timesheets").select("id, status").eq("placement_id", p.id).eq("week_starting", week).maybeSingle();
  if (existing?.status === "invoiced") return NextResponse.json({ error: "That week has already been invoiced." }, { status: 409 });
  const row = { quantity: Math.round(quantity * 100) / 100, notes: cleanText(body.notes, { max: 1000 }) || null, status: "submitted", approved_by: null, approved_at: null };
  const { error } = existing
    ? await supabase.from("timesheets").update(row).eq("id", existing.id)
    : await supabase.from("timesheets").insert({ ...row, agency_id: auth.agencyId, placement_id: p.id, week_starting: week, created_by: auth.userId });
  if (error) return NextResponse.json({ error: "Failed to save the timesheet." }, { status: 500 });
  return NextResponse.json({ ok: true, weekStarting: week });
}

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const p = await placement(auth, (await params).id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const tid = cleanUuid(body.timesheetId);
  if (!tid || !["approved", "rejected"].includes(body.status)) return NextResponse.json({ error: "Approve or reject a timesheet." }, { status: 400 });
  const { data, error } = await supabase
    .from("timesheets")
    .update({
      status: body.status,
      approved_by: body.status === "approved" ? cleanLine(body.approvedBy, 200) || recruiterDisplayName(auth.profile) || "Recruiter" : null,
      approved_at: body.status === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", tid)
    .eq("placement_id", p.id)
    .neq("status", "invoiced")
    .select("id");
  if (error) return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Not found, or already invoiced." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const p = await placement(auth, (await params).id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tid = cleanUuid(new URL(request.url).searchParams.get("timesheetId"));
  if (!tid) return NextResponse.json({ error: "Which timesheet?" }, { status: 400 });
  await supabase.from("timesheets").delete().eq("id", tid).eq("placement_id", p.id).neq("status", "invoiced");
  return NextResponse.json({ ok: true });
}
