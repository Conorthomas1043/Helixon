import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { getAgencyPlan } from "@/lib/plan";

// Returns the currently signed-in user (email + first name from `profiles`,
// plus isAdmin), or 401 if there's no valid session. Used by the dashboard
// to personalize the header/account menu and to drive the one-time
// "Welcome back" banner after login.
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress || null;

  let firstName = null;
  let agencyName = null;
  let plan = null;
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, agency_id")
      .eq("clerk_user_id", userId)
      .maybeSingle();
    if (error) throw error;
    firstName = profile?.first_name || user?.firstName || null;

    if (profile?.agency_id) {
      const [{ data: agency }, resolvedPlan] = await Promise.all([
        supabaseAdmin.from("agencies").select("name").eq("id", profile.agency_id).maybeSingle(),
        getAgencyPlan(profile.agency_id),
      ]);
      agencyName = agency?.name || null;
      plan = resolvedPlan;
    }
  } catch (e) {
    console.error("[auth/me] Profile lookup failed (non-fatal):", e.message);
  }

  // NOTE: `admins.user_id` used to store the Supabase auth uuid. Going
  // forward it needs to store the Clerk user id instead for this check to
  // keep matching anyone - update any existing rows accordingly.
  let isAdmin = false;
  try {
    const { data: adminRow } = await supabaseAdmin
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    isAdmin = !!adminRow;
  } catch (e) {
    console.error("[auth/me] Admin lookup failed (non-fatal):", e.message);
  }

  return NextResponse.json({
    ok: true,
    user: { id: userId, email, firstName, isAdmin, agencyName, plan },
  });
}
