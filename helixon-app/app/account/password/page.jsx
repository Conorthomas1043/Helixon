import { redirect } from "next/navigation";

// The Password page was folded into Security (password + 2FA + sessions).
// Kept as a redirect so any existing links/bookmarks to /account/password
// still resolve correctly instead of 404ing.
export default function PasswordRedirectPage() {
  redirect("/account/security");
}