// The single-CV workspace's state (AnalyseWorkspace.jsx) as one reducer: the
// job, the candidate, the run and its report. The changes that touch several
// of these at once - a finished analysis, "Screen another CV", "Next
// candidate", editing a saved job's text - are named actions here, so they
// are tested (workspace-state.test.js) instead of being spread across a
// handler's dozen setState calls.

import { savedJobText } from "./analyse";
import { EMPTY_ROLE_DRAFT } from "./roles";

const NO_FEEDBACK = Object.freeze({ sent: false, rating: null, reason: null });

// What the last analysis produced. Cleared together.
const NO_REPORT = { result: null, candidateId: null, duplicate: null, jobId: null, jobTitle: null, scoreId: null, feedback: NO_FEEDBACK };

export const initialWorkspace = {
  // The job. roleMode stays null until the person picks a method; until
  // then the page shows "saved" when the agency has saved jobs, "paste"
  // when it hasn't (see roleModeFor).
  roleMode: null,
  existingJobId: null,
  prefilledJob: null,
  jobText: "",
  jobFile: null,
  requirements: [],
  // The "Build it" form's answers, kept across method switches and from one
  // candidate to the next.
  roleDraft: EMPTY_ROLE_DRAFT,
  clientEmail: "",
  // The candidate.
  file: null,
  compareFile: null,
  reference: "",
  blind: false,
  // The run.
  loading: false,
  step: 0,
  liveProgress: false,
  error: null,
  comparing: false,
  rerunning: false,
  ...NO_REPORT,
};

/** The job method shown: the one picked, else saved jobs when there are some. */
export function roleModeFor(state, savedJobCount) {
  return state.roleMode ?? (savedJobCount > 0 ? "saved" : "paste");
}

// Fields a form control sets directly, with no knock-on effects.
const EDITABLE = new Set(["roleDraft", "requirements", "clientEmail", "reference", "blind", "error", "comparing", "rerunning"]);

// The job is no longer exactly a saved one (its text was edited, a file was
// chosen, another method was picked).
const detached = (state) => ({ ...state, existingJobId: null, jobTitle: null });

export function workspaceReducer(state, action) {
  switch (action.type) {
    case "set":
      if (!EDITABLE.has(action.field)) throw new Error(`workspace: "${action.field}" isn't set directly`);
      return { ...state, [action.field]: action.value };

    // ── The job ──────────────────────────────────────────────────────────
    case "roleMode":
      return action.mode !== "saved" && state.existingJobId ? { ...detached(state), roleMode: action.mode } : { ...state, roleMode: action.mode };
    case "roleText":
      return { ...detached(state), jobText: action.text };
    case "selectSavedJob":
      return {
        ...state,
        existingJobId: action.job.id,
        jobText: savedJobText(action.job),
        jobFile: null,
        jobTitle: null,
        // A saved job's client email fills the field if it's empty.
        clientEmail: action.job.client_email && !state.clientEmail ? action.job.client_email : state.clientEmail,
      };
    // /analyse?jobId=... from a job's page.
    case "prefillJob":
      return { ...workspaceReducer(state, { type: "selectSavedJob", job: action.job }), prefilledJob: action.job, roleMode: "saved" };
    // A spec chosen as a file (PDF, Word): it replaces the text. null
    // removes it.
    case "jobFile":
      return { ...detached(state), jobFile: action.file, jobText: action.file ? "" : state.jobText };
    // A .txt spec is read into the text box instead.
    case "jobTextFromFile":
      return { ...detached(state), jobFile: null, jobText: action.text, roleMode: "paste" };
    case "detachJob":
      return detached(state);

    // ── The candidate ────────────────────────────────────────────────────
    case "cvFile":
      return { ...state, error: null, [state.comparing ? "compareFile" : "file"]: action.file };
    case "stopComparing":
      return { ...state, comparing: false, compareFile: null };

    // ── The run ──────────────────────────────────────────────────────────
    case "runStarted":
      return { ...state, loading: true, step: 0, liveProgress: false, error: null };
    // Real progress streamed from /api/run: from then on the timer stops
    // guessing, and the steps only ever move forward.
    case "progress":
      return { ...state, liveProgress: true, step: Math.max(state.step, Math.min(action.step, action.lastStep)) };
    // The progress steps advance on a timer while the request is in flight.
    case "tick":
      return state.liveProgress ? state : { ...state, step: Math.min(state.step + 1, action.lastStep) };
    case "runFailed":
      return { ...state, error: action.error };
    case "runFinished":
      return { ...state, loading: false };
    case "analysed": {
      const { data } = action;
      return {
        ...state,
        result: data.result,
        candidateId: data.candidateId,
        duplicate: data.duplicate || null,
        jobId: data.jobId,
        scoreId: data.scoreId || null,
        jobTitle: data.job?.title || null,
        feedback: NO_FEEDBACK,
        rerunning: false,
      };
    }
    case "feedbackSent":
      return { ...state, feedback: { sent: true, rating: action.rating, reason: action.reason } };

    // ── Starting again ───────────────────────────────────────────────────
    // "Screen another CV": the report and the CV go; the job stays.
    case "startNew":
      return { ...state, ...NO_REPORT, file: null, compareFile: null, comparing: false, rerunning: false, reference: "", error: null };
    // "Next candidate": the same, attached to the job the last analysis used
    // or created, so the next CV doesn't add another copy of the role.
    case "nextCandidate": {
      const keepJobId = state.existingJobId || state.jobId;
      const next = workspaceReducer(state, { type: "startNew" });
      if (!keepJobId) return next;
      return { ...next, existingJobId: keepJobId, roleMode: action.savedJobIds.includes(keepJobId) ? "saved" : next.roleMode };
    }

    default:
      throw new Error(`workspace: unknown action "${action.type}"`);
  }
}
