import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { loadClient, logClientActivity } from "@/lib/clients";
import { cleanNextAction } from "@/lib/opportunities";
import { agencyDb } from "@/lib/agency-db";

// A follow-up on a client - the same idea as a candidate's next action.
// PATCH { label, dueAt }      set it
// PATCH { completed: true }   done (logged on the client's timeline)
export const PATCH = customerRoute(async (request, { params }, auth, input) => {
  const { id } = await params;
  const client = await loadClient(auth.agencyId, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const body = input;

  if (body.completed === true) {
    const { error } = await (await agencyDb()).from("clients").update({ next_action: null }).eq("id", client.id).eq("agency_id", auth.agencyId);
    if (error) return NextResponse.json({ error: "Failed to complete the follow-up." }, { status: 500 });
    if (client.next_action?.label) await logClientActivity(auth.agencyId, client.id, "next_action_completed", actor, { note: client.next_action.label });
    return NextResponse.json({ nextAction: null });
  }

  const { nextAction, error: invalid } = cleanNextAction(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const withOwner = { ...nextAction, ownerId: client.owner_id || auth.userId };
  const { error } = await (await agencyDb()).from("clients").update({ next_action: withOwner }).eq("id", client.id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to save the follow-up." }, { status: 500 });
  return NextResponse.json({ nextAction: withOwner });
}, { body: JsonObject, optionalBody: true });
