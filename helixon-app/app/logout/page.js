import { redirect } from "next/navigation";

// Clerk's "Signing Out" path (dashboard > Configure > Paths) points here, and
// nothing existed at /logout, so any sign-out that used that setting landed on
// a 404. By the time someone reaches this page Clerk has already ended their
// session, so all that's left is to send them to the sign-in page.
export const metadata = { robots: { index: false } };

export default function LogoutPage() {
  redirect("/login");
}
