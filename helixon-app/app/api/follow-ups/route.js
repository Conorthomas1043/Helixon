import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { resolveRecruiterNames } from "@/lib/recruiter-directory";
import { followUpItems } from "@/lib/follow-ups";

// GET ?scope=mine|all&tz= - open follow-ups (lib/follow-ups.js): candidates'
// next actions and talent-pool check-ins, most urgent first. "mine" is the
// candidates assigned to the caller. `tz` is the browser's time zone, so
// "today" is the recruiter's today.

const LIMIT = 500;

function validTimeZone(tz) {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const params = new URL(request.url).searchParams;
  const mine = params.get("scope") !== "all";
  const timeZone = validTimeZone(params.get("tz")) || "UTC";

  let query = supabase
    .from("candidates")
    .select("id, full_name, name, recruiter_id, next_action, talent_pool_at, talent_pool_check_in, jobs(title)")
    .eq("agency_id", auth.agencyId)
    .or("next_action.not.is.null,talent_pool_check_in.not.is.null")
    .limit(LIMIT);
  if (mine) query = query.eq("recruiter_id", auth.userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load follow-ups." }, { status: 500 });

  const items = followUpItems(data, new Date(), timeZone);
  const names = await resolveRecruiterNames(supabase, items.map((i) => i.recruiterId));
  return NextResponse.json({
    items: items.map((i) => ({ ...i, recruiterName: names.get(i.recruiterId) ?? null })),
    truncated: (data ?? []).length >= LIMIT,
  });
}
