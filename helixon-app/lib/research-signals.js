import "server-only";
import { supabase } from "@/lib/supabase";

// Writes to public.research_signals (supabase/migrations/20261004090000).
// Best-effort and never throws: research capture must never break the
// flow it sits in. Missing table (migration not yet applied) is silent.
export const SIGNAL_KINDS = new Set(["cancellation_reason", "assistant_question", "pulse_survey", "research_optin"]);

// Strips the obvious personal data out of free text before it's kept for
// research: email addresses, phone numbers and URLs. Data minimisation,
// UK GDPR Art. 5(1)(c) - the research value is in the question, not in
// who asked it.
export function scrubFreeText(text, max = 2000) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\bhttps?:\/\/\S+/gi, "[link]")
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, "[phone]")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export async function recordSignal({ kind, agencyId = null, profileId = null, score = null, label = null, body = null, meta = null }) {
  if (!SIGNAL_KINDS.has(kind)) return false;
  try {
    const { error } = await supabase.from("research_signals").insert({
      kind,
      agency_id: agencyId,
      profile_id: profileId,
      score: Number.isInteger(score) ? score : null,
      label: label ? String(label).slice(0, 80) : null,
      body: scrubFreeText(body),
      meta,
    });
    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("[research-signals] Insert failed:", error.message);
      return false;
    }
    return !error;
  } catch (err) {
    console.error("[research-signals] Insert failed:", err?.message);
    return false;
  }
}
