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

import { requireCustomerContext } from "@/lib/customer-auth";
import { reportError } from "@/lib/report-error";
import { fail, parseBody } from "@/lib/api/body";

export { fail, parseBody };

// Throw from a handler to answer with a specific status and message.
export class ApiError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/**
 * @param {(request: Request, context: any, auth: any, body?: any) => Promise<Response>} handler
 * @param {{ body?: import("zod").ZodType, optionalBody?: boolean, requireSubscription?: boolean }} [options]
 */
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
