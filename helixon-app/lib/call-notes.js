// AI call notes: a recruiter pastes rough notes or a transcript from a call
// with a candidate, and gets back a tidy summary, the facts that matter to
// a recruiter, and a suggested follow-up (app/api/candidates/[id]/call-notes).
// Pure parts here - the prompt, the output schema and checking what came
// back - so they're tested without calling the model.

import { neutralizeUntrusted, UNTRUSTED_CONTENT_RULES } from "@/lib/prompt-safety";

export const MAX_NOTES = 20000;

export const CALL_NOTES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "keyPoints", "nextSteps", "followUp", "details"],
  properties: {
    summary: { type: "string", description: "Two to four plain sentences: what the call was about and where things stand." },
    keyPoints: { type: "array", items: { type: "string" }, description: "Up to six short facts a recruiter would act on." },
    nextSteps: { type: "array", items: { type: "string" }, description: "Concrete actions agreed or implied, who does them." },
    followUp: {
      type: "object",
      additionalProperties: false,
      required: ["label", "inDays"],
      properties: {
        label: { type: "string", description: "The single most useful next action, as a short instruction. Empty if none." },
        inDays: { type: "integer", description: "When to do it, in days from today (0-60)." },
      },
    },
    details: {
      type: "object",
      additionalProperties: false,
      required: ["noticePeriod", "salaryExpectation", "availableFrom", "otherProcesses"],
      properties: {
        noticePeriod: { type: "string", description: "As said on the call, or empty." },
        salaryExpectation: { type: "string", description: "As said on the call, or empty." },
        availableFrom: { type: "string", description: "A date YYYY-MM-DD if one was given, or empty." },
        otherProcesses: { type: "string", description: "Other interviews or offers mentioned, or empty." },
      },
    },
  },
};

export const SYSTEM_PROMPT =
  "You turn a recruiter's rough call notes or a call transcript into a clear record for their CRM. " +
  "Only use what's in the notes - never invent facts, numbers or dates; leave a field empty when the notes don't say. " +
  "Write in plain British English, briefly, as the recruiter would for a colleague." +
  UNTRUSTED_CONTENT_RULES;

export function buildPrompt({ notes, candidateName, jobTitle, kind = "call", today }) {
  return [
    `Today is ${today}.`,
    `This was a ${kind === "meeting" ? "meeting" : "phone call"} with ${candidateName || "a candidate"}${jobTitle ? ` about the role ${jobTitle}` : ""}.`,
    "",
    "The recruiter's notes:",
    neutralizeUntrusted(notes, { max: MAX_NOTES }),
  ].join("\n");
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v, n, max) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

// What the model returned, made safe to store and show. null if unusable.
export function cleanCallNotes(raw) {
  if (!raw || typeof raw !== "object") return null;
  const summary = str(raw.summary, 1500);
  if (!summary) return null;
  const inDays = Number.isInteger(raw.followUp?.inDays) ? Math.min(60, Math.max(0, raw.followUp.inDays)) : null;
  const available = str(raw.details?.availableFrom, 10);
  return {
    summary,
    keyPoints: list(raw.keyPoints, 6, 300),
    nextSteps: list(raw.nextSteps, 6, 300),
    followUp: str(raw.followUp?.label, 200) ? { label: str(raw.followUp.label, 200), inDays: inDays ?? 2 } : null,
    details: {
      noticePeriod: str(raw.details?.noticePeriod, 100),
      salaryExpectation: str(raw.details?.salaryExpectation, 100),
      availableFrom: /^\d{4}-\d{2}-\d{2}$/.test(available) ? available : "",
      otherProcesses: str(raw.details?.otherProcesses, 300),
    },
  };
}

// The note saved on the candidate's profile.
export function noteText(result, kind = "call") {
  const lines = [`${kind === "meeting" ? "Meeting" : "Call"} summary: ${result.summary}`];
  if (result.keyPoints.length) lines.push("", "Key points:", ...result.keyPoints.map((p) => `- ${p}`));
  if (result.nextSteps.length) lines.push("", "Next steps:", ...result.nextSteps.map((p) => `- ${p}`));
  const d = result.details;
  const facts = [
    d.noticePeriod && `Notice: ${d.noticePeriod}`,
    d.salaryExpectation && `Salary: ${d.salaryExpectation}`,
    d.availableFrom && `Available from: ${d.availableFrom}`,
    d.otherProcesses && `Other processes: ${d.otherProcesses}`,
  ].filter(Boolean);
  if (facts.length) lines.push("", ...facts);
  return lines.join("\n").slice(0, 5000);
}
