"use client";
// app/admin/employees/EmployeeDrawer.jsx
// Everything about one staff account: profile, role and per-section
// permissions, where they're signed in, sign-in attempts, onboarding and
// what admins have changed. Every change goes through PATCH
// /api/admin/employees (audited server-side).

import { useState } from "react";
import { Drawer } from "../_shared/ui";
import { Icon } from "../_shared/icons";
import { useAdminData, formatDateTime, timeAgo } from "../_shared/data";
import { confirmAction, promptNewPassword } from "../_shared/modal";
import { toast } from "../_shared/toast";
import { PermissionMatrix, RolePicker, SecretReveal, roleLabel } from "./access";

function sameMap(a, b) {
  return Object.keys({ ...a, ...b }).every((k) => a?.[k] === b?.[k]);
}

const ACTION_LABELS = {
  create_employee: "Account created",
  employee_set_role: "Role changed",
  employee_set_permissions: "Permissions changed",
  employee_reset_permissions: "Permissions reset to role",
  employee_activate: "Activated",
  employee_deactivate: "Deactivated",
  employee_reset_password: "Password reset",
  employee_update_name: "Name changed",
  employee_update_profile: "Profile updated",
  employee_revoke_sessions: "Signed out everywhere",
  employee_revoke_session: "Session signed out",
  employee_view_as: "Admin viewed the portal as them",
  employee_portal_open: "Admin opened the portal",
  employee_portal_account_created: "Admin portal account created",
};

