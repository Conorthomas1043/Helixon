// The one thing to do next on a candidate's profile, from where they are in
// the funnel - shown as a strip under the profile header with one button,
// instead of six equally weighted ones. `action` says what the button does:
//   { stage }  move them on;  { tab }  open that part of the profile's rail;
//   { scrollTo }  bring a panel on the page into view.
// null when there's nothing obvious (still processing, or a stage not here).

import { STRONG_MATCH_MIN } from "@/lib/screening/scoreBands";

/**
 * @param {{ status?: string, stage?: string | null, score?: number | null, placementFee?: number | null, email?: string | null, nextAction?: { label?: string } | null }} candidate
 * @returns {{ text: string, cta: string, action: { stage?: string, tab?: string, scrollTo?: string } } | null}
 */
export function nextStepFor(candidate) {
  if (!candidate || candidate.status !== "completed") return null;
  const { stage, score } = candidate;

  if (candidate.nextAction?.label) {
    return { text: `Next action: ${candidate.nextAction.label}.`, cta: "Open notes", action: { tab: "work" } };
  }
  switch (stage) {
    case "Screened":
    case null:
    case undefined:
      return score != null && score >= STRONG_MATCH_MIN
        ? { text: `A strong match at ${score}. Shortlist them while they're available.`, cta: "Shortlist", action: { stage: "Shortlisted" } }
        : { text: "Screened. Shortlist them, or reject with a reason so they hear back.", cta: "Shortlist", action: { stage: "Shortlisted" } };
    case "Shortlisted":
      return { text: "Shortlisted. Book an interview, or send them to the client.", cta: "Book interview", action: { scrollTo: "interviews" } };
    case "Interview":
      return { text: "In interview. Record how it went, then move them on.", cta: "Move to Offer", action: { stage: "Offer" } };
    case "Offer":
      return { text: "Offer out. Record the placement when they accept.", cta: "Record placement", action: { tab: "place" } };
    case "Placed":
      return candidate.placementFee == null
        ? { text: "Placed. Record the fee to raise the invoice.", cta: "Record fee", action: { tab: "place" } }
        : null;
    case "Rejected":
      return candidate.email ? { text: "Rejected. Let them know: a rejection email is ready to review.", cta: "Review email", action: { tab: "contact" } } : null;
    default:
      return null;
  }
}
