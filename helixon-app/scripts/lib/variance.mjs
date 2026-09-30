// Run-to-run variance for evaluations that score each case more than once
// (--repeat N): how far one candidate's score moves between identical runs.

export function spread(values) {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
  return { mean, sd, range: Math.max(...values) - Math.min(...values) };
}

/** runs: [{ id, scores: [..], recommendations: [..] }] -> printable summary lines. */
export function varianceSummary(runs) {
  const withRepeats = runs.filter((r) => r.scores.length > 1);
  if (!withRepeats.length) return [];
  const stats = withRepeats.map((r) => ({ ...spread(r.scores), flipped: new Set(r.recommendations).size > 1 }));
  const meanSd = stats.reduce((s, x) => s + x.sd, 0) / stats.length;
  const worst = Math.max(...stats.map((x) => x.range));
  const flips = stats.filter((x) => x.flipped).length;
  return [
    `run-to-run spread over ${withRepeats[0].scores.length} runs: mean standard deviation ${meanSd.toFixed(1)} points, largest range ${worst} points`,
    `recommendation changed between runs for ${flips}/${stats.length} cases (${Math.round((flips / stats.length) * 100)}%)`,
  ];
}
