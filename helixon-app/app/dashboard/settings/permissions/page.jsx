"use client";

// /dashboard/settings/permissions - what members (not the owner or admins)
// can see (lib/permissions.js).

import { useEffect, useState } from "react";
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
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    fetch("/api/settings/permissions", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then(setState)
      .catch(() => setError("Couldn't load permissions."));
  }, []);

  async function toggle(key, value) {
    setSaving(key);
    setError("");
    try {
      const res = await fetch("/api/settings/permissions", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't save that.");
      setState((s) => ({ ...s, permissions: d.permissions }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Page width={800}>
      <PageHeader back={{ href: "/dashboard/settings", label: "Settings" }} eyebrow="Workspace" title="Permissions" subtitle="What members can see. The owner and admins always see everything." />
      {!state && !error && <LoadingCard rows={2} />}
      <ErrorText>{error}</ErrorText>
      {state && (
        <Card>
          {!state.canManage && <p className="text-[13px] mb-4" style={{ color: INK_MUTED }}>Only the workspace owner or an admin can change these.</p>}
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
                  <span className="block text-sm font-semibold" style={{ color: INK }}>{o.label}</span>
                  <span className="block text-[13px]" style={{ color: INK_MUTED }}>{o.body}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
