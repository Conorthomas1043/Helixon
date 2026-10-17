// Text colour and short label for a sample score in the homepage's product
// previews, on the same cut-offs as the real app (lib/screening/scoreBands).
import { REVIEW_MIN, STRONG_MATCH_MIN } from "@/lib/screening/scoreBands";

export function scoreTone(score) {
  if (score >= STRONG_MATCH_MIN) return { label: "Strong", text: "text-[var(--score-strong)]" };
  if (score >= REVIEW_MIN) return { label: "Review", text: "text-[var(--score-mid)]" };
  return { label: "Weak", text: "text-[var(--score-low)]" };
}
