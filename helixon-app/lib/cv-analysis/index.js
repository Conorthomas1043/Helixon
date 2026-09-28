// Public surface of the CV analysis pipeline. app/api/run is the only
// consumer; everything else is internal to lib/cv-analysis.

export * from "./config.js";

export { default as analyseCV } from "./pipeline/analyseCV.js";

export { default as extractCvText } from "./extraction/cvTextExtractor.js";

export { default as candidateExtractor } from "./extraction/candidateExtractor.js";

export { default as jobExtractor } from "./extraction/jobExtractor.js";

export { default as scoreCandidate } from "./scoring/scoreCandidate.js";

export { default as validateCandidate } from "./validators/validateCandidate.js";

export { default as validateJob } from "./validators/validateJob.js";

export { default as validateScore } from "./validators/validateScore.js";

export { estimateSalary } from "./scoring/salaryEngine.js";
