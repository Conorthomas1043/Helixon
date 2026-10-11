// Scoring for the AI-writing check's evaluation (scripts/eval-ai-writing.mjs):
// how its "flagged" decisions line up with labelled CVs. Pure, so it's tested
// on its own (ai-writing-eval.test.mjs).

/**
 * @param {{ label: "ai" | "human", flagged: boolean, group?: string }[]} results
 */
export function aiWritingMetrics(results) {
  const tp = results.filter((r) => r.label === "ai" && r.flagged).length;
  const fn = results.filter((r) => r.label === "ai" && !r.flagged).length;
  const fp = results.filter((r) => r.label === "human" && r.flagged).length;
  const tn = results.filter((r) => r.label === "human" && !r.flagged).length;
  const rate = (a, b) => (a + b ? a / (a + b) : null);
  // False alarms per group of human-written CVs (e.g. non-native English),
  // since detectors are known to flag some groups more.
  /** @type {Record<string, { humans: number, falseAlarms: number, rate: number | null }>} */
  const byGroup = {};
  for (const r of results.filter((x) => x.label === "human")) {
    const g = r.group || "other";
    byGroup[g] ??= { humans: 0, falseAlarms: 0, rate: null };
    byGroup[g].humans += 1;
    if (r.flagged) byGroup[g].falseAlarms += 1;
  }
  for (const g of Object.values(byGroup)) g.rate = g.humans ? g.falseAlarms / g.humans : null;
  return {
    counts: { tp, fn, fp, tn },
    // Of the CVs it flags, how many really are AI-written.
    precision: rate(tp, fp),
    // Of the AI-written CVs, how many it catches.
    recall: rate(tp, fn),
    // Of the human-written CVs, how many it wrongly flags - the number that matters most.
    falseAlarmRate: rate(fp, tn),
    byGroup,
  };
}

/** @param {number | null} x */
export const pct = (x) => (x == null ? "-" : `${Math.round(x * 100)}%`);
