import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/auth/customer-auth";
import { addAgencyTag, getAgencyTags, removeAgencyTag } from "@/lib/agency/tags";
import { fields, text } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const TagCreateInput = fields({ label: text(120) });

// The agency's candidate tags (lib/agency/tags.js).
// GET               built-in + the agency's own
// POST { label }    add one of the agency's own
// DELETE ?id=       delete one of the agency's own (and untag everyone)

async function authed() {
  const auth = await requireCustomerContext();
  return auth.ok ? { auth } : { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
}

export async function GET() {
  const { auth, response } = await authed();
  if (response) return response;
  try {
    return NextResponse.json({ tags: await getAgencyTags(supabase, auth.agencyId) });
  } catch {
    return NextResponse.json({ error: "Couldn't load tags." }, { status: 500 });
  }
}

export async function POST(request) {
  const { auth, response } = await authed();
  if (response) return response;
  const parsedBody = await parseBody(request, TagCreateInput, { allowEmpty: true });
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.body;
  try {
    const result = await addAgencyTag(supabase, auth.agencyId, body?.label);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ tag: result.tag });
  } catch {
    return NextResponse.json({ error: "Couldn't create the tag." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { auth, response } = await authed();
  if (response) return response;
  const id = new URL(request.url).searchParams.get("id") || "";
  try {
    const result = await removeAgencyTag(supabase, auth.agencyId, id);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Couldn't delete the tag." }, { status: 500 });
  }
}
