// The Analytics page as a three-column CSV (section, metric, value): every
// figure the page shows, for the filters currently applied. Kept next to
// nothing else so a section added to the page has one obvious place to be
// added to the export too.

import { STAGE_LABELS } from "./stage-labels";

export function analyticsCsvRows(snapshot, filterLabel) {
  const rows = [];
  const add = (section, metric, value) => rows.push({ Section: section, Metric: metric, Value: value ?? "" });
  const t = snapshot.timing || {};

  add("Filters", "Applied", filterLabel);
  if (snapshot.filters?.previous) add("Filters", "Compared with", `${snapshot.filters.previous.from.slice(0, 10)} to ${snapshot.filters.previous.to.slice(0, 10)}`);

  add("Totals", "Candidates analysed", snapshot.totals.completed);
  add("Totals", "Processing", snapshot.totals.processing);
  add("Totals", "Failed", snapshot.totals.failed);
  if (typeof snapshot.placedInPeriod === "number") add("Totals", "Placements in period", snapshot.placedInPeriod);

  add("Quality", "Average match score", snapshot.quality.avgScore);
  add("Quality", "Strong (80+)", snapshot.quality.strong);
  add("Quality", "Moderate (60-79)", snapshot.quality.moderate);
  add("Quality", "Weak (<60)", snapshot.quality.weak);

  add("Conversion", "Shortlist rate %", snapshot.conversion.shortlistRate);
  add("Conversion", "Interview rate %", snapshot.conversion.interviewRate);
  add("Conversion", "Offer rate %", snapshot.conversion.offerRate);
  add("Conversion", "Placement rate %", snapshot.conversion.placementRate);

  const d = snapshot.deltas;
  if (d) {
    add("Change vs previous period", "Candidates analysed", d.completed);
    add("Change vs previous period", "Average match score", d.avgScore);
    add("Change vs previous period", "Shortlist rate (points)", d.shortlistRate);
    add("Change vs previous period", "Interview rate (points)", d.interviewRate);
    add("Change vs previous period", "Offer rate (points)", d.offerRate);
    add("Change vs previous period", "Placement rate (points)", d.placementRate);
  }

  snapshot.funnel.forEach((f) => add("Funnel", `Reached ${f.label}`, f.count));
  Object.entries(snapshot.pipeline.stageCounts).forEach(([k, n]) => add("Pipeline", `Now in ${STAGE_LABELS[k] || k}`, n));
  add("Pipeline", "Stalled 5+ days", snapshot.pipeline.stalled);

  (snapshot.trends?.points || []).forEach((p) => {
    const period = `${snapshot.trends.unit === "week" ? "Week of" : "Month of"} ${p.start}`;
    add("Over time", `${period} - analysed`, p.analysed);
    add("Over time", `${period} - placed`, p.placed);
    add("Over time", `${period} - fees`, p.fees);
  });

  const cal = snapshot.calibration;
  if (cal) {
    add("Score vs outcome", "Resolved candidates (placed or rejected)", cal.sampleSize);
    cal.bands.forEach((b) => {
      add("Score vs outcome", `Score ${b.label} - resolved`, b.total);
      add("Score vs outcome", `Score ${b.label} - placed`, b.placed);
      add("Score vs outcome", `Score ${b.label} - placement rate %`, b.placementRate);
    });
  }
  const v = t.recruiterVerdicts;
  if (v) {
    add("Score vs outcome", "Recruiter thumbs up", v.up);
    add("Score vs outcome", "Recruiter thumbs down", v.down);
    add("Score vs outcome", "Recruiters agreed %", v.agreeRate);
    (v.topReasons || []).forEach((r) => add("Score vs outcome", `Disagreed: ${r.reason}`, r.count));
  }

  add("Speed", "Time to fill (days, median)", t.timeToFillDays);
  add("Speed", "Time to hire (days, median)", t.timeToHireDays);
  if (t.offerAcceptance) {
    add("Speed", "Offers accepted", t.offerAcceptance.accepted);
    add("Speed", "Offers declined", t.offerAcceptance.declined);
    add("Speed", "Offers pending", t.offerAcceptance.pending);
    add("Speed", "Offer acceptance %", t.offerAcceptance.rate);
  }
  (t.timeInStage || []).forEach((s) => add("Time in stage", `${s.label} (days, median)`, s.medianDays));

  snapshot.team.forEach((r) => {
    add("Team", `${r.name} - active`, r.activeCandidates);
    add("Team", `${r.name} - placed`, r.placed);
  });

  if (t.outreach) {
    add("Outreach", "Total logged", t.outreach.total);
    (t.outreach.byType || []).forEach((o) => add("Outreach", o.label, o.count));
    (t.outreach.byRecruiter || []).forEach((o) => add("Outreach", `By ${o.name}`, o.count));
  }

  (t.source || []).forEach((s) => {
    add("Source of hire", `${s.label} - candidates`, s.total);
    add("Source of hire", `${s.label} - placed`, s.placed);
    add("Source of hire", `${s.label} - placement rate %`, s.placementRate);
  });
  (t.rejectionReasons || []).forEach((r) => add("Rejection reasons", r.label, r.count));

  (t.advertising || []).forEach((a) => {
    add("Advertising", `${a.label} - clicks`, a.clicks);
    add("Advertising", `${a.label} - spend`, a.spend);
    add("Advertising", `${a.label} - applicants`, a.applicants);
    add("Advertising", `${a.label} - apply rate %`, a.applyRate);
    add("Advertising", `${a.label} - cost per applicant`, a.costPerApplicant);
  });

  if (t.financial) {
    add("Financials", "Fee income", t.financial.totalFee);
    add("Financials", "Cost attributed", t.financial.totalCost);
    add("Financials", "Margin", t.financial.margin);
    add("Financials", "Average fee per placement", t.financial.avgFee);
    add("Financials", "Placements with a fee", t.financial.placementsWithFee);
    (t.financial.byRecruiter || []).forEach((r) => add("Financials", `Fees - ${r.name}`, r.total));
  }

  if (t.retention) {
    add("Retention", "30-day retained", t.retention.thirtyDay.retained);
    add("Retention", "30-day left", t.retention.thirtyDay.left);
    add("Retention", "30-day retention %", t.retention.thirtyDay.rate);
    add("Retention", "90-day retained", t.retention.ninetyDay.retained);
    add("Retention", "90-day left", t.retention.ninetyDay.left);
    add("Retention", "90-day retention %", t.retention.ninetyDay.rate);
  }
  if (t.reuse) {
    add("Retention", "People submitted for more than one job", t.reuse.reused);
    add("Retention", "Candidate reuse %", t.reuse.rate);
  }

  if (t.feedback) {
    const nps = t.feedback.candidateNps;
    add("Feedback", "Candidate NPS", nps.score);
    add("Feedback", "NPS responses", nps.responses);
    add("Feedback", "Promoters", nps.promoters);
    add("Feedback", "Passives", nps.passives);
    add("Feedback", "Detractors", nps.detractors);
    add("Feedback", "Client satisfaction (avg rating)", t.feedback.clientSatisfaction.avgRating);
    add("Feedback", "Client responses", t.feedback.clientSatisfaction.responses);
  }

  return rows;
}
