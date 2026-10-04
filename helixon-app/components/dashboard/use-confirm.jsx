"use client";

// An in-app replacement for window.confirm(). The native box can't say what
// each button does (it's always OK/Cancel), can't be styled, and some
// browsers let people silence it. One callsite even used OK and Cancel as
// two *different deletions* - so "Cancel" still deleted.
//
//   const [ask, confirmDialog] = useConfirm();
//   if (!(await ask({ title: "Delete tag?", body: "...", confirmLabel: "Delete tag", danger: true }))) return;
//   ...render {confirmDialog} somewhere in the component.
//
// For more than yes/no, pass `choices` ([{ value, label, danger }]); the
// promise resolves to the chosen value, or null when dismissed. Cancel is
// always the first button, so it's where focus starts - a stray Enter
// never runs a destructive action.
//
// For a window.prompt() replacement, pass `input` ({ label, defaultValue,
// placeholder, multiline, required }); the promise resolves to the typed
// text, or null when dismissed. Unlike the native box it has a real label,
// room for more than one line, and the same look as the rest of the app.

import { useCallback, useRef, useState } from "react";
import { Button, Dialog, Field, TextArea, TextInput } from "./ui";

const DANGER = { background: "var(--score-low)", color: "white", border: "1px solid var(--score-low)" };

export function useConfirm() {
  const [request, setRequest] = useState(null);
  const resolveRef = useRef(null);

  const ask = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setRequest(options);
      }),
    []
  );

  const finish = useCallback((value) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setRequest(null);
  }, []);

  const choices = request
    ? request.choices || [{ value: true, label: request.confirmLabel || "Confirm", danger: request.danger }]
    : [];
  const dismissValue = request?.choices || request?.input ? null : false;

  const dialog = request ? (
    <Dialog title={request.title} onClose={() => finish(dismissValue)} width={460}>
      {request.body && (
        <div className="text-[14.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          {request.body}
        </div>
      )}
      {request.input ? (
        <PromptForm
          input={request.input}
          confirmLabel={request.confirmLabel || "Save"}
          cancelLabel={request.cancelLabel || "Cancel"}
          onCancel={() => finish(null)}
          onSubmit={(text) => finish(text)}
        />
      ) : (
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
        <Button onClick={() => finish(dismissValue)}>{request.cancelLabel || "Cancel"}</Button>
        {choices.map((c) => (
          <Button key={String(c.value)} variant="primary" style={c.danger ? DANGER : undefined} onClick={() => finish(c.value)}>
            {c.label}
          </Button>
        ))}
      </div>
      )}
    </Dialog>
  ) : null;

  return [ask, dialog];
}

// Holds the typed text itself, so typing doesn't re-render the dialog frame.
// The input comes first, so the dialog focuses it on open; Enter submits a
// single-line answer.
function PromptForm({ input, confirmLabel, cancelLabel, onCancel, onSubmit }) {
  const [value, setValue] = useState(input.defaultValue || "");
  const Control = input.multiline ? TextArea : TextInput;
  const blocked = input.required && !value.trim();
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!blocked) onSubmit(value.trim());
      }}
    >
      <Field label={input.label} hint={input.hint}>
        <Control value={value} placeholder={input.placeholder} maxLength={input.maxLength || 2000} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button type="submit" variant="primary" disabled={blocked}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
