// Scoring calibration: checks the hand-set score weights (config.js) against
// what recruiters actually decided, and suggests better ones once there's
// enough evidence.
//
// Labels come from two places:
//   - feedback.expected_band: the recruiter's own call on an analysis
//     ("Strong match" / "Worth reviewing" = suitable, "Not suitable" = not)
//   - the pipeline: a candidate who reached Interview, Offer or Placed was
//     judged suitable; one rejected for a skills gap was not. Other
//     rejection reasons (pay, withdrew, role closed...) say nothing about
//     the CV, so they aren't labels.
//
// Each stored score is turned back into six 0-1 shares (points earned ÷
// points available per component). A logistic regression on those shares
// predicts "suitable", and its positive coefficients, rescaled to sum to 100,
// are the suggested weights. The suggestion is only marked ready when there
// are enough labels and it ranks candidates measurably better than today's
// weights on held-out data (cross-validated AUC).
//
// Pure functions - scripts/fit-score-weights.mjs does the database reads.

import { SCORE_WEIGHT_PROFILES } from "../config.js";

export const COMPONENTS = ["required", "preferred", "experience", "industry", "career", "achievements"];
const BREAKDOWN_KEYS = {
  required: "RequiredSkills",
  preferred: "PreferredSkills",
  experience: "Experience",
  industry: "Industry",
  career: "Career",
  achievements: "Achievements",
};

const SUITABLE_STAGES = new Set(["Interview", "Offer", "Placed"]);

/** 1 (suitable), 0 (not suitable) or null (no usable label). The recruiter's band wins over the pipeline. */
export function labelFor({ expectedBand = null, stage = null, rejectionReason = null } = {}) {
  if (expectedBand === "Strong match" || expectedBand === "Worth reviewing") return 1;
  if (expectedBand === "Not suitable") return 0;
  if (SUITABLE_STAGES.has(stage)) return 1;
  if (stage === "Rejected" && rejectionReason === "skills_gap") return 0;
  return null;
}

/**
 * The weights a stored score was computed with: saved on the result since
 * rubric 3.1.0, otherwise the role type's profile.
 */
export function weightsUsed(result = {}, roleType = null) {
  if (result.score_weights && typeof result.score_weights === "object") return result.score_weights;
  return SCORE_WEIGHT_PROFILES[result.role_type || roleType] || SCORE_WEIGHT_PROFILES.professional;
}

