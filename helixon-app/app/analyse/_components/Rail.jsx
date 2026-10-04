"use client";

// The action rail beside the report: move the candidate on, leave a note for
// the team, draft/send an email, and tell us whether the assessment was right.
// Everything here writes to the real, shared records (candidates.stage,
// candidate_notes, email artifacts), not to this browser.

import { useState } from "react";
import { updateCandidateStage, addCandidateNote, saveToTalentPool, removeFromTalentPool } from "@/lib/dashboard-api";
import { FUNNEL_ORDER, STAGE_COLORS } from "@/lib/stage-labels";
import { Card, Button, Icon, Textarea, Input, Select, Label, cx } from "./ui";
import { EMAIL_PURPOSES, FEEDBACK_BANDS, FEEDBACK_DOWN_REASONS } from "../_lib/analyse";

function RailCard({ title, children, action }) {
  return (
    <Card className="px-4 py-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[14.5px] font-semibold text-[var(--ink)]">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

// A new analysis always lands at "Screened" (see app/api/run), so that's
// the starting value. Keyed by candidateId where it's rendered, so the next
// candidate starts fresh.
export function StageCard({ candidateId, toast }) {
  const [stage, setStage] = useState("Screened");
  const [saving, setSaving] = useState(false);
  const [pooled, setPooled] = useState(false);
  const [pooling, setPooling] = useState(false);

  // Keep them for future jobs (the talent pool - /dashboard/talent-pool).
  async function togglePool() {
    setPooling(true);
    try {
      if (pooled) await removeFromTalentPool(candidateId);
      else await saveToTalentPool(candidateId);
      setPooled(!pooled);
      toast(pooled ? "Removed from the talent pool" : "Saved to the talent pool");
    } catch {
      toast("Couldn't update the talent pool - try again", "error");
    } finally {
      setPooling(false);
    }
  }

  async function update(next) {
    if (next === stage || saving) return;
    const previous = stage;
    setStage(next);
    setSaving(true);
    try {
      await updateCandidateStage(candidateId, next);
      toast(`Moved to ${next}`);
    } catch {
      setStage(previous);
      toast("Couldn't update the stage - try again", "error");
    } finally {
      setSaving(false);
    }
  }

  const rejected = stage === "Rejected";
  const idx = FUNNEL_ORDER.indexOf(stage);

  return (
    <RailCard
      title="Pipeline stage"
      action={
        <a href={`/dashboard/candidates/${candidateId}`} className="text-[13px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
          Open profile
        </a>
      }
    >
      <ol className="space-y-0.5" aria-label="Pipeline stage">
        {FUNNEL_ORDER.map((s, i) => {
          const reached = !rejected && i <= idx;
          const current = !rejected && i === idx;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={saving}
                onClick={() => update(s)}
                aria-current={current ? "step" : undefined}
                className={cx(
                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-left text-[14px] transition-colors disabled:opacity-60",
                  current ? "bg-[var(--mist)] font-medium text-[var(--ink)]" : "hover:bg-[var(--mist)] text-[var(--ink-soft)]"
                )}
              >
                <span
                  className="w-3 h-3 rounded-full border-2 shrink-0"
                  style={{ background: reached ? STAGE_COLORS[s] : "white", borderColor: reached ? STAGE_COLORS[s] : "var(--border)" }}
                />
                {s}
                {current && <span className="ml-auto text-[12px] text-[var(--ink-faint)]">Current</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 pt-2 border-t border-[var(--border-soft)]">
        <button
          type="button"
          disabled={saving}
          onClick={() => update(rejected ? "Screened" : "Rejected")}
          className={cx(
            "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-left text-[14px] transition-colors disabled:opacity-60",
            rejected ? "bg-[#fbefed] text-[#a83226] font-medium" : "text-[var(--ink-soft)] hover:bg-[#fbefed] hover:text-[#a83226]"
          )}
        >
          <Icon name="x" size={13} />
          {rejected ? "Rejected - undo" : "Reject candidate"}
        </button>
        <button
          type="button"
          disabled={pooling}
          onClick={togglePool}
          title="Keep them for future roles - screen them against a new job later without re-uploading"
          className={cx(
            "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-left text-[14px] transition-colors disabled:opacity-60",
            pooled ? "bg-[var(--mint)] text-[var(--forest-deep)] font-medium" : "text-[var(--ink-soft)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
          )}
        >
          <Icon name="bookmark" size={13} />
          {pooled ? "In talent pool - undo" : "Save to talent pool"}
        </button>
      </div>
    </RailCard>
  );
}

export function NotesCard({ candidateId, toast }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const body = note.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      await addCandidateNote(candidateId, body);
      setNote("");
      toast("Note saved to the candidate");
    } catch {
      toast("Couldn't save the note - try again", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RailCard title="Team note">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
        }}
        rows={3}
        placeholder="Visible to everyone at your agency"
        aria-label="Team note"
        className="text-[14px] resize-none"
      />
      <div className="flex justify-end mt-2">
        <Button size="sm" variant="dark" onClick={save} disabled={saving || !note.trim()}>
          {saving ? "Saving…" : "Save note"}
        </Button>
      </div>
    </RailCard>
  );
}

export function EmailCard({ email }) {
  const {
    purpose,
    setPurpose,
    draft,
    edited,
    setEdited,
    loading,
    generate,
    copied,
    copy,
    recipient,
    setRecipient,
    sending,
    sent,
    send,
    clientEmailMissing,
  } = email;
  const audience = EMAIL_PURPOSES.find((p) => p.value === purpose)?.audience;

  return (
    <RailCard title="Email">
      <Label htmlFor="email-purpose">Purpose</Label>
      <Select id="email-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="text-[14px]">
        {EMAIL_PURPOSES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>

      {!draft ? (
        <Button className="w-full mt-3" onClick={generate} disabled={loading} icon={loading ? undefined : "mail"}>
          {loading ? "Drafting…" : "Draft email"}
        </Button>
      ) : (
        <div className="mt-3">
          <Textarea value={edited} onChange={(e) => setEdited(e.target.value)} rows={9} aria-label="Email draft" className="text-[14px]" />
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="flex-1" onClick={copy} icon={copied ? "check" : "copy"}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" onClick={generate} disabled={loading} icon="refresh">
              {loading ? "…" : "Redraft"}
            </Button>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border-soft)]">
            <Label htmlFor="recipient">Send to</Label>
            <Input
              id="recipient"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={audience === "client" ? "client@company.com" : "candidate@email.com"}
              className="text-[14px]"
            />
            {clientEmailMissing && <p className="text-[12.5px] text-[var(--score-mid)] mt-1.5">No client email on this role - add one to send.</p>}
            <Button variant="primary" className="w-full mt-2" onClick={send} disabled={sending || !recipient.trim()} icon={sent ? "check" : "send"}>
              {sending ? "Sending…" : sent ? "Sent" : "Send"}
            </Button>
          </div>
        </div>
      )}
    </RailCard>
  );
}

export function FeedbackCard({ feedback }) {
  const { sent, rating, reason, submit } = feedback;
  const [picking, setPicking] = useState(false);
  // Thumbs down is two quick steps: what was off, then where the candidate
  // should sit. The band is the label scoring calibration learns from.
  const [downReason, setDownReason] = useState(null);

  if (sent) {
    return (
      <Card className="px-4 py-3.5">
        <p className="text-[14px] text-[var(--ink-soft)] flex items-center gap-2">
          <Icon name="check" size={14} className="text-[var(--forest)]" />
          Thanks - {rating === "up" ? "glad it matched your read." : `noted${reason ? `: ${reason.toLowerCase()}` : ""}.`}
        </p>
      </Card>
    );
  }

  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] text-[var(--ink)]">Does this match your read?</p>
        <div className="flex gap-1">
          <button type="button" onClick={() => submit("up")} aria-label="Yes, accurate" className="p-1.5 rounded-[7px] text-[var(--ink-soft)] hover:bg-[var(--mist)] hover:text-[var(--forest)]">
            <Icon name="thumbUp" size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-expanded={picking}
            aria-label="No, not quite"
            className={cx("p-1.5 rounded-[7px] hover:bg-[var(--mist)]", picking ? "text-[var(--score-low)] bg-[var(--mist)]" : "text-[var(--ink-soft)] hover:text-[var(--score-low)]")}
          >
            <Icon name="thumbDown" size={16} />
          </button>
        </div>
      </div>
      {picking && !downReason && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {FEEDBACK_DOWN_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setDownReason(r)} className="h-7 px-2.5 rounded-[7px] border border-[var(--border)] text-[13px] text-[var(--ink-soft)] hover:border-[var(--ink-mute)] hover:text-[var(--ink)]">
              {r}
            </button>
          ))}
        </div>
      )}
      {picking && downReason && (
        <div className="mt-3">
          <p className="text-[13.5px] text-[var(--ink-soft)] mb-1.5">Where should this candidate sit?</p>
          <div className="flex flex-wrap gap-1.5">
            {FEEDBACK_BANDS.map((band) => (
              <button key={band} type="button" onClick={() => submit("down", downReason, band)} className="h-7 px-2.5 rounded-[7px] border border-[var(--border)] text-[13px] text-[var(--ink-soft)] hover:border-[var(--ink-mute)] hover:text-[var(--ink)]">
                {band}
              </button>
            ))}
            <button type="button" onClick={() => submit("down", downReason)} className="h-7 px-2.5 rounded-[7px] text-[13px] text-[var(--ink-faint)] hover:text-[var(--ink)]">
              Skip
            </button>
          </div>
        </div>
      )}
      <p className="text-[12.5px] text-[var(--ink-faint)] mt-2">Used to tune scoring. It never changes this candidate&apos;s score.</p>
    </Card>
  );
}
