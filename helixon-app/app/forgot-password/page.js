import { redirect } from "next/navigation";
export default function ForgotPasswordPage() {
  // ?intent=reset tells /login to show a hint pointing at Clerk's built-in
  // "Forgot password?" link, since this page has no reset form of its own -
  // landing bare on the sign-in form was otherwise unexplained.
  redirect("/login?intent=reset");
}