"use client";

import { useState } from "react";
import { apiRequest, useAgencyId, GENERIC_ERROR, COLORS } from "@/lib/account";
import { PageCard, Toggle, Button, Toast } from "@/components/account/ui";

const DEFAULT_NOTIFICATIONS = { matches: true, digest: true, product: false };

const ROWS = [
  { key: "matches", label: "Strong match alerts", description: "When a candidate scores 90+ against an open role." },
  { key: "digest", label: "Weekly digest", description: "A Monday summary of last week's screening activity." },
  { key: "product", label: "Product updates", description: "New features and occasional tips." },
];

export default function NotificationsPage() {
  const agencyId = useAgencyId();

  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [saved, setSaved] = useState(DEFAULT_NOTIFICATIONS);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const dirty = JSON.stringify(notifications) !== JSON.stringify(saved);

  function showToast(message, tone = "default") {
    setToast({ id: Date.now(), message, tone });
  }

  function setNotification(key, value) {
    setNotifications((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await apiRequest("/api/account/notifications", {
        method: "PATCH",
        body: {
          agencyId,
          notifyMatches: notifications.matches,
          notifyDigest: notifications.digest,
          notifyProduct: notifications.product,
        },
      });
      setSaved(notifications);
      showToast("Notification preferences saved");
    } catch (err) {
      showToast(err.message || GENERIC_ERROR, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageCard title="Notifications" description="Choose what Helixon emails you about.">
        <div className="space-y-4 max-w-sm">
          {ROWS.map((row) => (
            <Toggle
              key={row.key}
              id={`notify-${row.key}`}
              label={row.label}
              description={row.description}
              checked={notifications[row.key]}
              onChange={(v) => setNotification(row.key, v)}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 mt-6">
          <Button onClick={handleSave} loading={saving} disabled={!dirty && !saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
          {!dirty && !saving && <span className="text-xs" style={{ color: COLORS.faint }}>All changes saved</span>}
        </div>
      </PageCard>

      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </>
  );
}