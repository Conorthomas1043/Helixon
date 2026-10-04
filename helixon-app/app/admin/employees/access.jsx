"use client";
// app/admin/employees/access.jsx
// Pieces shared by the create form and the employee drawer: the per-section
// permission matrix and the one-time password reveal.

import { useState } from "react";
import { Icon } from "../_shared/icons";
import { toast } from "../_shared/toast";
import { ROLES, SECTIONS, rolePreset } from "@/lib/employee/permissions";

const LEVEL_OPTIONS = [
  { key: "none", label: "None" },
  { key: "view", label: "View" },
  { key: "edit", label: "Edit" },
];

// Platform stats are read-only, so "view" and "edit" mean the same thing:
// offer just None / View.
const PLATFORM_OPTIONS = [
  { key: "none", label: "None" },
  { key: "view", label: "View" },
];

export function roleLabel(role) {
  return ROLES.find((r) => r.key === role)?.label || String(role || "").replace(/_/g, " ");
}

/** How far `permissions` is from the role's defaults, for list badges. */
export function accessSummary(role, permissions) {
  const base = rolePreset(role);
  const changed = SECTIONS.filter((s) => normal(s.key, permissions?.[s.key] ?? base[s.key]) !== normal(s.key, base[s.key])).length;
  const hidden = SECTIONS.filter((s) => (permissions?.[s.key] ?? base[s.key]) === "none").length;
  return { changed, hidden };
}

function normal(section, level) {
  return section === "platform" && level === "edit" ? "view" : level;
}

/**
 * `value` is the full effective map ({section: level}); onChange gets the
 * next full map. Rows that differ from the role's preset are marked.
 */
export function PermissionMatrix({ role, value, onChange, disabled }) {
  const base = rolePreset(role);
  return (
    <div className="perm-list" role="group" aria-label="Portal permissions">
      {SECTIONS.map((section) => {
        const current = normal(section.key, value?.[section.key] ?? base[section.key]);
        const custom = current !== normal(section.key, base[section.key]);
        const options = section.key === "platform" ? PLATFORM_OPTIONS : LEVEL_OPTIONS;
        return (
          <div className="perm-row" key={section.key}>
            <div style={{ minWidth: 0 }}>
              <div className="perm-name">
                {section.label}
                {custom && <span className="pill info bare">Custom</span>}
              </div>
              <div className="perm-desc">{section.description}</div>
            </div>
            <div className="segmented perm-levels" role="radiogroup" aria-label={`${section.label} access`}>
              {options.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={current === o.key}
                  className={`lvl-${o.key} ${current === o.key ? "active" : ""}`}
                  disabled={disabled}
                  onClick={() => onChange({ ...value, [section.key]: o.key })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RolePicker({ value, onChange, disabled, id = "role" }) {
  const role = ROLES.find((r) => r.key === value);
  return (
    <div className="field">
      <label htmlFor={id}>Role</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {ROLES.map((r) => (
          <option key={r.key} value={r.key}>{r.label}</option>
        ))}
      </select>
      {role && <span className="faint" style={{ fontSize: 13 }}>{role.description}</span>}
    </div>
  );
}

/** Shows a password the server generated, once, with a copy button. */
export function SecretReveal({ title, secret, onDone }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("Password copied");
    } catch {
      toast.warn("Couldn't copy - select the password and copy it by hand.");
    }
  }
  return (
    <div className="secret-box" role="status">
      <div className="perm-name"><Icon name="key" size={14} /> {title}</div>
      <p className="perm-desc" style={{ margin: "4px 0 10px" }}>
        Send it to them over a private channel. It won&rsquo;t be shown again; they can change it under Settings once signed in.
      </p>
      <div className="secret-row">
        <code className="mono secret-value">{secret}</code>
        <button type="button" className="btn small" onClick={copy}>
          <Icon name={copied ? "check" : "copy"} size={13} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {onDone && (
        <button type="button" className="btn small ghost" style={{ marginTop: 10 }} onClick={onDone}>
          Done
        </button>
      )}
    </div>
  );
}
