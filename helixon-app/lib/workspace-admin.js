// Whether the signed-in member can change workspace-wide settings: the
// owner or an admin of the agency's Clerk organisation. With no team yet,
// the only member is the owner. Same rule as /dashboard/privacy.

import "server-only";
import { supabase } from "@/lib/supabase";
import { getOrgMemberRole } from "@/lib/clerk-org";

export async function canManageWorkspace(auth) {
  const { data: agency } = await supabase.from("agencies").select("clerk_org_id").eq("id", auth.agencyId).maybeSingle();
  if (!agency?.clerk_org_id) return true;
  try {
    return (await getOrgMemberRole({ orgId: agency.clerk_org_id, userId: auth.userId })) === "org:admin";
  } catch {
    return false;
  }
}

export const NOT_ADMIN = "Only the workspace owner or an admin can change these settings.";
