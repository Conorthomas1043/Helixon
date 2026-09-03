// Isomorphic constants shared between server (lib/admin-csrf.js, Node
// `crypto`) and client code (app/admin/_shared/hooks.js) that reads the
// cookie in the browser. Kept in a separate file with zero Node-only
// imports so client components can import it without crypto ending up in
// the browser bundle — same split as admin-session.js / admin-auth.js.

export const ADMIN_CSRF_COOKIE = "helixon_admin_csrf";
export const ADMIN_CSRF_HEADER = "x-helixon-csrf";
