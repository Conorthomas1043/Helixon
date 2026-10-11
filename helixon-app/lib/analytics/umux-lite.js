// UMUX-Lite: a validated two-item usability measure for when a full
// questionnaire is too long - "[This system's] capabilities meet my
// requirements" and "[This system] is easy to use", each on a 7-point
// agreement scale (Lewis, Utesch & Maher, 2013, "UMUX-LITE: When there's no
// time for the SUS", Proceedings of CHI 2013). Scored 0-100 as
// ((capabilities - 1) + (ease - 1)) / 12 * 100. Chosen over NPS, whose claim
// to predict growth didn't replicate (Keiningham, Cooil, Andreassen &
// Aksoy, 2007, "A longitudinal examination of Net Promoter and firm revenue
// growth", Journal of Marketing 71(3)).
export const UMUX_ITEMS = [
  { key: "capabilities", text: "Helixon's capabilities meet my requirements." },
  { key: "ease", text: "Helixon is easy to use." },
];

export function umuxLiteScore(capabilities, ease) {
  const ok = (n) => Number.isInteger(n) && n >= 1 && n <= 7;
  if (!ok(capabilities) || !ok(ease)) return null;
  return Math.round((((capabilities - 1) + (ease - 1)) / 12) * 1000) / 10;
}
