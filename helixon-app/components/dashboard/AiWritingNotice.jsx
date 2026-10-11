// The amber "reads as AI-written" prompt (lib/screening/ai-writing.js) with
// the signs the CV reader noticed. Shown on the screening report, the
// candidate profile and the split view. Informational only: the score never
// takes it into account.

import { Notice } from "@/components/ui";

/** @param {{ notice: { message: string, signals: string[] } | null | undefined, className?: string }} props */
export default function AiWritingNotice({ notice, className = "" }) {
  if (!notice) return null;
  return (
    <Notice tone="warn" className={className}>
      <p className="font-semibold">Possibly AI-written</p>
      <p>{notice.message}</p>
      {notice.signals?.length > 0 && (
        <ul className="mt-1.5 list-disc pl-4 space-y-0.5 text-sm">
          {notice.signals.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </Notice>
  );
}
