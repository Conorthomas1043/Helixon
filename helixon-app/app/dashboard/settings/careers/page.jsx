"use client";

// /dashboard/settings/careers - the agency's public jobs page
// (app/api/careers): its address, intro, privacy notice, and whether it's
// on. Jobs are published to it from each job's Advertise panel.

import { useCallback, useEffect, useState } from "react";
import { getCareersSettings, saveCareersSettings } from "@/lib/dashboard-api";
import { Page, PageHeader, Card, Button, ErrorState, ErrorText, Field, LoadingCard, Pill, TextArea, TextInput, INK, INK_MUTED } from "@/components/dashboard/ui";

export default function CareersSettingsPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCareersSettings()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setF({ slug: d.slug || d.suggestedSlug, intro: d.intro, website: d.website, privacyEmail: d.privacyEmail, privacyNotice: d.privacyNotice });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  async function save(extra = {}) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const d = await saveCareersSettings({ ...f, ...extra });
      setData(d);
      setNotice(extra.enabled === true ? "Your jobs page is live." : extra.enabled === false ? "Your jobs page is off." : "Saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const locked = data && !data.canManage;

  return (
    <Page width={860}>
      <PageHeader
        back={{ href: "/dashboard/settings", label: "Settings" }}
        eyebrow="Inbound applicants"
        title="Your jobs page"
        subtitle="A public page listing the jobs you publish, where people apply with their CV. Applications are screened automatically and land in your pipeline, tagged with where they came from."
        actions={data && <Pill color={data.enabled ? "var(--forest)" : INK_MUTED} background={data.enabled ? "var(--mint)" : "var(--mist)"}>{data.enabled ? "Live" : "Off"}</Pill>}
      />
      {status === "loading" && <LoadingCard rows={6} />}
      {status === "error" && <ErrorState title="Unable to load your jobs page settings" onRetry={retry} />}
      {status === "ready" && (
        <>
          {locked && <p className="text-[13px]" style={{ color: INK_MUTED }}>Only the workspace owner or an admin can change these.</p>}
          <Card title="Page">
            <fieldset disabled={locked || saving} className="space-y-3">
              <Field label="Address" hint={`Your page will be at ${typeof window !== "undefined" ? window.location.origin : ""}/jobs/${f.slug || "…"}`}>
                <TextInput maxLength={50} value={f.slug} onChange={(e) => setF((v) => ({ ...v, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
              </Field>
              <Field label="Introduction">
                <TextArea rows={4} maxLength={2000} value={f.intro} onChange={set("intro")} placeholder="Who you are and the kind of roles you recruit for." />
              </Field>
              <Field label="Your website (optional)">
                <TextInput maxLength={300} value={f.website} onChange={set("website")} placeholder="https://…" />
              </Field>
            </fieldset>
          </Card>
          <Card title="Privacy notice for applicants">
            <fieldset disabled={locked || saving} className="space-y-3">
              <p className="text-[12px]" style={{ color: INK_MUTED }}>
                Applicants must agree to it before applying; it&apos;s published at <code>/jobs/{f.slug || "…"}/privacy</code>. Leave the custom notice
                empty to use the standard one, filled in with your agency name and retention period.
              </p>
              <Field label="Contact email for data requests">
                <TextInput type="email" maxLength={254} value={f.privacyEmail} onChange={set("privacyEmail")} placeholder="privacy@youragency.com" />
              </Field>
              <Field label="Custom notice (optional)">
                <TextArea rows={6} maxLength={10000} value={f.privacyNotice} onChange={set("privacyNotice")} />
              </Field>
            </fieldset>
          </Card>
          <ErrorText>{error}</ErrorText>
          {notice && <p className="text-[13px]" role="status" style={{ color: INK }}>{notice}</p>}
          {!locked && (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={saving} onClick={() => save()}>{saving ? "Saving…" : "Save"}</Button>
              {data.enabled ? (
                <Button disabled={saving} onClick={() => save({ enabled: false })}>Switch off</Button>
              ) : (
                <Button variant="outline" disabled={saving || !f.privacyEmail} onClick={() => save({ enabled: true })} title={f.privacyEmail ? undefined : "Add a contact email for data requests first"}>
                  Switch on
                </Button>
              )}
              {data.enabled && data.pageUrl && (
                <Button href={data.pageUrl} target="_blank" rel="noopener noreferrer">Open your jobs page ↗</Button>
              )}
            </div>
          )}
        </>
      )}
    </Page>
  );
}
