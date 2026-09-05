import { SignIn } from "@clerk/nextjs";

// Clerk's hosted <SignIn/> replaces the old custom login/page.js +
// api/auth/login + api/auth/mfa-verify. reCAPTCHA/bot-detection, rate
// limiting, "forgot password", email/TOTP MFA, and "remember me" session
// duration are all built into Clerk and configured from the Clerk
// dashboard (User & Authentication) rather than in this app's code.
//
// The [[...rest]] catch-all route is required by Clerk - the component
// needs sub-paths for its own internal steps (password reset, MFA
// challenge, SSO callback, etc).
export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--mist, #f4f7f5)" }}
    >
      <SignIn path="/login" signUpUrl="/signup" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
