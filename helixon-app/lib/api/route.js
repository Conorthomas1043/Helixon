import "server-only";

// The one way customer API routes start: sign the member in, optionally
// check the request body against a schema, and turn anything thrown into a
// JSON error. Before this, every route repeated the same sign-in lines and
// read `request.json()` by hand.
//
//   export const POST = customerRoute(async (request, context, auth, body) => {
//     ...auth.agencyId, body.name...
//   }, { body: ClientInput });
//
// `optionalBody: true` treats a request with no body as {}.
//
// The handler gets the same (request, context) Next passes, plus the
// signed-in member's context and, with a `body` schema, the parsed body.

import { NextResponse } from "next/server";
import { requireCustomerContext } from "@/lib/customer-auth";
import { reportError } from "@/lib/report-error";

// Throw from a handler to answer with a specific status and message.
export class ApiError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function fail(status, error, extra) {
  return NextResponse.json({ error, ...extra }, { status });
}

// Reads and validates a JSON body. Returns { body } or { response } (a 400
// explaining the first problem in words a person can act on).
export async function parseBody(request, schema, { allowEmpty = false } = {}) {
  let raw;
  try {
    const textBody = await request.text();
    // Routes whose body is optional (a DELETE, a "mark all read") treat no
    // body as an empty object.
    raw = allowEmpty && !textBody.trim() ? {} : JSON.parse(textBody);
  } catch {
    return { response: fail(400, "The request body must be JSON.") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.length ? issue.path.join(".") : null;
    return { response: fail(400, field ? `${field}: ${issue.message}` : issue?.message || "Invalid request.") };
  }
  return { body: result.data };
}

export function customerRoute(handler, { body: schema, optionalBody = false, requireSubscription = false } = {}) {
  return async function route(request, context) {
    const auth = await requireCustomerContext(requireSubscription ? { requireSubscription: true } : undefined);
    if (!auth.ok) return fail(auth.status, auth.error, auth.upgrade ? { upgrade: auth.upgrade } : undefined);

    let body;
    if (schema) {
      const parsed = await parseBody(request, schema, { allowEmpty: optionalBody });
      if (parsed.response) return parsed.response;
      body = parsed.body;
    }

    try {
      return await handler(request, context, auth, body);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.status, err.message, err.extra);
      reportError(`[api] ${request.method} ${new URL(request.url).pathname} failed:`, err);
      return fail(500, "Something went wrong on our side. Please try again.");
    }
  };
}
