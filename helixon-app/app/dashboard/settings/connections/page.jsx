"use client";

// /dashboard/settings/connections - your interviews in your own calendar
// (a subscribable feed) and logging emails sent from your own inbox by BCC
// (app/api/connections, lib/member-tokens.js). Personal to each member.

import { useEffect, useState } from "react";
import { Button, Card, ErrorText, LoadingCard, Page, PageHeader, TextInput, INK, INK_MUTED } from "@/components/dashboard/ui";

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--ink-faint)" }}>{label}</p>
      <div className="flex gap-2">
        <TextInput readOnly value={value} onFocus={(e) => e.target.select()} aria-label={label} />
        <Button
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/connections", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then(setData)
      .catch(() => setError("Couldn't load your connections."));
  }, []);

  async function rotate(purpose) {
    if (!window.confirm(purpose === "calendar" ? "Make a new feed address? Calendars subscribed to the old one stop updating." : "Make a new BCC address? The old one stops working.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/connections", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, rotate: true }) });
      if (!res.ok) throw new Error("Couldn't do that.");
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page width={800}>
      <PageHeader back={{ href: "/dashboard/settings", label: "Settings" }} eyebrow="You" title="Calendar & email" subtitle="Personal to you - your teammates have their own." />
      <ErrorText>{error}</ErrorText>
      {!data && !error && <LoadingCard rows={3} />}
      {data?.unavailable && (
        <Card>
          <p className="text-[13px]" style={{ color: INK_MUTED }}>These need a database update first (migration 20261003020000).</p>
        </Card>
      )}
      {data && !data.unavailable && (
        <>
          <Card title="Interviews in your calendar">
            <p className="text-[13px] mb-4" style={{ color: INK_MUTED }}>
              Subscribe once and every interview you&apos;ve booked - or that&apos;s for your candidates - appears in your own calendar, and moves or disappears when it&apos;s rescheduled or cancelled. Calendars refresh it every few hours.
            </p>
            <div className="space-y-4">
              <CopyRow label="Your interviews" value={data.calendarUrl} />
              <CopyRow label="Whole team's interviews" value={data.calendarTeamUrl} />
            </div>
            <ul className="text-[12px] mt-4 space-y-1 list-disc pl-5" style={{ color: INK_MUTED }}>
              <li><strong style={{ color: INK }}>Google Calendar:</strong> Other calendars → + → From URL, and paste the address.</li>
              <li><strong style={{ color: INK }}>Outlook:</strong> Add calendar → Subscribe from web, and paste it.</li>
              <li>
                <strong style={{ color: INK }}>Apple Calendar:</strong>{" "}
                <a href={data.calendarWebcal} className="underline" style={{ color: "var(--forest)" }}>open this link</a>, or File → New Calendar Subscription.
              </li>
            </ul>
            <Button size="sm" variant="ghost" className="mt-3" disabled={busy} onClick={() => rotate("calendar")}>Make a new address</Button>
          </Card>

          <Card title="Log emails by BCC">
            {data.bccAvailable && data.bccAddress ? (
              <>
                <p className="text-[13px] mb-4" style={{ color: INK_MUTED }}>
                  Sending from Gmail or Outlook? Add this address in BCC and the email is filed on the timeline of every candidate and client contact it went to. Save it as a contact so it&apos;s quick to add.
                </p>
                <CopyRow label="Your BCC address" value={data.bccAddress} />
                <Button size="sm" variant="ghost" className="mt-3" disabled={busy} onClick={() => rotate("bcc")}>Make a new address</Button>
              </>
            ) : (
              <p className="text-[13px]" style={{ color: INK_MUTED }}>
                Logging by BCC needs inbound email set up for your workspace (the same set-up that captures replies). Ask whoever looks after Helixon for your agency.
              </p>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
