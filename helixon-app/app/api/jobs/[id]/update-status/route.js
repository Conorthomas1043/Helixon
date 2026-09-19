// Retired. This route had no authentication and no agency check, so anyone
// could change any job's status. (It was also already failing on every call
// because it read `params` without awaiting it.) Nothing in the app calls it.
// It answers 410 Gone until the file is deleted; the original is in git
// history.
function gone() {
  return Response.json({ ok: false, error: "This endpoint has been removed." }, { status: 410 });
}

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;
