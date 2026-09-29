"use client";
// /admin/site - site-wide controls: maintenance mode, the announcement
// banner and feature switches (lib/site-settings.js). Every change is
// saved per section and audited.

import { useState } from "react";

import { PageHeader, Panel, Switch } from "../_shared/ui";
import { Icon } from "../_shared/icons";
import { useAdminData, formatDateTime, timeAgo } from "../_shared/data";
import { csrfHeaders } from "../_shared/csrf";
import { confirmAction } from "../_shared/modal";
import { toast } from "../_shared/toast";

const TONES = [
  { key: "info", label: "Brand" },
  { key: "success", label: "Good news" },
  { key: "warn", label: "Heads-up" },
];

const PREVIEW_STYLE = {
  info: { background: "#0b6e4f", color: "#fff" },
  success: { background: "#e3f4ec", color: "#0b6e4f" },
  warn: { background: "#fff4d6", color: "#13201b" },
};

// Switches that visibly take something away from people get a confirm.
const RISKY_OFF = {
  checkout: "New customers won't be able to subscribe until you switch this back on.",
  employee_portal: "Every employee is signed out and can't sign back in. Admins can still open the portal from the console.",
};

function Updated({ meta }) {
  if (!meta?.updatedAt) return null;
  return (
    <span className="faint" style={{ fontSize: 12 }} title={formatDateTime(meta.updatedAt)}>
      Changed {timeAgo(meta.updatedAt)}{meta.updatedBy ? ` by ${meta.updatedBy}` : ""}
    </span>
  );
}

