import { redirect } from "next/navigation";

// Password changes now go through the account security page (Clerk's
// <UserProfile/> / the /api/account/password route), not a standalone
// token-based page.
export default function UpdatePasswordPage() {
  redirect("/account/security");
}
