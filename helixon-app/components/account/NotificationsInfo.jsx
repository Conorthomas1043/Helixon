"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Toggle } from "@/components/account/ui";

// The "Notifications" tab: the optional emails - the weekday follow-up
// reminder (app/api/cron/reminders), new-application alerts from the jobs
// page (lib/applications.js) and the weekly analytics summary
// (app/api/cron/analytics-digest). Everything else Helixon sends is
// transactional (sign-in and verification, team invitations, billing
// receipts, and emails a recruiter sends from inside the app) and can't be
// turned off because the account needs it.
export default function NotificationsInfo() {
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/notifications", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setPrefs(d);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your preferences.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function change(key, value) {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/account/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPrefs(previous);
      setError("Couldn't save that - please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-10">
      <h3 className="text-[17px] font-semibold text-[#10221d]">Emails you can switch off</h3>
      <div className="mt-4 max-w-[560px] space-y-4" aria-busy={prefs === null || saving}>
        {prefs === null && !error && <p className="text-[14px] text-[#638279]">Loading…</p>}
        {prefs && (
          <>
            <Toggle
              id="follow-up-reminders"
              checked={prefs.followUpReminders}
              onChange={(v) => change("followUpReminders", v)}
              label="Follow-up reminders"
              description="A short email on weekday mornings listing the follow-ups, talent-pool check-ins and interviews due on candidates assigned to you. Nothing is sent when nothing is due."
            />
            <Toggle
              id="application-alerts"
              checked={prefs.applicationAlerts}
              onChange={(v) => change("applicationAlerts", v)}
              label="New applications"
              description="An email when someone applies through your jobs page for a job you own, with their match score."
            />
            <Toggle
              id="weekly-digest"
              checked={prefs.weeklyDigest}
              onChange={(v) => change("weeklyDigest", v)}
              label="Weekly analytics summary"
              description="A Monday-morning email with your agency's last 7 days - candidates analysed, placements, fees and conversion - against the week before. Off unless you switch it on."
            />
          </>
        )}
        {error && <p className="mt-2 text-[14px] text-[#b42318]">{error}</p>}
      </div>

      <h3 className="mt-8 text-[17px] font-semibold text-[#10221d]">Everything else</h3>
      <p className="mt-2 max-w-[560px] text-[14px] leading-6 text-[#638279]">
        Helixon doesn&apos;t send marketing emails. The rest of what you get from us is the essential kind - sign-in and
        verification messages, team invitations, and billing receipts - and those can&apos;t be turned off because the
        account needs them. Want another notification? Tell us via the{" "}
        <Link href="/contact" className="font-semibold text-[#087a5b] hover:underline">
          contact page
        </Link>
        .
      </p>
    </div>
  );
}
