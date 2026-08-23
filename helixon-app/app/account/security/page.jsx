"use client";

import { useState } from "react";
import { apiRequest, useAgencyId, GENERIC_ERROR } from "@/lib/account";
import { PageCard, PasswordField, Button, InlineAlert, Divider, ComingSoonRow, Toast } from "@/components/account/ui";

export default function SecurityPage() {
  const agencyId = useAgencyId();

  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message, tone = "default") {
    setToast({ id: Date.now(), message, tone });
  }

  function validate() {
    const next = {};
    if (!form.current) next.current = "Enter your current password.";
    if (form.next.length < 8) next.next = "Use at least 8 characters.";
    if (form.confirm !== form.next) next.confirm = "Passwords don't match.";
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setFormError("");
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await apiRequest("/api/account/password", {
        method: "POST",
        body: { agencyId, currentPassword: form.current, newPassword: form.next },
      });
      setForm({ current: "", next: "", confirm: "" });
      setErrors({});
      showToast("Password changed");
    } catch (err) {
      setFormError(err.message || GENERIC_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageCard title="Security" description="Manage your password and how you sign in.">
        <InlineAlert message={formError} />

        <form onSubmit={handleSubmit} noValidate className="space-y-5 max-w-sm">
          <PasswordField
            id="current-password"
            label="Current password"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => setForm((p) => ({ ...p, current: e.target.value }))}
            error={errors.current}
            disabled={saving}
          />
          <PasswordField
            id="new-password"
            label="New password"
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm((p) => ({ ...p, next: e.target.value }))}
            error={errors.next}
            hint="At least 8 characters."
            disabled={saving}
          />
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
            error={errors.confirm}
            disabled={saving}
          />
          <Button type="submit" loading={saving}>
            {saving ? "Updating…" : "Update password"}
          </Button>
        </form>

        <Divider />

        <ComingSoonRow
          label="Two-factor authentication"
          description="Require a verification code in addition to your password when signing in."
          note="Not available yet — this needs backend support for generating and verifying codes and storing recovery codes securely."
        />

        <Divider />

        <ComingSoonRow
          label="Active sessions"
          description="See where you're signed in and sign out devices you don't recognize."
          note="Not available yet — the app doesn't currently track session or device metadata server-side."
        />
      </PageCard>

      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </>
  );
}