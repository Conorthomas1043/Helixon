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

import { useCallback, useRef, useState } from "react";
import { Button, Dialog } from "./ui";

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
  const dismissValue = request?.choices ? null : false;

  const dialog = request ? (
    <Dialog title={request.title} onClose={() => finish(dismissValue)} width={460}>
      {request.body && (
        <div className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          {request.body}
        </div>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
        <Button onClick={() => finish(dismissValue)}>{request.cancelLabel || "Cancel"}</Button>
        {choices.map((c) => (
          <Button key={String(c.value)} variant="primary" style={c.danger ? DANGER : undefined} onClick={() => finish(c.value)}>
            {c.label}
          </Button>
        ))}
      </div>
    </Dialog>
  ) : null;

  return [ask, dialog];
}
