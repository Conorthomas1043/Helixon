"use client";

// /dashboard/settings/permissions - what members (not the owner or admins)
// can see (lib/agency/permissions.js).

import { useState } from "react";
import { apiFetch } from "@/lib/api-client/core";
import { useResource } from "@/lib/hooks/useResource";
import { Card, ErrorText, LoadingCard, Page, PageHeader, INK, INK_MUTED } from "@/components/dashboard/ui";

const OPTIONS = [
  {
    key: "financialsAdminOnly",
    label: "Keep money to the owner and admins",
    body: "Members don't see fees, salaries, pay and charge rates, invoices, fee income or commission. They can still record offers and placements.",
  },
  {
    key: "ownCandidatesOnly",
    label: "Members only see their own candidates",
    body: "Members see candidates assigned to them and unassigned ones - in lists, search, the pipeline, analytics and on profiles. Admins still see everyone's.",
  },
];

export default function PermissionsPage() {
  const { data: state, error: loadError, loading, mutate } = useResource("settings:permissions", () => apiFetch("/api/settings/permissions"));
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(null);
  const error = saveError || (loadError && !state ? "Couldn't load permissions." : "");

  async function toggle(key, value) {
    setSaving(key);
    setSaveError("");
    try {
      const res = await fetch("/api/settings/permissions", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't save that.");
      mutate((s) => ({ ...s, permissions: d.permissions }));
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Page width="narrow">
      <PageHeader back={{ href: "/dashboard/settings", label: "Settings" }} eyebrow="Workspace" title="Permissions" subtitle="What members can see. The owner and admins always see everything." />
      {loading && <LoadingCard rows={2} />}
      <ErrorText>{error}</ErrorText>
      {state && (
        <Card>
          {!state.canManage && <p className="text-14 mb-4 text-[var(--ink-soft)]">Only the workspace owner or an admin can change these.</p>}
          <ul className="space-y-5">
            {OPTIONS.map((o) => (
              <li key={o.key} className="flex items-start gap-3">
                <input
                  id={o.key}
                  type="checkbox"
                  className="mt-1 w-4 h-4 accent-[var(--forest)]"
                  checked={Boolean(state.permissions?.[o.key])}
                  disabled={!state.canManage || saving === o.key}
                  onChange={(e) => toggle(o.key, e.target.checked)}
                />
                <label htmlFor={o.key}>
                  <span className="block text-sm font-semibold text-[var(--ink)]">{o.label}</span>
                  <span className="block text-14 text-[var(--ink-soft)]">{o.body}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
