"use client";

import { useState } from "react";
import { SignUp } from "@clerk/nextjs";

// Replaces the old 4-step custom wizard (app/signup/page.jsx) +
// api/auth/signup + api/auth/verify-email + api/auth/resend-confirmation +
// api/auth/username-available. Clerk's hosted <SignUp/> now owns
// email/password/username collection, password strength rules, bot
// protection, and email verification (a code step, shown automatically).
//
// "Agency name" isn't a field Clerk knows about, so it's still collected
// here first and passed through as `unsafeMetadata`. The webhook at
// app/api/webhooks/clerk/route.js reads it back out once the account is
// actually created and creates the `agencies` + `profiles` rows - the
// same two inserts app/api/auth/signup/route.js used to do inline.
//
// One-time setup needed in the Clerk dashboard (User & Authentication):
// enable "Username" and "Name" (first/last) as required fields, so Clerk
// collects those itself instead of this app needing to.
export default function SignupPage() {
  const [agencyName, setAgencyName] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--mist, #f4f7f5)" }}
    >
      {!confirmed ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (agencyName.trim()) setConfirmed(true);
          }}
          className="w-full max-w-sm rounded-[16px] p-8 bg-white"
          style={{ border: "1px solid var(--border, #e2e8e5)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--forest, #0b6e4f)" }}>
            01 · Agency
          </p>
          <h1 className="text-xl font-semibold mb-4" style={{ color: "#13201b" }}>
            What&apos;s your agency called?
          </h1>
          <input
            autoFocus
            required
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Agency name"
            className="w-full rounded-[10px] px-3.5 py-3 mb-4 outline-none text-sm"
            style={{ border: "1.5px solid var(--border, #e2e8e5)" }}
          />
          <button
            type="submit"
            className="w-full rounded-full py-3 text-sm font-medium text-white"
            style={{ background: "var(--forest, #0b6e4f)" }}
          >
            Continue
          </button>
        </form>
      ) : (
        <SignUp
          path="/signup"
          signInUrl="/login"
          fallbackRedirectUrl="/dashboard"
          unsafeMetadata={{ agencyName: agencyName.trim() }}
        />
      )}
    </div>
  );
}
