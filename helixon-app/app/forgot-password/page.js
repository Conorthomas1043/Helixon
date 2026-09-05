import { redirect } from "next/navigation";

// Clerk's <SignIn/> (app/login) includes a "Forgot password?" link and
// handles the whole reset flow itself - there's no separate page needed.
export default function ForgotPasswordPage() {
  redirect("/login");
}
