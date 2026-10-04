// Tags a website visitor's question with the buying concern it raises, so
// the Voice of customer page can count objections instead of reading every
// message. Keyword rules on purpose: transparent, cheap and easy to audit.
const TOPICS = [
  ["price", /\b(price|pricing|cost|£|\$|€|per month|monthly|annual|discount|cheap|expensive|plan)\b/i],
  ["trial", /\b(trial|free|demo|try|test it)\b/i],
  ["data_privacy", /\b(gdpr|data|privacy|secure|security|store|stored|server|switzerland|encrypt|delete)\b/i],
  ["scoring", /\b(score|scoring|accura|bias|fair|how does it (work|decide)|ai|model|rank)\b/i],
  ["team", /\b(team|seat|user|colleague|member|agency plan|multiple)\b/i],
  ["integrations", /\b(integrat|import|export|bullhorn|vincere|ats|crm|outlook|gmail|xero|linkedin|api)\b/i],
  ["file_types", /\b(pdf|word|docx|scan|format|file|upload|bulk)\b/i],
  ["cancel", /\b(cancel|contract|commit|refund)\b/i],
];

export function questionTopic(text) {
  const s = String(text || "");
  for (const [topic, re] of TOPICS) if (re.test(s)) return topic;
  return "other";
}
