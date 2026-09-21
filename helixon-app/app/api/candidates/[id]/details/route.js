// app/api/candidates/[id]/details/route.js
// Self-reported fields added for agency-level reporting: source of hire,
// rejection reason, placement fee/cost, and 30/90-day retention check-ins.
// One PATCH endpoint for all of them (same shape as app/api/jobs/[id]'s
// field-based PATCH) rather than one route per field, since none of them
// need independent validation complex enough to justify a route each.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";

const SOURCE_VALUES = new Set(["referral", "job_board", "linkedin", "direct_sourcing", "agency_database", "other"]);
const REJECTION_REASON_VALUES = new Set([
  "unrealistic_requirements",
  "compensation",
  "culture_fit",
  "skills_gap",
  "slow_process",
  "candidate_withdrew",
  "client_declined",
  "role_closed",
  "other",
]);
const RETENTION_VALUES = new Set(["retained", "left"]);

function cleanMoney(value) {
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined; // undefined = invalid, caller rejects
  return Math.round(n * 100) / 100;
}

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const update = {};

  if (body.source !== undefined) {
    if (body.source !== null && !SOURCE_VALUES.has(body.source)) {
      return NextResponse.json({ error: "Invalid source." }, { status: 400 });
    }
    update.source = body.source;
  }

  if (body.rejectionReason !== undefined) {
    if (body.rejectionReason !== null && !REJECTION_REASON_VALUES.has(body.rejectionReason)) {
      return NextResponse.json({ error: "Invalid rejection reason." }, { status: 400 });
    }
    update.rejection_reason = body.rejectionReason;
  }

  if (body.placementFee !== undefined) {
    const fee = cleanMoney(body.placementFee);
    if (fee === undefined) return NextResponse.json({ error: "Invalid fee amount." }, { status: 400 });
    update.placement_fee = fee;
  }

  if (body.placementCost !== undefined) {
    const cost = cleanMoney(body.placementCost);
    if (cost === undefined) return NextResponse.json({ error: "Invalid cost amount." }, { status: 400 });
    update.placement_cost = cost;
  }

  if (body.retention30d !== undefined) {
    if (body.retention30d !== null && !RETENTION_VALUES.has(body.retention30d)) {
      return NextResponse.json({ error: "Invalid 30-day retention value." }, { status: 400 });
    }
    update.retention_30d = body.retention30d;
  }

  if (body.retention90d !== undefined) {
    if (body.retention90d !== null && !RETENTION_VALUES.has(body.retention90d)) {
      return NextResponse.json({ error: "Invalid 90-day retention value." }, { status: 400 });
    }
    update.retention_90d = body.retention90d;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("candidates")
    .update(update)
    .eq("id", id)
    .eq("agency_id", agencyId)
    .select("id, source, rejection_reason, placement_fee, placement_cost, retention_30d, retention_90d")
    .maybeSingle();

  if (error) {
    console.error("[candidates/details] Update failed:", error.message);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    source: data.source,
    rejectionReason: data.rejection_reason,
    placementFee: data.placement_fee,
    placementCost: data.placement_cost,
    retention30d: data.retention_30d,
    retention90d: data.retention_90d,
  });
}
