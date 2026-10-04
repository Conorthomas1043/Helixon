"use client";

// Part of the candidate profile page (../page.jsx).

import { CARD, INK, INK_FAINT, INK_MUTED, formatDateOnly } from "@/lib/candidate-format";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { useState } from "react";
import { SectionHeading } from "./primitives";

export const UNBLIND_CONFIRM = {
  title: "Show who this candidate is?",
  body: "This candidate was screened blind. The original CV shows their name and contact details.",
  confirmLabel: "Open the original CV",
};

export function DocumentsSection({ candidate }) {
  const [busy, setBusy] = useState(null); // "view" | "download" | "text"
  const [error, setError] = useState("");
  const [text, setText] = useState(null);
  const [showText, setShowText] = useState(false);
  const [copied, setCopied] = useState(false);
  const resume = candidate.resume;
  const isPdf = /\.pdf$/i.test(resume?.name || "");

  const [ask, confirmDialog] = useConfirm();

  // A blind screen hid who the candidate is while scoring - opening the
  // original shows their name, so it's a deliberate step, not a stray click.
  // The tab below opens straight after the dialog's button click resolves
  // this, still inside that click's user activation, so it isn't blocked as
  // a pop-up.
  async function confirmUnblind() {
    if (!candidate.screenedBlind) return true;
    return ask(UNBLIND_CONFIRM);
  }

  async function openFile(download) {
    if (!(await confirmUnblind())) return;
    setError("");
    setBusy(download ? "download" : "view");
    // Opened before the request so browsers don't treat it as a pop-up.
    const tab = download ? null : window.open("", "_blank");
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/cv${download ? "?download=1" : ""}`, { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) throw new Error(data?.error || "Couldn't open the CV.");
      if (tab) tab.location.href = data.url;
      else window.location.href = data.url;
    } catch (err) {
      tab?.close();
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleText() {
    if (showText) {
      setShowText(false);
      return;
    }
    if (text == null) {
      setBusy("text");
      setError("");
      try {
        const res = await fetch(`/api/candidates/${candidate.id}/cv?format=text`, { credentials: "include" });
        const data = await res.json().catch(() => null);
        if (!res.ok || typeof data?.text !== "string") throw new Error(data?.error || "Couldn't load the CV text.");
        setText(data.text);
      } catch (err) {
        setError(err.message);
        setBusy(null);
        return;
      }
      setBusy(null);
    }
    setShowText(true);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy - select the text and copy it instead.");
    }
  }

  const buttonClass =
    "inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full transition disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Documents" title="CV & documents" />
      {confirmDialog}

      {resume ? (
        <div className="flex flex-wrap items-center gap-4 rounded-[12px] p-4" style={{ background: "var(--mist)" }}>
          <span
            className="w-10 h-12 rounded-[6px] flex items-center justify-center shrink-0 text-[12px] font-bold tracking-wide"
            style={{ background: "white", border: "1px solid var(--border)", color: isPdf ? "#b42318" : "#1d4ed8" }}
            aria-hidden="true"
          >
            {isPdf ? "PDF" : "DOCX"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" style={{ color: INK }}>
              {resume.name}
            </p>
            <p className="text-[13px]" style={{ color: INK_MUTED }}>
              Uploaded {formatDateOnly(resume.uploadedAt)}
              {candidate.screenedBlind ? " · screened blind" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openFile(false)}
              disabled={busy !== null}
              className={buttonClass}
              style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
              title={isPdf ? "Open in a new tab" : "Word files download to open in Word"}
            >
              {busy === "view" ? "Opening…" : "Open"}
            </button>
            <button
              type="button"
              onClick={() => openFile(true)}
              disabled={busy !== null}
              className={buttonClass}
              style={{ background: "var(--forest)", color: "white" }}
            >
              {busy === "download" ? "Preparing…" : "Download"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>
          {candidate.hasCvText
            ? "The original file wasn't kept for this candidate - they were analysed before Helixon stored CVs. The CV text is below."
            : "No CV on file."}
        </p>
      )}

      {candidate.hasCvText && (
        <div className="mt-3">
          <button
            type="button"
            onClick={toggleText}
            disabled={busy === "text"}
            className="text-[13px] font-semibold rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ color: "var(--forest)" }}
            aria-expanded={showText}
          >
            {busy === "text" ? "Loading…" : showText ? "Hide CV text" : "View CV text"}
          </button>
          {showText && text != null && (
            <div className="mt-2 rounded-[10px]" style={{ border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-[12px]" style={{ color: INK_FAINT }}>Text read from the CV - formatting isn&apos;t kept</span>
                <button type="button" onClick={copyText} className="text-[12px] font-semibold" style={{ color: INK_MUTED }}>
                  {copied ? "Copied" : "Copy text"}
                </button>
              </div>
              <pre
                className="max-h-[420px] overflow-auto whitespace-pre-wrap px-3 py-2.5 text-[13.5px] leading-relaxed"
                style={{ color: INK, fontFamily: "inherit" }}
              >
                {text}
              </pre>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-[13px] mt-3" style={{ color: "var(--score-low)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Activity timeline
 * ---------------------------------------------------------------------- */
