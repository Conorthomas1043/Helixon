"use client";

// Settings → Integrations: services connected by OAuth
// (app/api/integrations/connections) - Xero / QuickBooks for the agency,
// and each person's own Gmail / Outlook - plus texting (Twilio) and the
// job-board feed. A service whose app credentials aren't set on this
// installation shows as not set up rather than offering a broken button.

import { useCallback, useEffect, useState } from "react";
import { disconnectIntegration, getCareersSettings, getConnections, syncIntegration } from "@/lib/dashboard-api";
import { Button, Card, ErrorText, Pill, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

const ERRORS = {
  not_configured: "isn't set up on this Helixon installation yet.",
  not_admin: "can only be connected by the workspace owner or an admin.",
  invalid_state: "connection expired or didn't match - please try again.",
  no_refresh_token: "didn't give ongoing access - remove Helixon from the account's connected apps and try again.",
  no_company: "didn't say which company to use - please try again.",
  exchange_failed: "couldn't finish connecting - please try again.",
  access_denied: "access wasn't granted.",
};

function fmt(d) {
  return d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
}

function readBanner() {
  try {
    const q = new URLSearchParams(window.location.search);
    const provider = q.get("provider");
    if (q.get("integrationConnected")) return { ok: true, provider };
    if (q.get("integrationError")) return { ok: false, provider, code: q.get("integrationError") };
  } catch {
    // no window (server render)
  }
  return null;
}

function Row({ item, canManage, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const c = item.connection;
  const mayConnect = item.scope === "member" || canManage;

  async function run(fn) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-3.5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: INK }}>
          {item.label} {c ? <Pill color="var(--forest)" background="var(--mint)">Connected</Pill> : !item.configured ? <Pill>Not set up</Pill> : null}
        </p>
        {c ? (
          <p className="text-[12px]" style={{ color: INK_MUTED }}>
            {c.accountName || c.accountId}
            {c.lastSyncedAt ? ` · synced ${fmt(c.lastSyncedAt)}` : " · not synced yet"}
          </p>
        ) : (
          <p className="text-[12px]" style={{ color: INK_FAINT }}>
            {item.scope === "agency"
              ? "Send invoices to your accounts and mark them paid here when they're paid there."
              : "Emails to and from your candidates and client contacts are filed on their timelines. Read-only."}
          </p>
        )}
        {c?.lastError && <p className="text-[11px]" style={{ color: "var(--score-low)" }}>{c.lastError}</p>}
        {note && <p className="text-[11px]" style={{ color: "var(--forest)" }}>{note}</p>}
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {c ? (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await syncIntegration(item.provider);
                  setNote(item.scope === "agency" ? `Checked ${res.checked} invoice${res.checked === 1 ? "" : "s"} - ${res.paid} newly paid.` : `Looked at ${res.scanned} emails - ${res.filed} filed.`);
                  onChanged();
                })
              }
            >
              {busy ? "Syncing…" : item.scope === "agency" ? "Check payments" : "Sync now"}
            </Button>
            {mayConnect && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  window.confirm(`Disconnect ${item.label}?`) &&
                  run(async () => {
                    await disconnectIntegration(item.provider);
                    onChanged();
                  })
                }
              >
                Disconnect
              </Button>
            )}
          </>
        ) : item.configured && mayConnect ? (
          // A full page visit - the service's consent screen, then back here.
          <a
            href={`/api/integrations/oauth/${item.provider}/connect`}
            className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "var(--forest)", color: "white", border: "1px solid var(--forest)" }}
          >
            Connect
          </a>
        ) : null}
      </div>
    </li>
  );
}

export default function ConnectedApps() {
  const [data, setData] = useState(null);
  const [feedUrl, setFeedUrl] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [banner] = useState(readBanner);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    getConnections()
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    getCareersSettings()
      .then((s) => setFeedUrl(s?.enabled ? s.feedUrl : null))
      .catch(() => {});
  }, []);

  if (error) return <Card title="Connected apps"><ErrorText>{error}</ErrorText></Card>;
  if (!data) return null;
  const label = (p) => data.providers.find((x) => x.provider === p)?.label || p;
  const accounting = data.providers.filter((p) => p.scope === "agency");
  const mailboxes = data.providers.filter((p) => p.scope === "member");

  return (
    <>
      {banner && (
        <p
          role="status"
          className="text-[13px] rounded-[10px] px-3.5 py-2.5"
          style={{ background: banner.ok ? "var(--mint)" : "#fef2f2", color: banner.ok ? "var(--forest)" : "#b42318" }}
        >
          {banner.ok ? `${label(banner.provider)} is connected.` : `${label(banner.provider)} ${ERRORS[banner.code] || "couldn't be connected - please try again."}`}
        </p>
      )}
      <Card title="Your mailbox" eyebrow="Just you">
        <ul className="divide-y -my-3.5" style={{ borderColor: "var(--border)" }}>
          {mailboxes.map((p) => (
            <Row key={p.provider} item={p} canManage={data.canManage} onChanged={reload} />
          ))}
        </ul>
      </Card>
      <Card title="Accounts" eyebrow="Whole workspace">
        <ul className="divide-y -my-3.5" style={{ borderColor: "var(--border)" }}>
          {accounting.map((p) => (
            <Row key={p.provider} item={p} canManage={data.canManage} onChanged={reload} />
          ))}
        </ul>
        {!data.canManage && (
          <p className="text-[11px] mt-4" style={{ color: INK_FAINT }}>
            The workspace owner or an admin connects the accounts package.
          </p>
        )}
      </Card>
      <Card title="Texting" eyebrow="Twilio">
        {data.sms.configured ? (
          <div className="text-[12px] space-y-1.5" style={{ color: INK_MUTED }}>
            <p>Text candidates from their profile; replies land on their timeline and notify whoever texted them.</p>
            <p>
              In Twilio, set the number&apos;s &quot;A message comes in&quot; webhook to <code style={{ color: INK }}>{data.sms.webhookUrl}</code> (HTTP POST).
            </p>
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: INK_MUTED }}>
            Not set up on this Helixon installation yet - it needs a Twilio account and number.
          </p>
        )}
      </Card>
      <Card title="Job boards" eyebrow="Feed">
        {feedUrl ? (
          <div className="text-[12px] space-y-1.5" style={{ color: INK_MUTED }}>
            <p>Your published jobs as an XML feed. Give this address to job boards and aggregators that take a feed (Indeed, Adzuna, Jooble and others), and each job page is already marked up for Google for Jobs.</p>
            <p>
              <code style={{ color: INK }}>{feedUrl}</code>
            </p>
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: INK_MUTED }}>
            Turn on your careers page (Settings → Careers page) to get a job feed for job boards.
          </p>
        )}
      </Card>
    </>
  );
}
