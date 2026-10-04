"use client";

// Part of the candidate profile page (../page.jsx).

import { EmailCard } from "@/app/analyse/_components/Rail";
import { INK, INK_MUTED, RED_STRONG } from "@/lib/candidates/format";
import { Toasts, useToasts } from "@/app/analyse/_components/ui";
import { trapTab } from "@/lib/focus-trap";
import { updateCandidateContact } from "@/lib/dashboard-api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEmailComposer } from "@/app/analyse/_lib/useEmailComposer";
import { useRouter } from "next/navigation";

export function EmailPanel({ candidate, onSent, initialPurpose }) {
  const router = useRouter();
  const { toasts, toast } = useToasts();
  const handleStatus = useCallback((response, data) => {
    if (response.status === 402 || data?.upgrade) {
      router.push("/pricing?reason=subscription_required");
      return true;
    }
    if (response.status === 401) {
      router.push(`/login?redirect_url=${encodeURIComponent(`/dashboard/candidates/${candidate.id}`)}`);
      return true;
    }
    return false;
  }, [candidate.id, router]);

  const { email } = useEmailComposer({
    candidateId: candidate.id,
    jobId: candidate.jobId,
    candidateEmail: candidate.email,
    clientEmail: candidate.job?.client_email || "",
    toast,
    handleStatus,
    onSent,
    initialPurpose,
  });

  if (!candidate.jobId) return null;

  return (
    <>
      <Toasts toasts={toasts} />
      <EmailCard email={email} />
    </>
  );
}

/* ------------------------------------------------------------------------
 * Edit details - correct what was read off the CV.
 * ---------------------------------------------------------------------- */

export const CONTACT_FIELDS = [
  { key: "fullName", label: "Name", required: true },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "location", label: "Location" },
  { key: "currentTitle", label: "Current title" },
  { key: "currentCompany", label: "Current company" },
];

export function EditDetailsDialog({ candidate, onCancel, onSaved }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(CONTACT_FIELDS.map((f) => [f.key, candidate[f.key] || ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) onCancel();
      if (e.key === "Tab") trapTab(e, dialogRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onCancel]);

  async function save(e) {
    e.preventDefault();
    // Send only what changed.
    const changes = Object.fromEntries(
      CONTACT_FIELDS.filter((f) => (values[f.key] || "").trim() !== (candidate[f.key] || "")).map((f) => [f.key, values[f.key].trim()])
    );
    if (Object.keys(changes).length === 0) {
      onCancel();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateCandidateContact(candidate.id, changes);
      onSaved(updated);
    } catch (err) {
      setError(err.message || "Couldn't save those details.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,32,27,0.45)" }}>
      <form
        ref={dialogRef}
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-details-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[16px] p-6 bg-white shadow-xl"
      >
        <h2 id="edit-details-title" className="text-base font-semibold mb-1" style={{ color: INK }}>
          Edit candidate details
        </h2>
        <p className="text-[14px] mb-4" style={{ color: INK_MUTED }}>
          Fix anything the CV reader got wrong. The change is noted on their timeline.
        </p>
        <div className="space-y-3">
          {CONTACT_FIELDS.map((f, i) => (
            <label key={f.key} className="block">
              <span className="block text-[13px] font-semibold mb-1" style={{ color: INK }}>{f.label}</span>
              <input
                ref={i === 0 ? firstRef : undefined}
                type={f.type || "text"}
                value={values[f.key]}
                required={f.required}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              />
            </label>
          ))}
        </div>
        {error && <p role="alert" className="text-[13px] mt-3" style={{ color: RED_STRONG }}>{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-[14px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="text-[14px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
