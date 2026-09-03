"use client";

// ── Modal-based replacement for window.prompt()/window.confirm() ───────────
// window.prompt() for the password-reset flow showed the new password in
// plaintext in a native browser dialog with no confirm field — anyone
// glancing at the admin's screen, or a screen-share, saw it; there was no
// "type it twice" guard against a fat-fingered reset locking a real user
// out. window.confirm()/prompt() are also unstyleable and easy to
// dismiss-and-forget on a busy admin console. This replaces both with an
// in-app modal, driven imperatively (so existing hook call sites barely
// change) via a small pub-sub: ModalHost renders whatever the current
// request is, and confirmAction()/promptPassword() return a Promise that
// resolves the same way window.confirm/prompt did (null/false for
// cancelled) so callers don't need to change their control flow.

import { useEffect, useState } from "react";

let listeners = [];
let current = null;

function emit() {
  listeners.forEach((fn) => fn(current));
}

function open(request) {
  return new Promise((resolve) => {
    current = { ...request, resolve };
    emit();
  });
}

function close(result) {
  if (current) current.resolve(result);
  current = null;
  emit();
}

// Replacement for window.confirm(message) — resolves true/false.
export function confirmAction(message, { title = "Confirm", danger = false } = {}) {
  return open({ kind: "confirm", message, title, danger });
}

// Replacement for window.prompt() specifically for setting a new password.
// Requires the value to be typed twice so a typo doesn't silently lock the
// user out, and masks the input like any other password field.
export function promptNewPassword(label, { minLength = 8 } = {}) {
  return open({ kind: "password", label, minLength });
}

// Replacement for the free-text window.prompt() used for the IP block
// reason. Not a secret, so a single plain text field is fine.
export function promptText(label, { defaultValue = "" } = {}) {
  return open({ kind: "text", label, defaultValue });
}

function ConfirmBody({ request, onDone }) {
  return (
    <>
      <p className="modal-message">{request.message}</p>
      <div className="modal-actions">
        <button className="btn small" onClick={() => onDone(false)}>
          Cancel
        </button>
        <button
          className={`btn small ${request.danger ? "danger" : ""}`}
          onClick={() => onDone(true)}
        >
          Confirm
        </button>
      </div>
    </>
  );
}

function PasswordBody({ request, onDone }) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (pw1.length < request.minLength) {
      setError(`Must be at least ${request.minLength} characters.`);
      return;
    }
    if (pw1 !== pw2) {
      setError("Passwords don't match.");
      return;
    }
    onDone(pw1);
  };

  return (
    <>
      <p className="modal-message">{request.label}</p>
      <input
        type="password"
        className="search-input"
        placeholder="New password"
        value={pw1}
        onChange={(e) => setPw1(e.target.value)}
        autoFocus
      />
      <input
        type="password"
        className="search-input"
        style={{ marginTop: 8 }}
        placeholder="Confirm new password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
      />
      {error && <div className="notice error" style={{ marginTop: 8 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn small" onClick={() => onDone(null)}>
          Cancel
        </button>
        <button className="btn small" onClick={submit}>
          Set password
        </button>
      </div>
    </>
  );
}

function TextBody({ request, onDone }) {
  const [value, setValue] = useState(request.defaultValue || "");

  return (
    <>
      <p className="modal-message">{request.label}</p>
      <input
        type="text"
        className="search-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <div className="modal-actions">
        <button className="btn small" onClick={() => onDone(null)}>
          Cancel
        </button>
        <button className="btn small" onClick={() => onDone(value)}>
          Confirm
        </button>
      </div>
    </>
  );
}

// Mount once, near the root of the admin layout. Renders nothing when no
// modal is open.
export function ModalHost() {
  const [request, setRequest] = useState(current);

  useEffect(() => {
    listeners.push(setRequest);
    return () => {
      listeners = listeners.filter((fn) => fn !== setRequest);
    };
  }, []);

  if (!request) return null;

  const onDone = (result) => close(result);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-title">{request.title || "Confirm action"}</div>
        {request.kind === "confirm" && <ConfirmBody request={request} onDone={onDone} />}
        {request.kind === "password" && <PasswordBody request={request} onDone={onDone} />}
        {request.kind === "text" && <TextBody request={request} onDone={onDone} />}
      </div>
    </div>
  );
}
