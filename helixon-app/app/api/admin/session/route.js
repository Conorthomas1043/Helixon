import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { adminHasTotp, isTwoFactorRequired } from "@/lib/admin-totp";
import { adminJson as json, adminErrorResponse } from "@/lib/admin-http";

// Who is signed in and how long the session has left. The console polls this
// to show the signed-in admin, warn before an idle timeout, and nudge admins
// who haven't switched on two-factor login.

function describe(session) {
  return {
    username: session.username,
    expiresAt: session.expiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
    twoFactor: adminHasTotp(session.username),
    twoFactorRequired: isTwoFactorRequired(),
    serverTime: Date.now(),
  };
}

// Read-only: deliberately does NOT extend the session. If it did, the poll
// itself would keep an abandoned tab signed in forever and the idle timeout
// would never fire.
export async function GET() {
  try {
    const session = await requireAdminSession({ refresh: false });
    return json(describe(session));
  } catch (error) {
    return adminErrorResponse("session", error);
  }
}

// "Keep me signed in": the console calls this when the admin is actually using
// it (mouse, keyboard), which is what slides the idle expiry forward.
export async function POST(request) {
  try {
    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }
    const session = await requireAdminSession({ refresh: true });
    return json(describe(session));
  } catch (error) {
    return adminErrorResponse("session", error);
  }
}
