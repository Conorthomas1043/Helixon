"use client";

// Part of the candidate profile page (../page.jsx).

import { CARD, INK, INK_FAINT, INK_MUTED, dayBucketLabel, formatTime } from "@/lib/candidate-format";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { useMemo } from "react";
import { SectionHeading } from "./primitives";

export function activityDescription(entry) {
  switch (entry.type) {
    case "analysis_completed":
      return entry.meta?.score != null ? `Match score ${entry.meta.score}` : entry.meta?.note ?? "";
    case "stage_changed":
      return `${STAGE_LABELS[entry.meta?.from] ?? "Unassigned"} → ${STAGE_LABELS[entry.meta?.to] ?? "Unknown"}${entry.meta?.sub ? ` (${entry.meta.sub})` : ""}`;
    case "assigned":
      return entry.meta?.from ? `${entry.meta.from} → ${entry.meta.to}` : `Assigned to ${entry.meta?.to ?? "someone"}`;
    case "tag_added":
    case "tag_removed":
      return entry.meta?.tag ?? "";
    case "next_action_set":
    case "next_action_completed":
      return entry.meta?.label ?? "";
    case "call_logged":
    case "sms_logged":
    case "whatsapp_logged":
    case "email_logged":
    case "meeting_logged":
    case "cv_sent_logged":
    case "details_updated":
    case "data_exported":
    case "retention_extended":
    case "talent_pool_added":
    case "shortlist_added":
    case "shortlist_removed":
    case "feedback_request_sent":
    case "interview_scheduled":
    case "interview_rescheduled":
    case "interview_invite_sent":
    case "interview_status":
    case "interview_outcome":
    case "scorecard_submitted":
    case "scorecard_requested":
    case "email_received":
    case "applied":
    case "imported":
    case "sequence_enrolled":
    case "sequence_stopped":
    case "client_profile_printed":
    case "placement_recorded":
    case "sub_stage_changed":
    case "compliance_check":
    case "reference_requested":
    case "reference_received":
    case "privacy_notice_sent":
    case "consent_recorded":
    case "consent_withdrawn":
    case "signature_requested":
    case "signature_signed":
    case "signature_declined":
    case "portal_link_created":
    case "candidate_self_updated":
    case "candidate_document_uploaded":
    case "booking_link_created":
    case "candidate_merged":
    case "candidate_linked":
    case "call_notes_summarised":
    case "sms_received":
      return entry.meta?.note ?? "";
    case "rescreened":
      return entry.meta?.job_title ? `${entry.meta.job_title}${entry.meta.match_score != null ? ` · ${entry.meta.match_score}` : ""}` : "";
    default:
      return "";
  }
}

export const EVENT_LABELS = {
  cv_uploaded: "CV uploaded",
  screened: "Screened",
  cv_viewed: "CV opened",
  cv_downloaded: "CV downloaded",
  analysis_completed: "Analysis completed",
  stage_changed: "Stage changed",
  assigned: "Assigned",
  tag_added: "Tag added",
  tag_removed: "Tag removed",
  note_added: "Note added",
  next_action_set: "Next action set",
  next_action_completed: "Next action completed",
  call_logged: "Call logged",
  sms_logged: "Text sent",
  whatsapp_logged: "WhatsApp sent",
  email_logged: "Email logged",
  meeting_logged: "Meeting logged",
  cv_sent_logged: "CV sent",
  details_updated: "Details edited",
  talent_pool_added: "Saved to talent pool",
  talent_pool_removed: "Removed from talent pool",
  rescreened: "Screened for another job",
  data_exported: "Data exported",
  talent_pool_expired: "Left the talent pool (retention policy)",
  retention_extended: "Kept past the retention period",
  shortlist_added: "Added to shortlist",
  shortlist_removed: "Removed from shortlist",
  feedback_request_sent: "Feedback request emailed",
  interview_scheduled: "Interview scheduled",
  interview_rescheduled: "Interview rescheduled",
  interview_invite_sent: "Interview invite sent",
  interview_status: "Interview updated",
  interview_outcome: "Interview outcome",
  scorecard_submitted: "Scorecard received",
  scorecard_requested: "Scorecard requested",
  email_received: "Email received",
  applied: "Applied",
  imported: "Imported",
  sequence_enrolled: "Added to sequence",
  sequence_stopped: "Sequence stopped",
  client_profile_printed: "Client profile printed",
  placement_recorded: "Offer / placement",
  sub_stage_changed: "Sub-stage changed",
  compliance_check: "Compliance check",
  reference_requested: "Reference requested",
  reference_received: "Reference received",
  privacy_notice_sent: "Privacy notice sent",
  consent_recorded: "Consent recorded",
  consent_withdrawn: "Consent withdrawn",
  signature_requested: "Sent for signature",
  signature_signed: "Document signed",
  signature_declined: "Signature declined",
  portal_link_created: "Self-service link",
  candidate_self_updated: "Updated their details",
  candidate_document_uploaded: "Uploaded a document",
  booking_link_created: "Interview times offered",
  candidate_merged: "Duplicate merged",
  candidate_linked: "Linked as same person",
  call_notes_summarised: "Call notes",
  sms_received: "Text received",
};

export function ActivityTimeline({ activity }) {
  const groups = useMemo(() => {
    const byDay = new Map();
    activity.forEach((entry) => {
      const label = dayBucketLabel(entry.timestamp);
      if (!byDay.has(label)) byDay.set(label, []);
      byDay.get(label).push(entry);
    });
    return Array.from(byDay.entries());
  }, [activity]);

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="History" title="Activity" />
      {groups.length === 0 ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>
          Activity will appear here as the team works this candidate.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, entries]) => (
            <div key={day}>
              <p className="text-[12px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: INK_FAINT }}>
                {day}
              </p>
              <ul className="space-y-3">
                {entries.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3">
                    <span
                      className="text-[12px] tabular-nums shrink-0 w-11 pt-0.5"
                      style={{ fontFamily: "var(--font-mono)", color: INK_FAINT }}
                    >
                      {formatTime(entry.timestamp)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold" style={{ color: INK }}>
                        {entry.meta?.sent_via === "helixon" ? "Email sent" : EVENT_LABELS[entry.type] ?? entry.type}
                      </p>
                      <p className="text-[13px]" style={{ color: INK_MUTED }}>
                        {activityDescription(entry)}
                        {entry.actor ? ` · ${entry.actor}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Recruiter workspace (stage / recruiter / tags / next action)
 * ---------------------------------------------------------------------- */
