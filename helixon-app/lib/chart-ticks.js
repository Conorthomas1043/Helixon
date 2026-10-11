// Axis helpers for the dashboard's Recharts charts.

// Evenly spaced y-axis ticks on a 1-2-5 step, at most four intervals, so the
// axis never skips a value (Recharts' automatic ticks gave 0, 1, 2, 4).
export function niceTicks(max) {
  const top = Math.max(1, Number(max) || 0);
  const raw = top / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw && Number.isInteger(s)) ?? Math.max(1, Math.ceil(raw));
  const ticks = [];
  for (let v = 0; v < top + step; v += step) ticks.push(v);
  return ticks;
}

// £ labels for the fees axis: whole thousands from £10k, one decimal below
// (£4,500 used to read "£5k").
export function axisMoney(v) {
  if (v >= 10000) return `£${Math.round(v / 1000)}k`;
  if (v >= 1000) return `£${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `£${v}`;
}
