"use client";

import { useState, useEffect, forwardRef } from "react";
import { COLORS } from "@/lib/account";

// ── Icons ────────────────────────────────────────────────────────────────
function WarningIcon({ className = "" }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.dangerText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function EyeIcon({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M3.5 12S6.5 5.5 12 5.5 20.5 12 20.5 12 17.5 18.5 12 18.5 3.5 12 3.5 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3.5 12S6.5 5.5 12 5.5c1.6 0 3 .4 4.2 1M20.5 12S18.9 15 16.6 16.7M9.9 9.9a3 3 0 004.2 4.2" />
          <path d="M3 3l18 18" />
        </>
      )}
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Button ───────────────────────────────────────────────────────────────
const BUTTON_VARIANTS = {
  primary: "text-white bg-[var(--forest)] hover:bg-[var(--forest-deep)] shadow-[0_8px_20px_-8px_rgba(11,110,79,0.5)] hover:scale-[1.01] focus-visible:ring-[var(--forest)]",
  secondary: "hover:bg-[var(--mint)] focus-visible:ring-[var(--forest)]",
  ghost: "hover:bg-[var(--mist)] focus-visible:ring-[var(--forest)]",
  dangerOutline: "hover:bg-red-50 focus-visible:ring-[#dc2626]",
  dangerSolid: "text-white bg-[#dc2626] hover:bg-[#b91c1c] focus-visible:ring-[#dc2626]",
};

const BUTTON_STYLE = {
  primary: {},
  secondary: { color: COLORS.muted, border: "1px solid var(--border)" },
  ghost: { color: COLORS.muted },
  dangerOutline: { color: COLORS.dangerText, border: `1px solid ${COLORS.dangerBorder}` },
  dangerSolid: {},
};

export const Button = forwardRef(function Button(
  { variant = "primary", size = "md", loading = false, disabled = false, children, className = "", type = "button", ...props },
  ref
) {
  const sizeClass = size === "sm" ? "text-xs px-3 py-1.5 gap-1.5" : "text-sm px-4 py-2.5 gap-2";
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-[10px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${sizeClass} ${BUTTON_VARIANTS[variant]} ${className}`}
      style={BUTTON_STYLE[variant]}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

// ── Text input ───────────────────────────────────────────────────────────
export const TextInput = forwardRef(function TextInput(
  { id, error = false, tone = "default", className = "", style, ...props },
  ref
) {
  const isDanger = error || tone === "danger";
  return (
    <input
      ref={ref}
      id={id}
      aria-invalid={error ? "true" : undefined}
      className={`w-full rounded-[10px] border px-3.5 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--focus-border)] focus:shadow-[0_0_0_3px_var(--ring-color)] disabled:bg-[var(--mist)] disabled:text-[#8aaa9a] disabled:cursor-not-allowed ${className}`}
      style={{
        borderColor: isDanger ? COLORS.dangerBorder : "var(--border)",
        color: COLORS.ink,
        background: "white",
        "--focus-border": isDanger ? COLORS.dangerText : "var(--forest)",
        "--ring-color": isDanger ? "#fee2e2" : "var(--mint)",
        ...style,
      }}
      {...props}
    />
  );
});

// ── Form field wrapper ──────────────────────────────────────────────────
export function FormField({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold mb-1.5" style={{ color: COLORS.ink }}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[11px] mt-1.5 font-medium" style={{ color: COLORS.dangerTextDark }}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-[10px] mt-1.5" style={{ color: COLORS.faint }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ── Password field (adds show/hide toggle) ──────────────────────────────
export function PasswordField({ id, label, value, onChange, error, hint, autoComplete, disabled }) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <TextInput
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          error={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-[6px] transition-colors hover:bg-[var(--mint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] disabled:opacity-40"
          style={{ color: COLORS.muted }}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </FormField>
  );
}

// ── Toggle switch ────────────────────────────────────────────────────────
export function Toggle({ id, checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <span id={`${id}-label`} className="block text-sm font-medium" style={{ color: COLORS.ink }}>
          {label}
        </span>
        {description && (
          <span className="block text-xs mt-0.5" style={{ color: COLORS.faint }}>
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className="shrink-0 w-9 h-5 rounded-full relative mt-0.5 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]"
        style={{ background: checked ? "var(--forest)" : "var(--border)" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-out"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
        />
      </button>
    </div>
  );
}

// ── Divider ──────────────────────────────────────────────────────────────
export function Divider() {
  return <div className="h-px my-6" style={{ background: "var(--border)" }} aria-hidden="true" />;
}

// ── "Not available yet" row ─────────────────────────────────────────────
// For settings the backend genuinely doesn't support yet. Deliberately not
// an interactive control (no disabled toggle, no dead button) - a static
// row with a badge, so it reads as a roadmap item rather than a feature
// that looks live but silently does nothing.
export function ComingSoonRow({ label, description, note }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <span className="block text-sm font-medium" style={{ color: COLORS.ink }}>{label}</span>
        {description && (
          <span className="block text-xs mt-0.5" style={{ color: COLORS.faint }}>{description}</span>
        )}
        {note && (
          <span className="block text-xs mt-1.5" style={{ color: COLORS.muted }}>{note}</span>
        )}
      </div>
      <span
        className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full mt-0.5 whitespace-nowrap"
        style={{ background: "var(--mist)", color: COLORS.muted, border: "1px solid var(--border)" }}
      >
        Coming soon
      </span>
    </div>
  );
}

// ── Page-level content surface ──────────────────────────────────────────
// One per settings page. Now that each section lives on its own route,
// this is the single content boundary rather than one of several stacked
// cards, so it gets more room to breathe.
export function PageCard({ title, description, danger, children }) {
  return (
    <section
      className="rounded-[18px] p-7 sm:p-9"
      style={{
        background: "white",
        border: danger ? `1px solid ${COLORS.dangerBorder}` : "1px solid var(--border)",
        boxShadow: "0 16px 32px -20px rgba(19,32,27,0.28)",
      }}
    >
      <h2 className="text-base font-semibold mb-1.5" style={{ color: danger ? COLORS.dangerText : COLORS.ink, fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      <p className="text-sm mb-6" style={{ color: COLORS.faint }}>
        {description}
      </p>
      {children}
    </section>
  );
}

// ── Inline form-level alert ──────────────────────────────────────────────
export function InlineAlert({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 flex items-start gap-2.5 p-3 rounded-[10px] max-w-sm" style={{ background: COLORS.dangerBg, border: `1px solid ${COLORS.dangerBorder}` }}>
      <WarningIcon className="mt-0.5 shrink-0" />
      <p className="text-xs" style={{ color: COLORS.dangerTextDark }}>{message}</p>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────────────
export function Toast({ message, tone = "default", onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className="fixed z-50 left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-auto sm:max-w-sm flex items-center gap-2.5 text-white text-sm pl-4 pr-2.5 py-3 rounded-[12px] animate-[fadeIn_0.2s_ease-out]"
      style={{ background: isError ? "#dc2626" : "#13201b", boxShadow: "0 16px 32px -14px rgba(19,32,27,0.4)" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isError ? "white" : "var(--mint)"} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        {isError ? <path d="M12 9v4m0 4h.01M12 3l9 16.5H3z" /> : <path d="M4.5 12.75l6 6 9-13.5" />}
      </svg>
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <CloseIcon />
      </button>
    </div>
  );
}