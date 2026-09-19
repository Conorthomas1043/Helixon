import { NextResponse } from "next/server";

// Shared response helpers for the /api/admin/* routes.

export function adminJson(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// Turns anything thrown inside a route into a response. "Unauthorized" (from
// requireAdminSession) is a 401; everything else is logged in full on the
// server and reported to the client as a generic 500. Routes previously
// echoed `error.message` back, which leaks database/driver internals - table
// and column names, constraint names, JSON parse errors - to the browser.
export function adminErrorResponse(scope, error) {
  if (error?.message === "Unauthorized") {
    return adminJson({ error: "Unauthorized" }, 401);
  }
  console.error(`[admin/${scope}]`, error);
  return adminJson({ error: "Something went wrong. Please try again." }, 500);
}

// For a failed database call inside a handler: log the detail, return a
// generic 500 the handler can `return` directly.
export function adminDbError(scope, error) {
  console.error(`[admin/${scope}] Database error:`, error?.message || error);
  return adminJson({ error: "Something went wrong. Please try again." }, 500);
}
