// Retired. This route had no authentication and trusted an agencyId from the
// request while using the service-role database client. Nothing in the app
// calls it (candidate notes now live at /api/candidates/[id]/notes, which is
// authenticated and agency-scoped). It answers 410 Gone until the file is
// deleted; the original is in git history.
function gone() {
  return Response.json({ ok: false, error: "This endpoint has been removed." }, { status: 410 });
}

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;
