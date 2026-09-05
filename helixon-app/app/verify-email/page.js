import { redirect } from "next/navigation";

// Email verification is now a step inside Clerk's <SignUp/> flow
// (app/signup) itself - shown automatically as a code-entry step right
// after the account is created, rather than a separate emailed link/page.
export default function VerifyEmailPage() {
  redirect("/signup");
}
