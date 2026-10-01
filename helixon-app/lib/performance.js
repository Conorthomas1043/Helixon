// Recruiter performance: activity and revenue per person over a period,
// against targets, with commission (/dashboard/performance). Targets and the
// commission plan are kept in agencies.settings.performance; everything
// here is pure so it's tested and the page and API agree.

export const METRICS = {
  cvs_added: { label: "CVs added", short: "CVs" },
  calls: { label: "Calls logged", short: "Calls" },
  cvs_sent: { label: "CVs sent to clients", short: "CVs sent" },
  interviews: { label: "Interviews arranged", short: "Interviews" },
  offers: { label: "Offers", short: "Offers" },
  placements: { label: "Placements", short: "Placed" },
  fees: { label: "Fees placed", short: "Fees", money: true },
  cash: { label: "Cash collected", short: "Cash", money: true },
};
export const METRIC_KEYS = Object.keys(METRICS);

export const PERIODS = {
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  last_quarter: "Last quarter",
  this_year: "This year",
  last_year: "Last year",
};

const ymd = (y, m) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

// { key, label, from, to (exclusive), months } in UTC dates.
export function periodRange(key, now = new Date()) {
  const k = PERIODS[key] ? key : "this_month";
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const q = Math.floor(m / 3) * 3;
  const ranges = {
    this_month: [y, m, 1],
    last_month: [y, m - 1, 1],
    this_quarter: [y, q, 3],
    last_quarter: [y, q - 3, 3],
    this_year: [y, 0, 12],
    last_year: [y - 1, 0, 12],
  };
  const [sy, sm, months] = ranges[k];
  return { key: k, label: PERIODS[k], from: ymd(sy, sm), to: ymd(sy, sm + months), months };
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

function cleanMetricMap(raw) {
  const out = {};
  for (const key of METRIC_KEYS) {
    const v = num(raw?.[key]);
    if (v) out[key] = v;
  }
  return out;
}

// Monthly targets: { team: {metric: n}, people: { userId: {metric: n} } }.
export function cleanTargets(raw = {}) {
  const people = {};
  for (const [id, t] of Object.entries(raw.people || {})) {
    if (!/^[\w-]{1,64}$/.test(id)) continue;
    const clean = cleanMetricMap(t);
    if (Object.keys(clean).length) people[id] = clean;
  }
  return { team: cleanMetricMap(raw.team), people };
}

// Commission: a share of fees placed (or cash collected) above a monthly
// threshold, in bands - { from: 0, rate: 10 }, { from: 20000, rate: 15 }
// means 10% of the first 20,000 above the threshold and 15% after.
export function cleanCommission(raw = {}) {
  const basis = raw.basis === "cash" ? "cash" : "fees";
  const tiers = (Array.isArray(raw.tiers) ? raw.tiers : [])
    .map((t) => ({ from: num(t?.from) ?? 0, rate: num(t?.rate) }))
    .filter((t) => t.rate != null && t.rate <= 100)
    .sort((a, b) => a.from - b.from)
    .filter((t, i, list) => i === 0 || t.from !== list[i - 1].from)
    .slice(0, 10);
  if (raw.enabled && !tiers.length) return { error: "Add at least one commission rate." };
  const people = {};
  for (const [id, p] of Object.entries(raw.people || {})) {
    if (!/^[\w-]{1,64}$/.test(id)) continue;
    const threshold = num(p?.threshold);
    if (threshold != null) people[id] = { threshold };
  }
  return { enabled: Boolean(raw.enabled), basis, threshold: num(raw.threshold) ?? 0, tiers, people };
}

export function normalisePerformance(settings) {
  const p = settings?.performance || {};
  const commission = cleanCommission(p.commission || {});
  return { targets: cleanTargets(p.targets || {}), commission: commission.error ? cleanCommission({}) : commission };
}

// Commission on `amount` over a period of `months` (the monthly threshold
// scales with it).
export function commissionFor(plan, amount, { months = 1, userId } = {}) {
  if (!plan?.enabled || !plan.tiers?.length) return null;
  const monthly = plan.people?.[userId]?.threshold ?? plan.threshold ?? 0;
  const over = Math.max(0, Number(amount || 0) - monthly * months);
  let total = 0;
  plan.tiers.forEach((t, i) => {
    const next = plan.tiers[i + 1]?.from ?? Infinity;
    const band = Math.max(0, Math.min(over, next) - t.from);
    total += (band * t.rate) / 100;
  });
  return Math.round(total * 100) / 100;
}

// Rolls raw rows up into metrics per person. `nameToId` maps a recruiter's
// display name to their id, for activity (which records who by name).
export function aggregate({ candidates = [], activity = [], interviews = [], placements = [], invoices = [] }, nameToId = new Map()) {
  const out = new Map();
  const bump = (id, key, by = 1) => {
    if (!id) return;
    if (!out.has(id)) out.set(id, Object.fromEntries(METRIC_KEYS.map((k) => [k, 0])));
    out.get(id)[key] = Math.round((out.get(id)[key] + by) * 100) / 100;
  };
  for (const c of candidates) bump(c.recruiter_id, "cvs_added");
  for (const a of activity) {
    const id = nameToId.get(String(a.actor || "").trim().toLowerCase());
    if (a.type === "call_logged") bump(id, "calls");
    else if (a.type === "cv_sent_logged") bump(id, "cvs_sent");
  }
  for (const i of interviews) bump(i.created_by, "interviews");
  for (const p of placements) {
    if (p.counts_offer) bump(p.recruiter_id, "offers");
    if (p.counts_placement) {
      bump(p.recruiter_id, "placements");
      if (p.kind === "permanent" && p.fee_amount != null) bump(p.recruiter_id, "fees", Number(p.fee_amount));
    }
  }
  for (const inv of invoices) bump(inv.recruiter_id, "cash", Number(inv.total || 0) - Number(inv.vat_amount || 0));
  return out;
}

// A placement row's part in a period: an offer made in it, and/or a
// placement (offer accepted, started or finished) dated in it.
export function placementInPeriod(p, from, to) {
  const offerDay = String(p.offer_date || p.created_at || "").slice(0, 10);
  const inRange = (d) => d && d >= from && d < to;
  const placed = ["accepted", "started", "completed"].includes(p.status);
  return { counts_offer: inRange(offerDay), counts_placement: placed && inRange(offerDay) };
}

export function emptyMetrics() {
  return Object.fromEntries(METRIC_KEYS.map((k) => [k, 0]));
}

// Target for a period: monthly target x months.
export function scaleTargets(monthly = {}, months = 1) {
  return Object.fromEntries(Object.entries(monthly).map(([k, v]) => [k, Math.round(v * months * 100) / 100]));
}
