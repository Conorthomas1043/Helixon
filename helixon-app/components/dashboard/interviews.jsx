"use client";

// Interview UI shared by the candidate profile and /dashboard/interviews:
// scheduling (with calendar invites), rescheduling, outcomes and scorecards.

import { useState } from "react";
import Link from "next/link";
import {
  scheduleInterview,
  updateInterview,
  submitScorecard,
  requestScorecard,
  deleteScorecard,
} from "@/lib/dashboard-api";
import {
  DEFAULT_CRITERIA,
  INTERVIEW_KINDS,
  INTERVIEW_OUTCOMES,
  INTERVIEW_STATUSES,
  RECOMMENDATIONS,
  formatInterviewTime,
} from "@/lib/interviews";
import { Button, Dialog, ErrorText, Field, Pill, Select, TextArea, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";
import { RatingPicker } from "@/components/public/PublicCard";
import CopyButton from "@/components/dashboard/CopyButton";

const TZ = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Europe/London";

// "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">.
function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86400000);
  if (!iso) d.setHours(10, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_STYLE = {
  scheduled: { color: "#5b4bc4", background: "#f1effc" },
  completed: { color: "var(--forest)", background: "var(--mint)" },
  cancelled: { color: INK_FAINT, background: "var(--mist)" },
  no_show: { color: "#b42318", background: "#fef2f2" },
};

export function InterviewStatusPill({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.scheduled;
  return (
    <Pill color={s.color} background={s.background}>
      {INTERVIEW_STATUSES[status] ?? status}
    </Pill>
  );
}

// Schedule a new interview (candidate given) or edit one (interview given).
export function ScheduleInterviewDialog({ candidate, interview, onClose, onSaved }) {
  const editing = Boolean(interview);
  const [f, setF] = useState({
    startsAt: toLocalInput(interview?.startsAt),
    durationMinutes: String(interview?.durationMinutes ?? 60),
    kind: interview?.kind ?? "video",
    location: interview?.location ?? "",
    interviewers: interview?.interviewers ?? "",
    notes: interview?.notes ?? "",
  });
  const [inviteCandidate, setInviteCandidate] = useState(Boolean(candidate?.email));
  const [inviteContact, setInviteContact] = useState(true);
  const [extra, setExtra] = useState("");
  const [moveStage, setMoveStage] = useState(true);
  const [notify, setNotify] = useState(Boolean(interview?.invitedAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fields = { ...f, startsAt: new Date(f.startsAt).toISOString(), durationMinutes: Number(f.durationMinutes) };
    try {
      let res;
      if (editing) {
        res = await updateInterview(interview.id, { ...fields, notify });
      } else {
        res = await scheduleInterview({
          ...fields,
          candidateId: candidate.id,
          moveToInterview: moveStage,
          invite: {
            candidate: inviteCandidate,
            contact: inviteContact,
            extra: extra.split(/[\s,;]+/).filter(Boolean),
          },
        });
      }
      onSaved(res);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const locationLabel = f.kind === "in_person" ? "Address" : f.kind === "phone" ? "Phone number / who calls whom" : "Video link";

  return (
    <Dialog title={editing ? "Edit interview" : `Schedule interview${candidate?.name ? ` - ${candidate.name}` : ""}`} onClose={onClose} busy={saving} width={600}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={`When (${TZ})`} className="sm:col-span-2">
            <TextInput type="datetime-local" required value={f.startsAt} onChange={set("startsAt")} />
          </Field>
          <Field label="Length">
            <Select
              value={f.durationMinutes}
              onChange={set("durationMinutes")}
              options={[15, 30, 45, 60, 90, 120, 180].map((m) => ({ value: String(m), label: m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}` }))}
            />
          </Field>
          <Field label="Format">
            <Select value={f.kind} onChange={set("kind")} options={Object.entries(INTERVIEW_KINDS).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label={locationLabel} className="sm:col-span-2">
            <TextInput maxLength={500} value={f.location} onChange={set("location")} />
          </Field>
          <Field label="Interviewers" className="sm:col-span-3">
            <TextInput maxLength={500} value={f.interviewers} onChange={set("interviewers")} placeholder="e.g. Priya Shah (Head of Data), Tom Green" />
          </Field>
          <Field label="Notes for the candidate" className="sm:col-span-3">
            <TextArea maxLength={2000} value={f.notes} onChange={set("notes")} placeholder="What to prepare, who to ask for at reception…" />
          </Field>
        </div>

        {!editing ? (
          <fieldset className="space-y-2 rounded-[10px] p-3" style={{ background: "var(--mist)" }}>
            <legend className="sr-only">Calendar invites</legend>
            <p className="text-[13px] font-semibold" style={{ color: INK }}>Send calendar invites to</p>
            <label className="flex items-center gap-2 text-[14px]" style={{ color: candidate?.email ? INK : INK_FAINT }}>
              <input type="checkbox" disabled={!candidate?.email} checked={inviteCandidate} onChange={(e) => setInviteCandidate(e.target.checked)} className="accent-[var(--forest)]" />
              The candidate {candidate?.email ? `(${candidate.email})` : "- no email on file"}
            </label>
            <label className="flex items-center gap-2 text-[14px]" style={{ color: INK }}>
              <input type="checkbox" checked={inviteContact} onChange={(e) => setInviteContact(e.target.checked)} className="accent-[var(--forest)]" />
              The job&apos;s hiring contact (if it has one with an email)
            </label>
            <TextInput value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Other interviewers' emails, comma separated" aria-label="Other invitees" />
            <label className="flex items-center gap-2 text-[14px] pt-1" style={{ color: INK }}>
              <input type="checkbox" checked={moveStage} onChange={(e) => setMoveStage(e.target.checked)} className="accent-[var(--forest)]" />
              Move them to the Interview stage
            </label>
          </fieldset>
        ) : (
          interview.invitedAt && (
            <label className="flex items-center gap-2 text-[14px]" style={{ color: INK }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[var(--forest)]" />
              Send the updated invite to everyone invited
            </label>
          )
        )}

        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : "Schedule"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ScorecardDialog({ interview, onClose, onSaved }) {
  const [overall, setOverall] = useState(null);
  const [recommendation, setRecommendation] = useState("");
  const [ratings, setRatings] = useState({});
  const [text, setText] = useState({ strengths: "", concerns: "", comments: "", reviewerName: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await submitScorecard(interview.id, {
        overallRating: overall,
        recommendation,
        criteria: DEFAULT_CRITERIA.map((name) => ({ name, rating: ratings[name] ?? null })),
        ...text,
        reviewerName: text.reviewerName || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Dialog title={`Scorecard - ${interview.candidateName}, round ${interview.round}`} onClose={onClose} busy={saving} width={600}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[14px] font-semibold" style={{ color: INK }}>Overall</span>
          <RatingPicker value={overall} onChange={setOverall} label="Overall rating" />
        </div>
        {DEFAULT_CRITERIA.map((name) => (
          <div key={name} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[14px]" style={{ color: INK }}>{name}</span>
            <RatingPicker value={ratings[name] ?? null} onChange={(n) => setRatings((r) => ({ ...r, [name]: n }))} label={name} />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {Object.entries(RECOMMENDATIONS).map(([v, l]) => (
            <Button key={v} variant={recommendation === v ? "primary" : "secondary"} aria-pressed={recommendation === v} onClick={() => setRecommendation(v)}>
              {l}
            </Button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Strengths">
            <TextArea maxLength={3000} value={text.strengths} onChange={(e) => setText((t) => ({ ...t, strengths: e.target.value }))} />
          </Field>
          <Field label="Concerns">
            <TextArea maxLength={3000} value={text.concerns} onChange={(e) => setText((t) => ({ ...t, concerns: e.target.value }))} />
          </Field>
          <Field label="Comments" className="sm:col-span-2">
            <TextArea maxLength={3000} value={text.comments} onChange={(e) => setText((t) => ({ ...t, comments: e.target.value }))} />
          </Field>
          <Field label="Interviewer" hint="Leave blank if it's you." className="sm:col-span-2">
            <TextInput maxLength={200} value={text.reviewerName} onChange={(e) => setText((t) => ({ ...t, reviewerName: e.target.value }))} placeholder="e.g. Feedback from Priya, taken by phone" />
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving || !overall || !recommendation}>
            {saving ? "Saving…" : "Save scorecard"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RequestScorecardDialog({ interview, onClose, onSaved }) {
  const [f, setF] = useState({ reviewerName: interview.contactName || "", reviewerEmail: interview.contactEmail || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function submit(send) {
    setSaving(true);
    setError("");
    try {
      const res = await requestScorecard(interview.id, { ...f, send });
      setResult(res);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="Ask an interviewer for a scorecard" onClose={onClose} busy={saving}>
      {result ? (
        <div className="space-y-3 text-[14px]" style={{ color: INK }}>
          <p>{result.emailed ? `Sent to ${f.reviewerEmail}.` : result.sendError ? `The link was created, but ${result.sendError.toLowerCase()} Copy it below.` : "Here's their private link:"}</p>
          <TextInput readOnly value={result.url} onFocus={(e) => e.target.select()} aria-label="Scorecard link" />
          <div className="flex gap-2">
            <CopyButton text={result.url}>Copy link</CopyButton>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[14px]" style={{ color: INK_MUTED }}>
            They get a private link to rate {interview.candidateName} - no account needed. Their scorecard appears here when they send it.
          </p>
          <Field label="Interviewer's name">
            <TextInput maxLength={200} value={f.reviewerName} onChange={(e) => setF((v) => ({ ...v, reviewerName: e.target.value }))} />
          </Field>
          <Field label="Their email">
            <TextInput type="email" maxLength={254} value={f.reviewerEmail} onChange={(e) => setF((v) => ({ ...v, reviewerEmail: e.target.value }))} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={saving || !f.reviewerEmail.trim()} onClick={() => submit(true)}>
              {saving ? "Sending…" : "Email the link"}
            </Button>
            <Button disabled={saving || (!f.reviewerName.trim() && !f.reviewerEmail.trim())} onClick={() => submit(false)}>
              Just create the link
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ScorecardSummary({ interview, onRemove }) {
  const s = interview.scorecardSummary;
  if (!interview.scorecards.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {interview.scorecards.map((c) => (
        <div key={c.id} className="text-[13px] flex items-start justify-between gap-2" style={{ color: INK_MUTED }}>
          <span className="min-w-0">
            <span className="font-semibold" style={{ color: INK }}>{c.reviewerName || c.reviewerEmail || "Interviewer"}</span>
            {c.submittedAt ? (
              <>
                {" "}· {c.overallRating}/5 · {RECOMMENDATIONS[c.recommendation]}
                {c.criteria?.some((x) => x.rating) && (
                  <span className="block" style={{ color: INK_FAINT }}>
                    {c.criteria.filter((x) => x.rating).map((x) => `${x.name} ${x.rating}`).join(" · ")}
                  </span>
                )}
                {c.strengths && <span className="block">+ {c.strengths}</span>}
                {c.concerns && <span className="block">− {c.concerns}</span>}
              </>
            ) : (
              " · waiting for their scorecard"
            )}
          </span>
          {!c.submittedAt && onRemove && (
            <button type="button" className="text-[12px] font-semibold shrink-0" style={{ color: INK_FAINT }} onClick={() => onRemove(c)}>
              Withdraw
            </button>
          )}
        </div>
      ))}
      {s.submitted > 1 && (
        <p className="text-[12px]" style={{ color: INK_FAINT }}>
          Average {s.averageRating}/5 from {s.submitted} scorecards
        </p>
      )}
    </div>
  );
}

// One interview row with its actions. `onChanged` reloads the list.
export function InterviewItem({ interview, onChanged, showCandidate = false }) {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Captured once per mount - "past" only needs minute-level accuracy.
  const [now] = useState(() => Date.now());
  const past = new Date(interview.startsAt).getTime() < now;

  async function patch(fields) {
    setBusy(true);
    setError("");
    try {
      await updateInterview(interview.id, fields);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(notify) {
    setDialog(null);
    await patch({ status: "cancelled", notify });
  }

  async function removeCard(card) {
    try {
      await deleteScorecard(interview.id, card.id);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  const close = () => setDialog(null);
  const saved = () => {
    setDialog(null);
    onChanged();
  };

  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold" style={{ color: INK }}>
            {showCandidate ? (
              <Link href={`/dashboard/candidates/${interview.candidateId}`} className="hover:underline">
                {interview.candidateName}
              </Link>
            ) : (
              `Round ${interview.round}`
            )}{" "}
            <InterviewStatusPill status={interview.status} />{" "}
            {interview.outcome && <Pill>{INTERVIEW_OUTCOMES[interview.outcome]}</Pill>}
          </p>
          <p className="text-[13px]" style={{ color: INK_MUTED }}>
            {formatInterviewTime(interview.startsAt, interview.durationMinutes, TZ)} · {INTERVIEW_KINDS[interview.kind]}
            {showCandidate && interview.round > 1 ? ` · round ${interview.round}` : ""}
            {showCandidate && interview.jobTitle ? ` · ${interview.jobTitle}${interview.client ? ` at ${interview.client}` : ""}` : ""}
          </p>
          {(interview.location || interview.interviewers) && (
            <p className="text-[13px] truncate" style={{ color: INK_FAINT }}>
              {[interview.interviewers, interview.location].filter(Boolean).join(" · ")}
            </p>
          )}
          {!interview.invitedAt && interview.status === "scheduled" && (
            <p className="text-[12px]" style={{ color: INK_FAINT }}>No calendar invite sent</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {interview.status === "scheduled" && (
            <>
              {past && (
                <>
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => patch({ status: "completed" })}>
                    Mark done
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => patch({ status: "no_show" })}>
                    No-show
                  </Button>
                </>
              )}
              <Button size="sm" disabled={busy} onClick={() => setDialog("edit")}>
                {past ? "Edit" : "Reschedule"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => (interview.invitedAt ? setDialog("cancel") : cancel(false))}>
                Cancel
              </Button>
            </>
          )}
          {(interview.status === "completed" || past) && interview.status !== "cancelled" && (
            <>
              <Button size="sm" disabled={busy} onClick={() => setDialog("scorecard")}>
                + Scorecard
              </Button>
              <Button size="sm" disabled={busy} onClick={() => setDialog("request")}>
                Ask interviewer
              </Button>
            </>
          )}
          {interview.status === "completed" && (
            <select
              aria-label="Outcome"
              value={interview.outcome ?? ""}
              disabled={busy}
              onChange={(e) => patch({ outcome: e.target.value || null })}
              className="text-[12px] font-semibold px-2 py-1 rounded-full bg-white"
              style={{ border: "1px solid var(--border)", color: INK }}
            >
              <option value="">Outcome…</option>
              {Object.entries(INTERVIEW_OUTCOMES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <ScorecardSummary interview={interview} onRemove={removeCard} />
      <ErrorText>{error}</ErrorText>
      {dialog === "edit" && <ScheduleInterviewDialog interview={interview} onClose={close} onSaved={saved} />}
      {dialog === "cancel" && (
        <Dialog title="Cancel this interview?" onClose={close}>
          <p className="text-[14px] mb-4" style={{ color: INK_MUTED }}>
            A calendar invite went out for it. Sending a cancellation removes it from everyone&apos;s calendar.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => cancel(true)}>Cancel and notify everyone</Button>
            <Button onClick={() => cancel(false)}>Cancel quietly</Button>
            <Button variant="ghost" onClick={close}>Keep it</Button>
          </div>
        </Dialog>
      )}
      {dialog === "scorecard" && <ScorecardDialog interview={interview} onClose={close} onSaved={saved} />}
      {dialog === "request" && <RequestScorecardDialog interview={interview} onClose={close} onSaved={onChanged} />}
    </li>
  );
}
