"use client";

// Draft / edit / copy / send an AI-written email about one candidate for one
// job. Shared by the Analyse report and the candidate profile, so the
// profile can email a candidate (or the client) long after screening -
// before, this only existed on the Analyse screen straight after a run.
//
// Returns `email`, the prop EmailCard (_components/Rail.jsx) renders, and
// `reset()` to clear the draft when the candidate/job changes.

import { useCallback, useRef, useState } from "react";
import posthog from "posthog-js";
import { EMAIL_PURPOSES, EMAIL_RE } from "./analyse";

export function useEmailComposer({
  candidateId,
  jobId,
  candidateEmail = null,
  clientEmail = "",
  toast,
  // (response, data) => true if it navigated away (401 / 402), so the
  // caller decides where a signed-out or unpaid user is sent.
  handleStatus = () => false,
  // Called after a successful send (e.g. to refresh an activity timeline).
  onSent,
}) {
  const [purpose, setPurposeState] = useState("invite_to_interview");
  const [draft, setDraft] = useState(null);
  const [edited, setEditedState] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recipient, setRecipientState] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const artifactIdRef = useRef(null);

  const audience = EMAIL_PURPOSES.find((p) => p.value === purpose)?.audience;

  const reset = useCallback(() => {
    setDraft(null);
    setSent(false);
    artifactIdRef.current = null;
  }, []);

  const generate = useCallback(async () => {
    if (!candidateId || !jobId) return;
    setLoading(true);
    setCopied(false);
    setSent(false);
    try {
      const response = await fetch("/api/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, jobId, purpose }),
      });
      const data = await response.json().catch(() => null);
      if (handleStatus(response, data)) return;
      if (data?.ok) {
        artifactIdRef.current = data.artifact.id;
        const text = data.artifact.content.original_text || data.artifact.content.final_text || "";
        setDraft(text);
        setEditedState(text);
        setRecipientState(audience === "client" ? clientEmail : candidateEmail || "");
      } else {
        toast(data?.error || "Couldn't draft that email - try again", "error");
      }
    } catch {
      toast("Network error while drafting - try again", "error");
    } finally {
      setLoading(false);
    }
  }, [candidateId, jobId, purpose, audience, clientEmail, candidateEmail, toast, handleStatus]);

  // Records the edited text, so "kept vs rewritten" and the send both use it.
  const saveEdits = useCallback(async (finalText) => {
    const artifactId = artifactIdRef.current;
    if (!artifactId) return;
    await fetch("/api/update-artifact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifactId, finalText }),
    }).catch(() => {});
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(edited);
    } catch {
      toast("Couldn't access the clipboard", "error");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    saveEdits(edited);
  }, [edited, saveEdits, toast]);

  const send = useCallback(async () => {
    const to = recipient.trim();
    if (!EMAIL_RE.test(to)) {
      toast("That doesn't look like a valid email address", "error");
      return;
    }
    if (!artifactIdRef.current) return;
    setSending(true);
    try {
      await saveEdits(edited);
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId: artifactIdRef.current, to }),
      });
      const data = await response.json().catch(() => null);
      if (handleStatus(response, data)) return;
      if (data?.ok) {
        setSent(true);
        toast(`Sent to ${to}`);
        onSent?.();
        if (posthog.__loaded) posthog.capture("candidate_email_sent", { purpose });
      } else {
        toast(data?.error || "Couldn't send the email - try again", "error");
      }
    } catch {
      toast("Network error while sending - try again", "error");
    } finally {
      setSending(false);
    }
  }, [recipient, edited, purpose, saveEdits, toast, handleStatus, onSent]);

  const email = {
    purpose,
    setPurpose: (p) => {
      setPurposeState(p);
      setDraft(null);
    },
    draft,
    edited,
    setEdited: (v) => {
      setEditedState(v);
      setSent(false);
    },
    loading,
    generate,
    copied,
    copy,
    recipient,
    setRecipient: (v) => {
      setRecipientState(v);
      setSent(false);
    },
    sending,
    sent,
    send,
    clientEmailMissing: audience === "client" && !clientEmail && !recipient,
  };

  return { email, reset };
}
