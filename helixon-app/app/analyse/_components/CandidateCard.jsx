"use client";

// The candidate half of the setup: the CV itself, a few options, the lawful
// basis confirmation and the Analyse button.

import { useRef, useState } from "react";
import { Card, CardHeader, Icon, Button, Input, Label, Notice, Switch, Kbd, cx } from "./ui";
import { CV_ACCEPT, formatBytes, isThinCv } from "../_lib/analyse";

export default function CandidateCard({
  file,
  onFile,
  previous,
  reference,
  setReference,
  blind,
  setBlind,
  consent,
  setConsent,
  canAnalyse,
  missing,
  onAnalyse,
  rerunOf,
  onCancelRerun,
  compare,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  return (
    <Card>
      <CardHeader
        title={compare ? "Second candidate" : "Candidate"}
        description={compare ? "Scored against the same role, then compared side by side." : "The CV to assess."}
      />

      <div className="px-5 pt-4 pb-5 space-y-4">
        {rerunOf && (
          <Notice tone="info" onDismiss={onCancelRerun}>
            Re-scoring <b className="font-semibold text-[var(--ink)]">{rerunOf}</b>. Change the job or must-haves, then screen again - no need to re-upload.
          </Notice>
        )}

        {file ? (
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-[12px] border border-[var(--border)] bg-[var(--mist)]">
            <span className="w-10 h-10 rounded-[9px] bg-white border border-[var(--border)] flex items-center justify-center text-[var(--forest)]">
              <Icon name="file" size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-medium text-[var(--ink)] truncate">{file.name}</span>
              <span className="block text-[13px] text-[var(--ink-faint)]">{formatBytes(file.size)}</span>
            </span>
            {!rerunOf && (
              <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}>
                Replace
              </Button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFile(e.dataTransfer.files?.[0] || null);
            }}
            className={cx(
              "w-full flex flex-col items-center justify-center gap-2 py-12 rounded-[12px] border border-dashed transition-colors",
              dragging ? "border-[var(--forest)] bg-[#f4faf7]" : "border-[var(--ink-mute)] hover:bg-[var(--mist)]"
            )}
          >
            <span className="w-10 h-10 rounded-full bg-[var(--mist)] border border-[var(--border)] flex items-center justify-center text-[var(--ink-soft)]">
              <Icon name="upload" size={18} />
            </span>
            <span className="text-[14px] font-medium text-[var(--ink)]">Drop a CV here, or browse</span>
            <span className="text-[13px] text-[var(--ink-faint)]">PDF or Word (.docx) · up to 10 MB</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={CV_ACCEPT}
          className="hidden"
          aria-label="Upload CV"
          onChange={(e) => {
            onFile(e.target.files?.[0] || null);
            e.target.value = "";
          }}
        />

        {previous && !rerunOf && (
          <Notice tone="warn">
            You analysed a file called &ldquo;{file?.name}&rdquo;{previous.timestamp ? ` on ${new Date(previous.timestamp).toLocaleDateString("en-GB")}` : ""} (scored {previous.matchScore}). Is this a re-upload?
          </Notice>
        )}
        {isThinCv(file) && (
          <Notice tone="warn">This file is very small - if it&apos;s a scan or image-only PDF there may be little text to read.</Notice>
        )}

        {!compare && (
          <>
            <div>
              <Label htmlFor="reference" hint="Optional">Reference</Label>
              <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Jane D - Acme account exec" />
            </div>
            <Switch
              id="blind"
              checked={blind}
              onChange={setBlind}
              label="Blind screening"
              description="Hide name, contact details and institutions in the report to reduce bias."
            />
          </>
        )}

        <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-[3px] w-4 h-4 shrink-0 accent-[var(--forest)]"
          />
          <span className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
            I have a lawful basis (for example the candidate&apos;s consent or legitimate interest under UK GDPR) to screen this CV.
          </span>
        </label>

        <div className="pt-1">
          <Button variant="primary" size="lg" className="w-full" disabled={!canAnalyse} onClick={onAnalyse} iconRight="arrowRight">
            {compare ? "Screen and compare" : rerunOf ? "Re-score candidate" : "Screen candidate"}
          </Button>
          <p className="text-[13px] text-center mt-2 text-[var(--ink-faint)]">
            {missing ? (
              missing
            ) : (
              <>
                Usually 20–40 seconds · <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd>
              </>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}
