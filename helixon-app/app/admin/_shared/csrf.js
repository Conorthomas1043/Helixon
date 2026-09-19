import { ADMIN_CSRF_COOKIE, ADMIN_CSRF_HEADER } from "@/lib/admin-csrf-constants";

// Reads the non-httpOnly helixon_admin_csrf cookie (set at login, see
// lib/admin-csrf.js) and echoes it back as a header on every mutating admin
// request. The server compares cookie === header; a cross-site attacker can make
// the browser send the cookie but can't read it to put it in the header.
// Browser-only: call it from event handlers and effects, never during render.
export function csrfHeaders(extra = {}) {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ADMIN_CSRF_COOKIE}=`));
  const token = match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
  return { ...extra, [ADMIN_CSRF_HEADER]: token };
}
