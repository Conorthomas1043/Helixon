// Reading a JSON request body against a schema (lib/api/schemas.js). Used by
// customerRoute (lib/api/route.js) and by routes that read the body
// themselves - admin, staff portal, public links, webhooks.

import { NextResponse } from "next/server";

export function fail(status, error, extra) {
  return NextResponse.json({ error, ...extra }, { status });
}

// Reads and validates a JSON body. Returns { body } or { response } (a 400
// explaining the first problem in words a person can act on). `respond`
// builds that response; the public API passes its own error shape.
export async function parseBody(request, schema, { allowEmpty = false, respond = fail } = {}) {
  let raw;
  try {
    const textBody = await request.text();
    // Routes whose body is optional (a DELETE, a "mark all read") treat no
    // body as an empty object.
    raw = allowEmpty && !textBody.trim() ? {} : JSON.parse(textBody);
  } catch {
    return { response: respond(400, "The request body must be JSON.") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.length ? issue.path.join(".") : null;
    return { response: respond(400, field ? `${field}: ${issue.message}` : issue?.message || "Invalid request.") };
  }
  return { body: result.data };
}