/** Each component's share of its available points, 0-1, or null where the component carried no weight. */
export function componentShares(result = {}, roleType = null) {
  const weights = weightsUsed(result, roleType);
  const breakdown = result.breakdown || {};
  const out = {};
  for (const key of COMPONENTS) {
    const weight = Number(weights[key]) || 0;
    const points = Number(breakdown[BREAKDOWN_KEYS[key]]);
    out[key] = weight > 0 && Number.isFinite(points) ? Math.max(0, Math.min(1, points / weight)) : null;
  }
  return out;
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/**
 * L2-regularised logistic regression by gradient descent. X: rows of
 * numbers, y: 0/1. Returns { intercept, coefficients }.
 */
export function fitLogistic(X, y, { l2 = 0.5, iterations = 3000, rate = 0.5 } = {}) {
  const n = X.length;
  const d = X[0]?.length || 0;
  let intercept = 0;
  const w = new Array(d).fill(0);
  for (let it = 0; it < iterations; it++) {
    let gIntercept = 0;
    const g = new Array(d).fill(0);
    for (let i = 0; i < n; i++) {
      const p = sigmoid(intercept + X[i].reduce((sum, x, j) => sum + x * w[j], 0));
      const err = p - y[i];
      gIntercept += err;
      for (let j = 0; j < d; j++) g[j] += err * X[i][j];
    }
    intercept -= (rate * gIntercept) / n;
    for (let j = 0; j < d; j++) w[j] -= rate * (g[j] / n + (l2 * w[j]) / n);
  }
  return { intercept, coefficients: w };
}

/** Area under the ROC curve: the chance a random suitable candidate outscores a random unsuitable one. */
export function auc(scores, labels) {
  const pos = [];
  const neg = [];
  scores.forEach((s, i) => (labels[i] ? pos : neg).push(s));
  if (!pos.length || !neg.length) return null;
  let wins = 0;
  for (const p of pos) for (const q of neg) wins += p > q ? 1 : p === q ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

/** Coefficients -> whole-number weights summing to 100 (negative ones become 0). */
export function toWeights(coefficients) {
  const positive = coefficients.map((c) => Math.max(0, c));
  const total = positive.reduce((s, c) => s + c, 0);
  if (!total) return null;
  const raw = positive.map((c) => (c / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((s, x) => s + x, 0);
  // Largest remainder, so the weights still add up to exactly 100.
  raw
    .map((x, i) => [x - Math.floor(x), i])
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (left > 0) {
        floors[i] += 1;
        left -= 1;
      }
    });
  return Object.fromEntries(COMPONENTS.map((key, i) => [key, floors[i]]));
}

// Missing shares (a component the job didn't use) take the column mean, so
// they don't read as "scored zero".
function matrix(rows) {
  const means = COMPONENTS.map((key) => {
    const values = rows.map((r) => r.shares[key]).filter((v) => v !== null);
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0.5;
  });
  return rows.map((r) => COMPONENTS.map((key, j) => (r.shares[key] === null ? means[j] : r.shares[key])));
}

const weighted = (row, weights) => COMPONENTS.reduce((sum, key, j) => sum + row[j] * (Number(weights[key]) || 0), 0);

/** k-fold cross-validated AUC for the fitted model and for the given current weights, on the same folds. */
export function crossValidate(rows, currentWeights, { folds = 5 } = {}) {
  const X = matrix(rows);
  const y = rows.map((r) => r.label);
  const fitted = new Array(rows.length);
  const current = X.map((row) => weighted(row, currentWeights));
  for (let f = 0; f < folds; f++) {
    const trainIdx = [];
    const testIdx = [];
    rows.forEach((_, i) => (i % folds === f ? testIdx : trainIdx).push(i));
    if (!testIdx.length || !trainIdx.length) continue;
    const model = fitLogistic(trainIdx.map((i) => X[i]), trainIdx.map((i) => y[i]));
    for (const i of testIdx) fitted[i] = model.intercept + X[i].reduce((s, x, j) => s + x * model.coefficients[j], 0);
  }
  return { fittedAuc: auc(fitted, y), currentAuc: auc(current, y) };
}

/**
 * Calibration report for one role type. rows: [{ shares, label }].
 * `ready` means the suggested weights can replace the current ones.
 */
export function calibrate(rows, { roleType = "professional", minLabels = 100, minPerClass = 20, minGain = 0.03 } = {}) {
  const current = SCORE_WEIGHT_PROFILES[roleType] || SCORE_WEIGHT_PROFILES.professional;
  const labelled = rows.filter((r) => r.label === 0 || r.label === 1);
  const positives = labelled.filter((r) => r.label === 1).length;
  const negatives = labelled.length - positives;
  const report = { roleType, labels: labelled.length, positives, negatives, current, suggested: null, fittedAuc: null, currentAuc: null, ready: false, reason: "" };

  if (labelled.length < minLabels || positives < minPerClass || negatives < minPerClass) {
    report.reason = `Needs at least ${minLabels} labelled candidates with ${minPerClass}+ of each outcome; has ${labelled.length} (${positives} suitable, ${negatives} not).`;
    if (positives && negatives) Object.assign(report, crossValidate(labelled, current));
    return report;
  }

  const model = fitLogistic(matrix(labelled), labelled.map((r) => r.label));
  report.suggested = toWeights(model.coefficients);
  Object.assign(report, crossValidate(labelled, current));
  if (!report.suggested) {
    report.reason = "No component predicts the outcome - keep the current weights.";
  } else if (report.fittedAuc === null || report.currentAuc === null || report.fittedAuc - report.currentAuc < minGain) {
    report.reason = `The suggested weights don't rank candidates clearly better than the current ones (AUC ${fmt(report.fittedAuc)} vs ${fmt(report.currentAuc)}; needs +${minGain}).`;
  } else {
    report.ready = true;
    report.reason = `Suggested weights rank candidates better on held-out data (AUC ${fmt(report.fittedAuc)} vs ${fmt(report.currentAuc)}).`;
  }
  return report;
}

const fmt = (x) => (x === null || x === undefined ? "n/a" : x.toFixed(2));
