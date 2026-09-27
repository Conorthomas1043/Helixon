// Ground truth: CandidateResult.js's PIPELINE_STAGES (used by the real
// PipelineStage component today) - NOT the mock dashboard's STAGE_LABELS,
// which invented a different set ("new"/"reviewing"/... , no "Rejected").
// Corrected here since shipping the mock's stage list would silently
// desync the dashboard from what PipelineStage actually writes.
export const STAGE_LABELS = {
  Screened: "Screened",
  Shortlisted: "Shortlisted",
  Interview: "Interview",
  Offer: "Offer",
  Placed: "Placed",
  Rejected: "Rejected",
};

// The linear funnel, for pipeline-snapshot bars and "stalled in stage X"
// logic. Rejected is deliberately excluded - it's a terminal exit, not a
// funnel step, so it shouldn't be "last stage" for isPlaced/inPipeline math.
export const FUNNEL_ORDER = ["Screened", "Shortlisted", "Interview", "Offer", "Placed"];

// One accent per stage, shared by the pipeline board and the dashboard
// funnel so a stage is the same colour everywhere - progressively greener
// through the funnel, red for the terminal exit.
export const STAGE_COLORS = {
  Screened: "#94a3b8",
  Shortlisted: "#5b8def",
  Interview: "#8b6cf0",
  Offer: "var(--gold)",
  Placed: "var(--forest)",
  Rejected: "var(--score-low)",
};
