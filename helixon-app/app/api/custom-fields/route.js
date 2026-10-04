import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidates/activity";
import { cleanUuid } from "@/lib/sanitize";
import { ENTITY_TABLES, cleanFieldValues, fieldsFor, normaliseCustomisation } from "@/lib/custom-fields";

// PATCH { entity: "candidate"|"job"|"client", id, values: { fieldId: value } }
// Sets custom field values on one record; a blank removes one.

export const PATCH = customerRoute(async (request, _context, auth, body) => {
  const table = ENTITY_TABLES[body.entity];
  const id = cleanUuid(body.id);
  if (!table || !id || !body.values || typeof body.values !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const [{ data: agency }, { data: row }] = await Promise.all([
    supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle(),
    supabase.from(table).select("id, custom_fields").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle(),
  ]);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { customFields } = normaliseCustomisation(agency?.settings);
  const result = cleanFieldValues(customFields, body.entity, body.values, row.custom_fields);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  const { error } = await supabase.from(table).update({ custom_fields: result.values }).eq("id", id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });

  if (body.entity === "candidate") {
    const labels = fieldsFor(customFields, "candidate")
      .filter((f) => f.id in body.values)
      .map((f) => f.label);
    if (labels.length) await logActivity(supabase, id, "details_updated", recruiterDisplayName(auth.profile) || auth.userId, { note: `Updated ${labels.join(", ")}` });
  }
  return NextResponse.json({ values: result.values });
}, { body: JsonObject, optionalBody: true });
