"use client";

import { useState, useEffect, useRef } from "react";

const AGENCY_ID = "YOUR-SEED-AGENCY-ID"; // replace with real auth later

// ═══════════════════════════════════════════════════════════════════════════
// Shared app nav — identical to Dashboard.jsx / BillingManagement.jsx.
// Worth extracting to components/AppNav.jsx so all three stay in sync.
// ═══════════════════════════════════════════════════════════════════════════
function AppNav({ active }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const navLink = (label, href, key) => (
    <a
      key={key}
      href={href}
      className="px-3 py-1.5 rounded-[8px] transition-colors"
      style={{ color: active === key ? "#13201b" : "#5a7a6a", background: active === key ? "var(--mint)" : "transparent", fontWeight: active === key ? 600 : 500 }}
      onMouseEnter={(e) => { if (active !== key) e.currentTarget.style.background = "var(--mint)"; }}
      onMouseLeave={(e) => { if (active !== key) e.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </a>
  );

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight hidden sm:block" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
          </a>
          <div className="hidden sm:flex items-center gap-1 text-xs">
            {navLink("Scoring", "/", "scoring")}
            {navLink("Dashboard", "/dashboard", "dashboard")}
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition-colors"
            style={{ border: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center" style={{ background: "var(--forest)" }}>
              AV
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8aaa9a" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {menuOpen && (
            <div role="menu" className="absolute right-0 mt-2 w-52 rounded-[14px] py-1.5 z-50" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 16px 32px -14px rgba(19,32,27,0.25)" }}>
              <div className="px-3.5 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-sm font-medium truncate" style={{ color: "#13201b" }}>Acme Recruiting</p>
                <p className="text-xs truncate" style={{ color: "#8aaa9a" }}>agency@acme.com</p>
              </div>
              <a
                href="/account"
                role="menuitem"
                className="block px-3.5 py-2 text-sm"
                style={{ color: active === "account" ? "#13201b" : "#5a7a6a", background: active === "account" ? "var(--mint)" : "transparent", fontWeight: active === "account" ? 600 : 400 }}
                onMouseEnter={(e) => { if (active !== "account") e.currentTarget.style.background = "var(--mint)"; }}
                onMouseLeave={(e) => { if (active !== "account") e.currentTarget.style.background = "transparent"; }}
              >
                Account settings
              </a>
              <a href="/billing" role="menuitem" className="block px-3.5 py-2 text-sm" style={{ color: "#5a7a6a" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                Billing
              </a>
              <div className="border-t mt-1 pt-1" style={{ borderColor: "var(--border)" }}>
                <a href="/logout" role="menuitem" className="block px-3.5 py-2 text-sm" style={{ color: "#dc2626" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  Log out
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

// ── Icon set — same restrained line style used across the dashboard ──────
const ICONS = {
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" /></>,
  password: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>,
  notifications: <><path d="M6 8a6 6 0 0112 0c0 4.5 1.5 6 2 6.5H4c.5-.5 2-2 2-6.5z" /><path d="M9.5 18.5a2.5 2.5 0 005 0" /></>,
  danger: <><path d="M12 2l9.5 16.5H2.5z" /><path d="M12 9v4" /><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" /></>,
};

function SettingsNav({ active }) {
  const items = [
    { key: "profile", label: "Profile", icon: ICONS.profile },
    { key: "password", label: "Password", icon: ICONS.password },
    { key: "notifications", label: "Notifications", icon: ICONS.notifications },
    { key: "danger", label: "Danger zone", icon: ICONS.danger },
  ];
  return (
    <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible sm:w-48 shrink-0 -mx-1 px-1 sm:mx-0 sm:px-0">
      {items.map((item) => {
        const isActive = active === item.key;
        const isDanger = item.key === "danger";
        return (
          <a
            key={item.key}
            href={`#${item.key}`}
            className="flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-[10px] whitespace-nowrap transition-colors"
            style={{
              color: isActive ? "#13201b" : isDanger ? "#dc2626" : "#5a7a6a",
              background: isActive ? "var(--mint)" : "transparent",
              fontWeight: isActive ? 600 : 500,
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = isDanger ? "#fef2f2" : "var(--mint)"; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              {item.icon}
            </svg>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "0.875rem",
  color: "#13201b",
  background: "white",
};

function inputFocus(e) {
  e.currentTarget.style.borderColor = "var(--forest)";
  e.currentTarget.style.boxShadow = "0 0 0 3px var(--mint)";
}
function inputBlur(e, errorBorder) {
  e.currentTarget.style.borderColor = errorBorder || "var(--border)";
  e.currentTarget.style.boxShadow = "none";
}

function SectionCard({ id, title, description, danger, children }) {
  return (
    <section
      id={id}
      className="rounded-[16px] p-6 scroll-mt-6"
      style={{
        background: "white",
        border: danger ? "1px solid #fecaca" : "1px solid var(--border)",
        boxShadow: "0 12px 24px -18px rgba(19,32,27,0.25)",
      }}
    >
      <h2 className="text-sm font-semibold mb-1" style={{ color: danger ? "#dc2626" : "#13201b" }}>{title}</h2>
      <p className="text-xs mb-5" style={{ color: "#8aaa9a" }}>{description}</p>
      {children}
    </section>
  );
}

function Toast({ message, tone = "default", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  const isError = tone === "error";

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 text-white text-sm px-4 py-2.5 rounded-[10px] flex items-center gap-2 z-50 animate-[fadeIn_0.2s_ease-out]"
      style={{ background: isError ? "#dc2626" : "#13201b", boxShadow: "0 16px 32px -14px rgba(19,32,27,0.4)" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isError ? "white" : "var(--mint)"} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        {isError ? <path d="M12 9v4m0 4h.01M12 3l9 16.5H3z" /> : <path d="M4.5 12.75l6 6 9-13.5" />}
      </svg>
      {message}
    </div>
  );
}

export default function AccountSettings() {
  const [name, setName] = useState("Alex Vance");
  const [email, setEmail] = useState("agency@acme.com");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [notifyMatches, setNotifyMatches] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(true);
  const [notifyProduct, setNotifyProduct] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [toast, setToast] = useState(null);

  function showToast(message, tone = "default") {
    setToast({ message, tone });
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId: AGENCY_ID, name, email }),
      });
      if (!res.ok) throw new Error();
      showToast("Profile updated");
    } catch {
      showToast("Couldn't save — please try again", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId: AGENCY_ID, currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Couldn't update password.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password changed");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSaveNotifications() {
    setSavingNotifications(true);
    try {
      await fetch("/api/account/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId: AGENCY_ID, notifyMatches, notifyDigest, notifyProduct }),
      });
      showToast("Notification preferences saved");
    } catch {
      showToast("Couldn't save — please try again", "error");
    } finally {
      setSavingNotifications(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteInput !== "delete my account") return;
    setDeletingAccount(true);
    try {
      await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencyId: AGENCY_ID }) });
      window.location.href = "/";
    } catch {
      showToast("Couldn't delete account — please try again", "error");
      setDeletingAccount(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <AppNav active="account" />

      {/* ── Page header — same eyebrow + display-heading rhythm as the hero ── */}
      <section className="max-w-[880px] mx-auto px-6 pt-12 pb-6">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-4" style={{ background: "var(--mint)", color: "var(--forest)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" />
          </svg>
          Acme Recruiting
        </span>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Account settings
        </h1>
      </section>

      <div className="max-w-[880px] mx-auto px-6 pb-20">
        <div className="flex flex-col sm:flex-row gap-8">
          <SettingsNav active="profile" />

          <div className="flex-1 min-w-0 space-y-6">

            {/* ── Profile ─────────────────────────────────────────────── */}
            <SectionCard id="profile" title="Profile" description="Your name and email as they appear across Helixon.">
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-sm">
                <div className="flex items-center gap-4 mb-2">
                  <span className="w-14 h-14 rounded-full text-white text-lg font-semibold flex items-center justify-center shrink-0" style={{ background: "var(--forest)" }}>
                    {name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium px-3 py-1.5 rounded-[8px] transition-colors"
                    style={{ color: "#5a7a6a", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    Change photo
                  </button>
                </div>

                <div>
                  <label htmlFor="name" className="block text-xs font-semibold mb-1.5" style={{ color: "#13201b" }}>Full name</label>
                  <input
                    id="name" value={name} onChange={(e) => setName(e.target.value)} required
                    style={inputStyle} className="focus:outline-none transition-shadow"
                    onFocus={inputFocus} onBlur={inputBlur}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-semibold mb-1.5" style={{ color: "#13201b" }}>Email address</label>
                  <input
                    id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    style={inputStyle} className="focus:outline-none transition-shadow"
                    onFocus={inputFocus} onBlur={inputBlur}
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="text-sm font-semibold px-4 py-2.5 rounded-[10px] text-white transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
                  style={{ background: "var(--forest)", boxShadow: "0 8px 20px -8px rgba(11,110,79,0.5)" }}
                  onMouseEnter={(e) => { if (!savingProfile) e.currentTarget.style.background = "var(--forest-deep)"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}
                >
                  {savingProfile ? "Saving…" : "Save changes"}
                </button>
              </form>
            </SectionCard>

            {/* ── Password ────────────────────────────────────────────── */}
            <SectionCard id="password" title="Password" description="Choose a strong password you don't use elsewhere.">
              {passwordError && (
                <div role="alert" className="mb-4 flex items-start gap-2.5 p-3 rounded-[10px] max-w-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-xs" style={{ color: "#b91c1c" }}>{passwordError}</p>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                <div>
                  <label htmlFor="current-password" className="block text-xs font-semibold mb-1.5" style={{ color: "#13201b" }}>Current password</label>
                  <input
                    id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required
                    style={inputStyle} className="focus:outline-none transition-shadow"
                    onFocus={inputFocus} onBlur={inputBlur}
                  />
                </div>
                <div>
                  <label htmlFor="new-password" className="block text-xs font-semibold mb-1.5" style={{ color: "#13201b" }}>New password</label>
                  <input
                    id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required
                    style={inputStyle} className="focus:outline-none transition-shadow"
                    onFocus={inputFocus} onBlur={inputBlur}
                  />
                  <p className="text-[10px] mt-1.5" style={{ color: "#8aaa9a" }}>At least 8 characters.</p>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-semibold mb-1.5" style={{ color: "#13201b" }}>Confirm new password</label>
                  <input
                    id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                    style={inputStyle} className="focus:outline-none transition-shadow"
                    onFocus={inputFocus} onBlur={inputBlur}
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="text-sm font-semibold px-4 py-2.5 rounded-[10px] text-white transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
                  style={{ background: "var(--forest)", boxShadow: "0 8px 20px -8px rgba(11,110,79,0.5)" }}
                  onMouseEnter={(e) => { if (!savingPassword) e.currentTarget.style.background = "var(--forest-deep)"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}
                >
                  {savingPassword ? "Updating…" : "Update password"}
                </button>
              </form>
            </SectionCard>

            {/* ── Notifications ───────────────────────────────────────── */}
            <SectionCard id="notifications" title="Notifications" description="Choose what Helixon emails you about.">
              <div className="space-y-4 max-w-sm">
                {[
                  { key: "matches", label: "Strong match alerts", desc: "When a candidate scores 90+ against an open role.", value: notifyMatches, set: setNotifyMatches },
                  { key: "digest", label: "Weekly digest", desc: "A Monday summary of last week's screening activity.", value: notifyDigest, set: setNotifyDigest },
                  { key: "product", label: "Product updates", desc: "New features and occasional tips.", value: notifyProduct, set: setNotifyProduct },
                ].map((row) => (
                  <div key={row.key} className="flex items-start justify-between gap-4">
                    <span>
                      <span className="block text-sm font-medium" style={{ color: "#13201b" }}>{row.label}</span>
                      <span className="block text-xs mt-0.5" style={{ color: "#8aaa9a" }}>{row.desc}</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.value}
                      aria-label={row.label}
                      onClick={() => row.set(!row.value)}
                      className="shrink-0 w-9 h-5 rounded-full transition-colors relative mt-0.5"
                      style={{ background: row.value ? "var(--forest)" : "var(--border)" }}
                    >
                      <span
                        className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform"
                        style={{ transform: row.value ? "translateX(18px)" : "translateX(2px)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSaveNotifications}
                disabled={savingNotifications}
                className="text-sm font-semibold px-4 py-2.5 rounded-[10px] text-white transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 mt-6"
                style={{ background: "var(--forest)", boxShadow: "0 8px 20px -8px rgba(11,110,79,0.5)" }}
                onMouseEnter={(e) => { if (!savingNotifications) e.currentTarget.style.background = "var(--forest-deep)"; }}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}
              >
                {savingNotifications ? "Saving…" : "Save preferences"}
              </button>
            </SectionCard>

            {/* ── Danger zone ─────────────────────────────────────────── */}
            <SectionCard id="danger" danger title="Danger zone" description="Deleting your account removes all analyses, candidates, and billing history. This can't be undone.">
              {!deleteConfirmOpen ? (
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="text-sm font-semibold px-4 py-2.5 rounded-[10px] transition-colors"
                  style={{ color: "#dc2626", border: "1px solid #fecaca" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Delete account
                </button>
              ) : (
                <div className="max-w-sm space-y-3">
                  <label htmlFor="delete-confirm" className="block text-xs" style={{ color: "#5a7a6a" }}>
                    Type <span className="font-mono font-semibold" style={{ color: "#13201b" }}>delete my account</span> to confirm.
                  </label>
                  <input
                    id="delete-confirm"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    style={{ ...inputStyle, border: "1px solid #fecaca" }}
                    className="focus:outline-none transition-shadow"
                    onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 3px #fee2e2"; }}
                    onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteInput !== "delete my account" || deletingAccount}
                      className="text-sm font-semibold text-white px-4 py-2.5 rounded-[10px] transition-colors disabled:opacity-40"
                      style={{ background: "#dc2626" }}
                    >
                      {deletingAccount ? "Deleting…" : "Permanently delete"}
                    </button>
                    <button
                      onClick={() => { setDeleteConfirmOpen(false); setDeleteInput(""); }}
                      className="text-sm px-4 py-2.5 rounded-[10px] transition-colors"
                      style={{ color: "#5a7a6a" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mist)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>

          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />}
    </main>
  );
}