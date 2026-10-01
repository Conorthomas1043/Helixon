// Interview invites: an email with an .ics calendar invite (lib/ics.js) to
// the candidate, the client's hiring contact and anyone else named. The
// same UID is reused for updates (higher SEQUENCE) and cancellations, so
// calendars move or remove the event rather than adding another.

import { buildInvite } from "@/lib/ics";
import { INTERVIEW_KINDS, formatInterviewTime } from "@/lib/interviews";
import { sendAgencyEmail, agencyFromName, senderEmail } from "@/lib/mailer";
import { recruiterDisplayName } from "@/lib/recruiter-directory";

const TZ = "Europe/London";

// Plain-text body for one recipient. `audience`: "candidate" | "client".
export function inviteText({ audience, method, candidateName, jobTitle, client, interview, agencyName, recruiterName }) {
  const when = formatInterviewTime(interview.starts_at, interview.duration_minutes, TZ);
  const role = [jobTitle, client && audience === "candidate" ? `at ${client}` : null].filter(Boolean).join(" ");
  const what = audience === "candidate" ? `your interview${role ? ` for ${role}` : ""}` : `your interview with ${candidateName}${jobTitle ? ` for ${jobTitle}` : ""}`;
  if (method === "CANCEL") {
    return {
      subject: `Cancelled: interview${audience === "candidate" ? (jobTitle ? ` - ${jobTitle}` : "") : ` with ${candidateName}`}`,
      text: [`Hi,`, "", `${what.charAt(0).toUpperCase()}${what.slice(1)} on ${when} has been cancelled. We'll be in touch about next steps.`, "", recruiterName || "", agencyName].join("\n"),
    };
  }
  const lines = [
    "Hi,",
    "",
    `${method === "UPDATE" ? "Updated details for" : "Here are the details for"} ${what}:`,
    "",
    `When: ${when} (UK time)`,
    `Format: ${INTERVIEW_KINDS[interview.kind] || "Interview"}${interview.round > 1 ? ` - round ${interview.round}` : ""}`,
  ];
  if (interview.location) lines.push(`${interview.kind === "in_person" ? "Where" : interview.kind === "phone" ? "Number" : "Link"}: ${interview.location}`);
  if (interview.interviewers && audience === "candidate") lines.push(`With: ${interview.interviewers}`);
  if (interview.notes && audience === "candidate") lines.push("", interview.notes);
  lines.push("", "The attached invite adds it to your calendar.", "", "Thanks,", recruiterName || "", agencyName);
  return {
    subject: `${method === "UPDATE" ? "Updated: " : ""}Interview${audience === "candidate" ? (jobTitle ? ` - ${jobTitle}` : "") : ` with ${candidateName}`} - ${when}`,
    text: lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n"),
  };
}

// method: "REQUEST" (new) | "UPDATE" (changed) | "CANCEL". recipients:
// [{ email, name, audience }]. Returns { sent: [email], failed: [email] }.
export async function sendInterviewInvites({ auth, interview, candidate, job, recipients, method = "REQUEST" }) {
  const agencyName = await agencyFromName(auth.agencyId, auth.profile);
  const recruiterName = recruiterDisplayName(auth.profile);
  const organizerEmail = await senderEmail();
  const candidateName = candidate.full_name || candidate.name || "the candidate";
  const sent = [];
  const failed = [];
  const attendees = recipients.map((r) => ({ name: r.name, email: r.email }));
  const ics = buildInvite({
    uid: `${interview.id}@helixon.co.uk`,
    sequence: interview.ics_sequence,
    method: method === "CANCEL" ? "CANCEL" : "REQUEST",
    start: interview.starts_at,
    durationMinutes: interview.duration_minutes,
    summary: `Interview: ${candidateName}${job?.title ? ` - ${job.title}` : ""}`,
    description: [interview.notes, interview.interviewers ? `Interviewers: ${interview.interviewers}` : null].filter(Boolean).join("\n"),
    location: interview.location,
    organizer: organizerEmail ? { name: recruiterName || agencyName, email: organizerEmail } : null,
    attendees,
  });
  for (const r of recipients) {
    const { subject, text } = inviteText({ audience: r.audience, method, candidateName, jobTitle: job?.title, client: job?.client, interview, agencyName, recruiterName });
    const res = await sendAgencyEmail({
      agencyId: auth.agencyId,
      profile: auth.profile,
      to: r.email,
      subject,
      text,
      fromName: agencyName,
      replyTo: organizerEmail,
      attachments: [{ filename: method === "CANCEL" ? "cancel.ics" : "invite.ics", content: Buffer.from(ics).toString("base64"), contentType: `text/calendar; method=${method === "CANCEL" ? "CANCEL" : "REQUEST"}` }],
    });
    (res.error ? failed : sent).push(r.email);
  }
  return { sent, failed };
}
