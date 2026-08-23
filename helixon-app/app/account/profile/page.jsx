"use client";

import { useState, useRef } from "react";
import { apiRequest, useAgencyId, GENERIC_ERROR, COLORS } from "@/lib/account";
import { PageCard, FormField, TextInput, Button, Toast } from "@/components/account/ui";

export default function ProfilePage() {
  const agencyId = useAgencyId();

  const [profile, setProfile] = useState({ name: "Alex Vance", email: "agency@acme.com" });
  const [savedProfile, setSavedProfile] = useState(profile);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const fileInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
  const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

  const dirty = profile.name !== savedProfile.name || profile.email !== savedProfile.email;
  const initials = profile.name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  function showToast(message, tone = "default") {
    setToast({ id: Date.now(), message, tone });
  }

  function validate() {
    const next = {};
    if (!profile.name.trim()) next.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) next.email = "Enter a valid email address.";
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await apiRequest("/api/account/profile", {
        method: "PATCH",
        body: { agencyId, name: profile.name.trim(), email: profile.email.trim() },
      });
      setSavedProfile(profile);
      showToast("Profile updated");
    } catch (err) {
      showToast(err.message || GENERIC_ERROR, "error");
    } finally {
      setSaving(false);
    }
  }

  function handlePhotoButtonClick() {
    fileInputRef.current?.click();
  }

  function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarError("");

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Please choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image must be under 5MB.");
      return;
    }

    setAvatarUploading(true);
    // File is valid, but photo upload isn't wired to the backend yet. This
    // keeps the control behaving like a real interaction (validate → load →
    // feedback) instead of a dead button while that endpoint is pending.
    window.setTimeout(() => {
      setAvatarUploading(false);
      showToast("Photo uploads are coming soon");
    }, 900);
  }

  return (
    <>
      <PageCard title="Profile" description="Your name and email as they appear across Helixon.">
        <form onSubmit={handleSubmit} noValidate className="space-y-5 max-w-sm">
          <div className="flex items-center gap-4 mb-2">
            <span className="w-14 h-14 rounded-full text-white text-lg font-semibold flex items-center justify-center shrink-0" style={{ background: "var(--forest)" }} aria-hidden="true">
              {initials}
            </span>
            <div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={handlePhotoSelected} aria-hidden="true" />
              <Button variant="secondary" size="sm" onClick={handlePhotoButtonClick} loading={avatarUploading} disabled={avatarUploading} aria-describedby={avatarError ? "avatar-error" : undefined}>
                {avatarUploading ? "Uploading…" : "Change photo"}
              </Button>
              {avatarError && (
                <p id="avatar-error" role="alert" className="text-[11px] mt-1.5 font-medium" style={{ color: COLORS.dangerTextDark }}>
                  {avatarError}
                </p>
              )}
              {!avatarError && (
                <p className="text-[10px] mt-1.5" style={{ color: COLORS.faint }}>PNG, JPEG, or WebP. Up to 5MB.</p>
              )}
            </div>
          </div>

          <FormField id="name" label="Full name" error={errors.name}>
            <TextInput
              id="name"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              required
              disabled={saving}
              error={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
              autoComplete="name"
            />
          </FormField>

          <FormField id="email" label="Email address" error={errors.email}>
            <TextInput
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              required
              disabled={saving}
              error={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              autoComplete="email"
            />
          </FormField>

          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving} disabled={!dirty && !saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {!dirty && !saving && <span className="text-xs" style={{ color: COLORS.faint }}>All changes saved</span>}
          </div>
        </form>
      </PageCard>

      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </>
  );
}