export default function SiteControlsPage() {
  const { data, error, loading, reload } = useAdminData("/api/admin/site");
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState("");

  const settings = data?.settings;
  const meta = data?.meta || {};
  const maintenance = { ...settings?.maintenance, ...drafts.maintenance };
  const announcement = { ...settings?.announcement, ...drafts.announcement };
  const features = settings?.features || {};

  const edit = (key, patch) => setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  const dirty = (key) => Boolean(drafts[key]) && Object.entries(drafts[key]).some(([k, v]) => settings?.[key]?.[k] !== v);

  async function save(key, value, success) {
    setSaving(key);
    try {
      const response = await fetch("/api/admin/site", {
        method: "PATCH",
        headers: csrfHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ key, value }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Couldn't save that change.");
      setDrafts((d) => ({ ...d, [key]: undefined }));
      toast.success(success);
      window.dispatchEvent(new Event("admin:site-updated")); // sidebar status (AdminShell)
      await reload();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setSaving("");
    }
  }

  async function toggleMaintenance(on) {
    if (on) {
      const ok = await confirmAction(
        "Turn on maintenance mode? Every public page sends visitors to the maintenance screen. You, the console and the staff portal keep working.",
        { title: "Maintenance mode", danger: true },
      );
      if (!ok) return;
    }
    save("maintenance", { ...maintenance, enabled: on }, on ? "Maintenance mode is on" : "The site is live again");
  }

  async function toggleFeature(key, on) {
    if (!on && RISKY_OFF[key]) {
      const ok = await confirmAction(RISKY_OFF[key], { title: "Switch off?", danger: true });
      if (!ok) return;
    }
    const label = data.features.find((f) => f.key === key)?.label || key;
    save("features", { ...features, [key]: on }, `${label} ${on ? "on" : "off"}`);
  }

  const offCount = Object.values(features).filter((v) => v === false).length;

  return (
    <>
      <PageHeader title="Site controls" description="Switch parts of the public site on and off, post a banner, or take the site down for maintenance. Changes reach every server within about 30 seconds.">
        <button className="btn small" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={13} /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}
      {data?.unavailable && (
        <div className="notice section">Couldn&rsquo;t read the saved settings, so these are the defaults. If this persists, apply the admin_controls database migration.</div>
      )}

      <div className="status-strip section" role="status">
        <span className={`pill ${settings?.maintenance?.enabled ? "bad" : "good"}`}>{settings?.maintenance?.enabled ? "Maintenance mode" : "Site live"}</span>
        <span className={`pill ${settings?.announcement?.enabled ? "info" : "bare"}`}>{settings?.announcement?.enabled ? "Banner showing" : "No banner"}</span>
        <span className={`pill ${offCount ? "warn" : "good"}`}>{offCount ? `${offCount} feature${offCount === 1 ? "" : "s"} off` : "All features on"}</span>
      </div>

      <div className="split section">
        <Panel title="Maintenance mode" sub="Sends every public page to the maintenance screen." action={<Updated meta={meta.maintenance} />}>
          <div className="stack" style={{ gap: 14, marginTop: 12 }}>
            <Switch
              id="maintenance-switch"
              label={settings?.maintenance?.enabled ? "The site is in maintenance mode" : "The site is live"}
              description="Signed-in admins, the staff portal and anyone with the site gate password still get through. APIs, webhooks and checkout callbacks keep running."
              checked={settings?.maintenance?.enabled}
              onChange={toggleMaintenance}
              disabled={!settings || saving === "maintenance"}
            />
            <div className="field">
              <label htmlFor="maintenance-message">Message for visitors</label>
              <textarea
                id="maintenance-message"
                rows={3}
                maxLength={400}
                placeholder="We're making some changes behind the scenes."
                value={maintenance.message || ""}
                onChange={(e) => edit("maintenance", { message: e.target.value })}
              />
            </div>
            {dirty("maintenance") && (
              <div className="actions">
                <button className="btn small primary" disabled={saving === "maintenance"} onClick={() => save("maintenance", maintenance, "Message saved")}>Save message</button>
                <button className="btn small ghost" onClick={() => setDrafts((d) => ({ ...d, maintenance: undefined }))}>Discard</button>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Features" sub="Turn individual parts of the site off without a deploy." action={<Updated meta={meta.features} />}>
          <div className="switch-list">
            {(data?.features || []).map((f) => (
              <Switch
                key={f.key}
                id={`feature-${f.key}`}
                label={f.label}
                description={f.description}
                checked={features[f.key] !== false}
                onChange={(on) => toggleFeature(f.key, on)}
                disabled={saving === "features"}
              />
            ))}
            {!data && <div className="skeleton" style={{ height: 180 }} />}
          </div>
        </Panel>
      </div>

      <Panel title="Announcement banner" sub="A strip across the top of every public page. Visitors can dismiss it; changing the text shows it again." action={<Updated meta={meta.announcement} />} className="section">
        <form
          className="stack"
          style={{ gap: 14, marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            save("announcement", announcement, announcement.enabled ? "Banner published" : "Banner saved");
          }}
        >
          <Switch
            id="announcement-switch"
            label="Show the banner"
            description={announcement.text?.trim() ? "Saved with the button below." : "Add some text first."}
            checked={announcement.enabled}
            onChange={(on) => edit("announcement", { enabled: on })}
            disabled={!settings}
          />
          <div className="field">
            <label htmlFor="announcement-text">Text</label>
            <input id="announcement-text" maxLength={240} value={announcement.text || ""} onChange={(e) => edit("announcement", { text: e.target.value })} placeholder="New: shortlist candidates straight from your talent pool." />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="announcement-link-label">Link text (optional)</label>
              <input id="announcement-link-label" maxLength={40} value={announcement.linkLabel || ""} onChange={(e) => edit("announcement", { linkLabel: e.target.value })} placeholder="Read more" />
            </div>
            <div className="field">
              <label htmlFor="announcement-link-url">Link (a page like /blog, or a full https:// URL)</label>
              <input id="announcement-link-url" maxLength={300} value={announcement.linkUrl || ""} onChange={(e) => edit("announcement", { linkUrl: e.target.value })} placeholder="/blog" />
            </div>
          </div>
          <div className="field">
            <span className="field-label">Style</span>
            <div className="segmented" role="radiogroup" aria-label="Banner style">
              {TONES.map((t) => (
                <button type="button" key={t.key} role="radio" aria-checked={announcement.tone === t.key} className={announcement.tone === t.key ? "active" : ""} onClick={() => edit("announcement", { tone: t.key })}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {announcement.text?.trim() && (
            <div>
              <span className="field-label">Preview</span>
              <div className="announcement-preview" style={PREVIEW_STYLE[announcement.tone] || PREVIEW_STYLE.info}>
                {announcement.text}
                {announcement.linkLabel && announcement.linkUrl && <u style={{ fontWeight: 600, marginLeft: 6 }}>{announcement.linkLabel}</u>}
              </div>
            </div>
          )}
          {dirty("announcement") && (
            <div className="actions">
              <button className="btn small primary" disabled={saving === "announcement"}>
                {announcement.enabled ? "Publish banner" : settings?.announcement?.enabled ? "Take banner down" : "Save"}
              </button>
              <button type="button" className="btn small ghost" onClick={() => setDrafts((d) => ({ ...d, announcement: undefined }))}>Discard</button>
            </div>
          )}
        </form>
      </Panel>
    </>
  );
}
