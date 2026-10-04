"use client";

// /dashboard/settings/integrations - connected apps (your Gmail / Outlook,
// Xero / QuickBooks, texting, the job feed - components/dashboard/
// ConnectedApps.jsx), then API keys for the REST API (/api/v1), outgoing
// webhooks (Zapier, Make, your own systems) and the LinkedIn extension,
// which are owner and admins only (app/api/integrations).

import { useCallback, useEffect, useState } from "react";
import { addWebhook, createApiKey, deleteWebhook, getApiKeys, getWebhooks, revokeApiKey, updateWebhook } from "@/lib/dashboard-api";
import { Page, PageHeader, Card, Button, ErrorState, ErrorText, Field, LoadingCard, Pill, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";
import ConnectedApps from "@/components/dashboard/ConnectedApps";
import { useConfirm } from "@/components/dashboard/use-confirm";
import CopyButton from "@/components/dashboard/CopyButton";

function fmt(d) {
  return d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
}

function Code({ children }) {
  return (
    <pre className="text-[12px] leading-relaxed p-3 rounded-[10px] overflow-x-auto whitespace-pre" style={{ background: "var(--mist)", color: INK, fontFamily: "var(--font-mono)" }}>
      {children}
    </pre>
  );
}

function ApiKeys({ origin }) {
  const [ask, confirmDialog] = useConfirm();
  const [keys, setKeys] = useState(null);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getApiKeys()
      .then((k) => {
        if (!cancelled) setKeys(k);
      })
      .catch((err) => {
        if (!cancelled) {
          setKeys([]);
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await createApiKey(name);
      setFresh(res.key);
      setName("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(k) {
    if (!(await ask({ title: `Revoke "${k.name}"?`, body: "Anything using this key stops working straight away.", confirmLabel: "Revoke key", danger: true }))) return;
    setError(null);
    try {
      await revokeApiKey(k.id);
      setReloadKey((n) => n + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      {confirmDialog}
    <Card title="API keys" eyebrow="REST API">
      <p className="text-[13px] mb-3" style={{ color: INK_MUTED }}>
        A key lets a script, Zapier or the LinkedIn extension read and add candidates, jobs and clients in this workspace, acting as you. Keep it secret - anyone with it can see your candidates.
      </p>
      {fresh && (
        <div className="rounded-[10px] p-3 mb-3" style={{ background: "#e5f4ea" }}>
          <p className="text-[13px] font-semibold mb-1" style={{ color: "#1f6f43" }}>
            Copy your key now - it won&apos;t be shown again.
          </p>
          <div className="flex gap-2 items-center">
            <code className="text-[13px] break-all flex-1" style={{ color: INK }}>
              {fresh}
            </code>
            <CopyButton size="sm" text={fresh}>
              Copy
            </CopyButton>
          </div>
        </div>
      )}
      <form onSubmit={create} className="flex gap-2 mb-4">
        <TextInput aria-label="Key name" placeholder="Name, e.g. Zapier" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <Button variant="primary" type="submit" disabled={busy || !name.trim()}>
          Create key
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {keys === null ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>Loading…</p>
      ) : keys.length === 0 ? null : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {keys.map((k) => (
            <li key={k.id} className="py-2.5 flex flex-wrap items-center gap-2 text-[14px]">
              <span className="font-semibold" style={{ color: k.revokedAt ? INK_FAINT : INK }}>
                {k.name}
              </span>
              <code className="text-[12px]" style={{ color: INK_MUTED }}>
                {k.prefix}…
              </code>
              {k.revokedAt ? <Pill>Revoked</Pill> : null}
              <span className="text-[12px] flex-1" style={{ color: INK_FAINT }}>
                {k.createdBy ? `by ${k.createdBy} · ` : ""}
                {k.lastUsedAt ? `last used ${fmt(k.lastUsedAt)}` : "never used"}
              </span>
              {!k.revokedAt && (
                <Button size="sm" variant="danger" onClick={() => revoke(k)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <details className="mt-4">
        <summary className="text-[13px] font-semibold cursor-pointer" style={{ color: "var(--forest)" }}>
          How to use it
        </summary>
        <div className="mt-2 space-y-2 text-[13px]" style={{ color: INK_MUTED }}>
          <p>Send the key in an Authorization header. Lists are paged (?page=, ?pageSize= up to 100) and take the same filters as the Candidates page.</p>
          <Code>{`curl ${origin}/api/v1/candidates?stage=Interview \\
  -H "Authorization: Bearer hx_..."

curl -X POST ${origin}/api/v1/candidates \\
  -H "Authorization: Bearer hx_..." -H "Content-Type: application/json" \\
  -d '{"name":"Sam Lee","email":"sam@example.com","currentTitle":"Data Engineer","source":"referral"}'`}</Code>
          <p>
            Endpoints: GET/POST /api/v1/candidates, GET/PATCH /api/v1/candidates/&#123;id&#125; (stage, contact details, note), GET/POST /api/v1/jobs, GET /api/v1/jobs/&#123;id&#125;, GET/POST /api/v1/clients, GET /api/v1/placements. GET /api/v1 checks a key. Up to 1,000 requests an hour per key.
          </p>
        </div>
      </details>
    </Card>
    </>
  );
}

function Webhooks() {
  const [ask, confirmDialog] = useConfirm();
  const [data, setData] = useState(null);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [shown, setShown] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getWebhooks()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) {
          setData({ endpoints: [], events: {} });
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const run = async (fn, done) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fn();
      if (done) setNotice(typeof done === "function" ? done(r) : done);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {confirmDialog}
    <Card title="Webhooks" eyebrow="Zapier, Make, your own systems">
      <p className="text-[13px] mb-3" style={{ color: INK_MUTED }}>
        When something happens here, Helixon POSTs it as JSON to your address - in Zapier, use &quot;Webhooks by Zapier → Catch Hook&quot; and paste its URL. Each delivery is signed: check the Helixon-Signature header (t=timestamp,v1=HMAC-SHA256 of &quot;timestamp.body&quot; with the signing secret).
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await addWebhook({ url, events });
            setUrl("");
            setEvents([]);
          }, "Webhook added - send a test to check it.");
        }}
        className="space-y-2 mb-4"
      >
        <Field label="Send to">
          <TextInput type="url" placeholder="https://hooks.zapier.com/..." maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        {data && (
          <fieldset>
            <legend className="text-[12px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
              Events (none ticked = all)
            </legend>
            <div className="grid sm:grid-cols-2 gap-1">
              {Object.entries(data.events).map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 text-[13px]" style={{ color: INK }}>
                  <input type="checkbox" className="mt-0.5" checked={events.includes(key)} onChange={(e) => setEvents((list) => (e.target.checked ? [...list, key] : list.filter((x) => x !== key)))} />
                  <span>
                    <code className="text-[12px]">{key}</code>
                    <span className="block text-[12px]" style={{ color: INK_FAINT }}>
                      {label}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Button variant="primary" type="submit" disabled={busy || !url.trim()}>
          Add webhook
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {notice && (
        <p className="text-[13px] mb-2" role="status" style={{ color: "var(--forest)" }}>
          {notice}
        </p>
      )}
      {data?.endpoints.length > 0 && (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {data.endpoints.map((e) => (
            <li key={e.id} className="py-3 text-[13px] space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all font-semibold" style={{ color: e.active ? INK : INK_FAINT }}>
                  {e.url}
                </code>
                {!e.active && <Pill>Paused</Pill>}
                {e.lastDeliveryAt && (
                  <Pill color={e.lastError ? "var(--score-low)" : "#1f6f43"} background={e.lastError ? "#fbeaea" : "#e5f4ea"}>
                    {e.lastError ? `Failing: ${e.lastError}` : `OK ${e.lastStatus}`}
                  </Pill>
                )}
              </div>
              <p style={{ color: INK_MUTED }}>{e.events.length ? e.events.join(", ") : "All events"}</p>
              <div className="flex flex-wrap gap-3 items-center">
                <button type="button" disabled={busy} className="font-semibold" style={{ color: "var(--forest)" }} onClick={() => run(() => updateWebhook(e.id, { test: true }), (r) => (r.ok ? `Test delivered (${r.status}).` : `Test failed: ${r.error}`))}>
                  Send test
                </button>
                <button type="button" disabled={busy} style={{ color: INK_MUTED }} onClick={() => run(() => updateWebhook(e.id, { active: !e.active }))}>
                  {e.active ? "Pause" : "Resume"}
                </button>
                <button type="button" style={{ color: INK_MUTED }} onClick={() => setShown(shown === e.id ? null : e.id)}>
                  {shown === e.id ? "Hide secret" : "Signing secret"}
                </button>
                <button type="button" disabled={busy} style={{ color: INK_FAINT }} onClick={async () => (await ask({ title: "Remove this webhook?", body: `${e.url} stops getting events.`, confirmLabel: "Remove webhook", danger: true })) && run(() => deleteWebhook(e.id))}>
                  Remove
                </button>
              </div>
              {shown === e.id && (
                <code className="block text-[12px] break-all p-2 rounded" style={{ background: "var(--mist)", color: INK }}>
                  {e.secret}
                </code>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
    </>
  );
}

export default function IntegrationsPage() {
  const [origin, setOrigin] = useState("https://www.helixon.co.uk");
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    // window is only there in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    getApiKeys()
      .then(() => setAllowed(true))
      .catch((err) => setAllowed(/owner|admin/i.test(err.message) ? false : true));
  }, []);

  const retry = useCallback(() => window.location.reload(), []);

  return (
    <Page width={900}>
      <PageHeader
        back={{ href: "/dashboard/settings", label: "Settings" }}
        eyebrow="Workspace"
        title="Integrations"
        subtitle="Connect Helixon to the rest of your tools: your mailbox, your accounts, texting, job boards, the REST API, webhooks for Zapier and Make, and the LinkedIn extension."
      />
      <ConnectedApps />
      {allowed === null ? (
        <LoadingCard rows={4} />
      ) : allowed === false ? (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>
          API keys, webhooks and the LinkedIn extension are managed by the workspace owner or an admin.
        </p>
      ) : (
        <>
          <ApiKeys origin={origin} />
          <Webhooks />
          <Card title="LinkedIn extension" eyebrow="Chrome / Edge">
            <div className="text-[13px] space-y-2" style={{ color: INK_MUTED }}>
              <p>Save the LinkedIn profile you&apos;re looking at to Helixon in one click - name, headline, location and profile link, with a note and the job to add them to. People already on file aren&apos;t duplicated.</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  Download the extension folder (<code>extensions/linkedin</code> in the Helixon code, or ask us for the zip) and open <code>chrome://extensions</code>.
                </li>
                <li>Turn on Developer mode, choose &quot;Load unpacked&quot; and pick the folder.</li>
                <li>
                  Create an API key above named &quot;LinkedIn extension&quot;, open the extension&apos;s options and paste it with your Helixon address ({origin}).
                </li>
              </ol>
              <p style={{ color: INK_FAINT }}>It only reads the page when you click Save, and only sends what&apos;s shown in its popup.</p>
            </div>
          </Card>
        </>
      )}
    </Page>
  );
}
