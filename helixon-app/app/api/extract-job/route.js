// Retired. This route had no authentication, called the Anthropic API on
// demand (anyone could run up the bill) and inserted rows for any agencyId
// supplied in the request. Nothing in the app calls it. It answers 410 Gone
// until the file is deleted; the original is in git history.
function gone() {
  return Response.json({ ok: false, error: "This endpoint has been removed." }, { status: 410 });
}

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;