export default function EmployeeDrawer({ employee: row, onClose, patch, openPortal, busy }) {
  const { data, loading, error, reload } = useAdminData(row ? `/api/admin/employees/${row.id}` : null, { enabled: Boolean(row) });
  const detail = data?.employee?.id === row?.id ? data : null;
  const employee = detail?.employee || row;

  // Local edits; keyed on the employee so switching people resets them.
  const [edits, setEdits] = useState({});
  const [secret, setSecret] = useState(null);
  // "Today" for the failed sign-in count, fixed when the drawer opens.
  const [openedAt] = useState(() => Date.now());
  const draftKey = employee?.id;
  const draft = edits.key === draftKey ? edits : { key: draftKey };

  const setDraft = (patchDraft) => setEdits({ ...draft, ...patchDraft, key: draftKey });

  if (!row) return null;

  const name = employee.full_name || employee.display_name || employee.username;
  const fullName = draft.fullName ?? (employee.full_name || employee.display_name || "");
  const email = draft.email ?? (employee.email || "");
  const effective = detail?.access?.effective || row.effective_permissions;
  const permissions = draft.permissions ?? effective;
  const permsDirty = draft.permissions && !sameMap(draft.permissions, effective);
  const profileDirty = fullName !== (employee.full_name || employee.display_name || "") || email !== (employee.email || "");

  async function run(action, extra, success) {
    const result = await patch(employee.id, action, extra);
    if (result) {
      if (success) toast.success(success);
      if (result.temporaryPassword) setSecret(result.temporaryPassword);
      setEdits({});
      reload();
    }
    return result;
  }

  async function changeRole(role) {
    if (role === employee.role) return;
    const ok = await confirmAction(
      `Change ${name} from ${roleLabel(employee.role)} to ${roleLabel(role)}? They'll be signed out. Sections you've customised keep their level; the rest follow the new role.`,
      { title: "Change role" },
    );
    if (ok) run("set_role", { role }, `Role changed to ${roleLabel(role)}`);
  }

  async function toggleActive() {
    if (employee.is_active) {
      const ok = await confirmAction(`Deactivate ${name}? They're signed out now and can't sign in until reactivated.`, { title: "Deactivate account", danger: true });
      if (ok) run("deactivate", {}, "Account deactivated");
    } else {
      run("activate", {}, "Account activated");
    }
  }

  async function resetPassword(generate) {
    if (generate) {
      const ok = await confirmAction(`Generate a new password for ${name}? Their current password stops working and they're signed out everywhere.`, { title: "Reset password", danger: true });
      if (ok) run("reset_password", { generate: true });
      return;
    }
    const password = await promptNewPassword(`New password for ${employee.username}:`, { minLength: 12 });
    if (password) run("reset_password", { password }, "Password changed - they've been signed out");
  }

  async function revokeAll() {
    const ok = await confirmAction(`Sign ${name} out on every device?`, { title: "Sign out everywhere", danger: true });
    if (ok) run("revoke_sessions", {}, "Signed out everywhere");
  }

  const sessions = detail?.sessions || [];
  const attempts = detail?.loginAttempts || [];
  const onboarding = detail?.onboarding;
  const history = detail?.history || [];
  const failed24h = attempts.filter((a) => !a.success && openedAt - new Date(a.ts).getTime() < 86400000).length;

  return (
    <Drawer
      open
      onClose={onClose}
      title={name}
      subtitle={`@${employee.username} · ${roleLabel(employee.role)}${employee.admin_username ? ` · linked to admin ${employee.admin_username}` : ""}`}
    >
      {error && <div className="notice error">{error}</div>}

      <div className="drawer-actions">
        <span className={`pill ${employee.is_active ? "good" : "bad"}`}>{employee.is_active ? "Active" : "Deactivated"}</span>
        {sessions.length > 0 && <span className="pill info">Signed in · {sessions.length}</span>}
        {failed24h > 0 && <span className="pill warn">{failed24h} failed sign-in{failed24h === 1 ? "" : "s"} today</span>}
      </div>

      <div className="actions">
        <button type="button" className="btn small primary" onClick={() => openPortal(employee.id)} disabled={busy || !employee.is_active}>
          <Icon name="external" size={13} /> View portal as them
        </button>
        <button type="button" className="btn small" onClick={() => resetPassword(true)} disabled={busy}>
          <Icon name="key" size={13} /> Generate new password
        </button>
        <button type="button" className="btn small ghost" onClick={() => resetPassword(false)} disabled={busy}>
          Set password…
        </button>
        <button type="button" className={`btn small ${employee.is_active ? "danger" : ""}`} onClick={toggleActive} disabled={busy}>
          {employee.is_active ? "Deactivate" : "Activate"}
        </button>
      </div>

      {secret && <SecretReveal title={`New password for @${employee.username}`} secret={secret} onDone={() => setSecret(null)} />}

      <section className="drawer-section">
        <h3>Profile</h3>
        <form
          className="stack"
          style={{ gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            run("update_profile", { fullName: fullName.trim(), email: email.trim() }, "Profile saved");
          }}
        >
          <div className="form-grid">
            <div className="field">
              <label htmlFor="emp-name">Full name</label>
              <input id="emp-name" value={fullName} onChange={(e) => setDraft({ fullName: e.target.value })} required maxLength={160} />
            </div>
            <div className="field">
              <label htmlFor="emp-email">Email (optional)</label>
              <input id="emp-email" type="email" value={email} onChange={(e) => setDraft({ email: e.target.value })} />
            </div>
          </div>
          {profileDirty && (
            <div className="actions">
              <button className="btn small primary" disabled={busy || !fullName.trim()}>Save profile</button>
              <button type="button" className="btn small ghost" onClick={() => setDraft({ fullName: undefined, email: undefined })}>Cancel</button>
            </div>
          )}
        </form>
      </section>

      <section className="drawer-section">
        <h3>Role</h3>
        <RolePicker id="emp-role" value={employee.role} onChange={changeRole} disabled={busy} />
      </section>

      <section className="drawer-section">
        <div className="section-head" style={{ marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Portal permissions</h3>
          {detail?.access?.overrides && (
            <button type="button" className="btn small ghost" disabled={busy} onClick={() => run("reset_permissions", {}, "Permissions reset to the role's defaults")}>
              Reset to role
            </button>
          )}
        </div>
        <p className="perm-desc" style={{ margin: "0 0 6px" }}>
          None hides the section, View makes it read-only, Edit is full use. Applies immediately, even to open tabs.
        </p>
        <PermissionMatrix role={employee.role} value={permissions} onChange={(next) => setDraft({ permissions: next })} disabled={busy} />
        {permsDirty && (
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn small primary" disabled={busy} onClick={() => run("set_permissions", { permissions }, "Permissions saved")}>
              Save permissions
            </button>
            <button type="button" className="btn small ghost" onClick={() => setDraft({ permissions: undefined })}>Discard</button>
          </div>
        )}
      </section>

      <section className="drawer-section">
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Signed in</h3>
          {sessions.length > 0 && (
            <button type="button" className="btn small danger" onClick={revokeAll} disabled={busy}>Sign out everywhere</button>
          )}
        </div>
        {loading && !detail ? (
          <div className="skeleton" style={{ height: 40 }} />
        ) : sessions.length === 0 ? (
          <div className="faint" style={{ fontSize: 13.5 }}>Not signed in anywhere.</div>
        ) : (
          <div className="mini-list">
            {sessions.map((s) => (
              <div className="mini-row" key={s.id}>
                <div style={{ minWidth: 0 }}>
                  <div>{s.impersonated_by ? `Admin ${s.impersonated_by} (viewing as them)` : "Session"}</div>
                  <div className="faint" style={{ fontSize: 13 }}>Started {timeAgo(s.created_at)} · expires {timeAgo(s.expires_at)}</div>
                </div>
                <button type="button" className="btn small" disabled={busy} onClick={() => run("revoke_session", { sessionId: s.id }, "Session signed out")}>
                  Sign out
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="drawer-section">
        <h3>Recent sign-in attempts</h3>
        {attempts.length === 0 ? (
          <div className="faint" style={{ fontSize: 13.5 }}>{loading && !detail ? "Loading…" : "No sign-in attempts on record."}</div>
        ) : (
          <div className="mini-list">
            {attempts.map((a) => (
              <div className="mini-row" key={a.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono">{a.ip || "unknown IP"}</div>
                  <div className="faint" style={{ fontSize: 13 }}>{formatDateTime(a.ts)}</div>
                </div>
                <span className={`pill ${a.success ? "good" : "bad"}`}>{a.success ? "Signed in" : "Failed"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {onboarding && (
        <section className="drawer-section">
          <h3>Onboarding · {onboarding.filter((t) => t.completedAt).length}/{onboarding.length}</h3>
          <div className="mini-list">
            {onboarding.map((t) => (
              <div className="mini-row" key={t.key}>
                <span style={{ minWidth: 0 }}>{t.label}</span>
                {t.completedAt ? <span className="pill good bare">{timeAgo(t.completedAt)}</span> : <span className="faint" style={{ fontSize: 13 }}>To do</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="drawer-section">
        <h3>Account</h3>
        <dl className="kv">
          <dt>Created</dt><dd>{formatDateTime(employee.created_at)}</dd>
          <dt>Last sign-in</dt><dd>{employee.last_login ? `${formatDateTime(employee.last_login)} (${timeAgo(employee.last_login)})` : "Never"}</dd>
          <dt>Employee ID</dt><dd className="mono" style={{ fontSize: 13 }}>{employee.id}</dd>
        </dl>
      </section>

      <section className="drawer-section">
        <h3>Admin history</h3>
        {history.length === 0 ? (
          <div className="faint" style={{ fontSize: 13.5 }}>{loading && !detail ? "Loading…" : "No admin changes recorded."}</div>
        ) : (
          <div className="mini-list">
            {history.map((h) => (
              <div className="mini-row" key={h.id}>
                <div style={{ minWidth: 0 }}>
                  <div>{ACTION_LABELS[h.action] || h.action}</div>
                  <div className="faint" style={{ fontSize: 13 }}>by {h.admin_username} · {formatDateTime(h.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </Drawer>
  );
}
