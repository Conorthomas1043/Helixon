// Best-effort text redaction for blind screening.
//
// Until this existed, "blind screening" only redacted the *display* copy
// returned to the recruiter (see /api/run/route.js's redactExtracted) -
// the actual CV text handed to Claude for judgement (fitJudgmentPrompt's
// cv_document excerpt) and used for evidence/achievement quoting was
// always the full, unredacted original, name and all. The judgement
// prompt already tells Claude not to let a name or any protected
// characteristic influence a score, but an instruction is not the same
// guarantee as the model never seeing the string in the first place -
// this closes that gap by stripping what extraction already identified as
// identifying before that text is used for anything scoring-related.
//
// This is deliberately whole-string, case-insensitive replacement of each
// already-extracted value (name, email, phone, links, location, employer,
// institutions) - not a general PII scrubber. It won't catch identity
// signals extraction didn't surface as a structured field (a name
// mentioned only in a reference line, a photo, a nickname), so it reduces
// exposure rather than guaranteeing anonymity - the UI copy for this
// toggle should say that plainly, not promise more than this delivers.
const MIN_REDACTABLE_LENGTH = 3;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactValue(text, value, placeholder) {
  if (!value || typeof value !== "string") return text;
  const trimmed = value.trim();
  if (trimmed.length < MIN_REDACTABLE_LENGTH) return text;
  const pattern = new RegExp(escapeRegExp(trimmed), "gi");
  return text.replace(pattern, placeholder);
}

export function buildBlindCvText(cvText, extracted = {}) {
  if (typeof cvText !== "string" || !cvText) return cvText;

  let text = cvText;
  text = redactValue(text, extracted.name, "[Candidate]");
  text = redactValue(text, extracted.email, "[redacted email]");
  text = redactValue(text, extracted.phone, "[redacted phone]");
  text = redactValue(text, extracted.linkedin, "[redacted link]");
  text = redactValue(text, extracted.github, "[redacted link]");
  text = redactValue(text, extracted.portfolio_url, "[redacted link]");
  text = redactValue(text, extracted.location, "[redacted location]");
  text = redactValue(text, extracted.current_employer, "[redacted employer]");
  (extracted.education || []).forEach((entry) => {
    text = redactValue(text, entry?.institution, "[redacted institution]");
  });

  return text;
}
