import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { MERGE_FIELDS } from "@/lib/email-merge";
import { cleanTemplate, toTemplate } from "@/lib/email-templates";
import { inboundDomain } from "@/lib/tracked-email";
import { agencyDb } from "@/lib/agency-db";

// The agency's email templates (lib/email-merge.js for merge fields).
//
// GET                                          templates + the merge fields
// POST { name, audience?, subject, body }      create one

export const GET = customerRoute(async (_request, _context, auth) => {
  const { data, error } = await (await agencyDb()).from("email_templates").select("*").eq("agency_id", auth.agencyId).order("name");
  if (error) return NextResponse.json({ error: "Failed to load templates." }, { status: 500 });
  return NextResponse.json({
    templates: (data ?? []).map(toTemplate),
    mergeFields: MERGE_FIELDS,
    // Whether replies are captured onto candidates' threads (lib/tracked-email.js).
    repliesCaptured: Boolean(inboundDomain() && process.env.RESEND_WEBHOOK_SECRET),
  });
});

export const POST = customerRoute(async (request, _context, auth, body) => {
  const fields = cleanTemplate(body);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  const { data, error } = await (await agencyDb())
    .from("email_templates")
    .insert({ ...fields, agency_id: auth.agencyId, created_by: auth.userId })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save the template." }, { status: 500 });
  return NextResponse.json({ template: toTemplate(data) }, { status: 201 });
}, { body: JsonObject, optionalBody: true });
