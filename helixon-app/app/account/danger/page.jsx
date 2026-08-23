"use client";

import { useState, useRef, useEffect } from "react";
import { apiRequest, useAgencyId, GENERIC_ERROR, COLORS } from "@/lib/account";
import { PageCard, TextInput, Button, InlineAlert, Toast } from "@/components/account/ui";

const DELETE_PHRASE = "delete my account";

export default function DangerZonePage() {
  const agencyId = useAgencyId();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const triggerRef = useRef(null);
  const inputRef = useRef(null);

  function showToast(message, tone = "default") {
    setToast({ id: Date.now(), message, tone });
  }

  function open() {
    setError("");
    setConfirmOpen(true);
  }

  function close() {
    setConfirmOpen(false);
    setInput("");
    setError("");
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (confirmOpen) inputRef.current?.focus();
  }, [confirmOpen]);

  useEffect(() => {
    if (!confirmOpen) return;
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmOpen]);

  async function handleDelete() {
    if (input !== DELETE_PHRASE || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await apiRequest("/api/account", { method: "DELETE", body: { agencyId } });
      window.location.href = "/";
    } catch (err) {
      setError(err.message || GENERIC_ERROR);
      setDeleting(false);
    }
  }

  return (
    <>
      <PageCard danger title="Danger zone" description="Deleting your account removes all analyses, candidates, and billing history. This can't be undone.">
        {!confirmOpen ? (
          <Button ref={triggerRef} variant="dangerOutline" onClick={open}>
            Delete account
          </Button>
        ) : (
          <div className="max-w-sm space-y-3">
            <p id="delete-confirm-heading" className="text-xs" style={{ color: COLORS.muted }}>
              Type <span className="font-mono font-semibold" style={{ color: COLORS.ink }}>{DELETE_PHRASE}</span> to confirm.
            </p>

            <InlineAlert message={error} />

            <TextInput
              ref={inputRef}
              id="delete-confirm"
              tone="danger"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              aria-describedby="delete-confirm-heading"
            />

            <div className="flex gap-2">
              <Button variant="dangerSolid" onClick={handleDelete} loading={deleting} disabled={input !== DELETE_PHRASE || deleting}>
                {deleting ? "Deleting…" : "Permanently delete"}
              </Button>
              <Button variant="ghost" onClick={close} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </PageCard>

      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </>
  );
}