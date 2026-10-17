"use client";

// The assessment, laid out as one readable document rather than a stack of
// tabs: verdict first, then the evidence behind it. Section links at the top
// jump within the page. Colour is reserved for the score and for problems.

import { useEffect, useState } from "react";
import { Card, Icon, Notice, cx } from "./ui";
import { bandClasses, scoreTone } from "../_lib/analyse";
import AiWritingNotice from "@/components/dashboard/AiWritingNotice";
import CountUp from "@/components/dashboard/CountUp";
import { addCandidateNote, pinCandidateNote } from "@/lib/dashboard-api";

// Text and pill colours for a score band, as classes (the band colours are
// tokens, so they follow the dark appearance).
// The verdict: a ring that fills to the score while the number counts up,
// once, when the report opens (CountUp and motion-reduce keep it still for
// anyone who asks for less motion).
function ScoreRing({ score, stroke, grown }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-[112px] h-[112px] shrink-0" aria-hidden="true">
      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="var(--border-soft)" strokeWidth="9" />
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={grown ? c * (1 - Math.max(0, Math.min(100, score)) / 100) : c}
          className="transition-[stroke-dashoffset] duration-[1100ms] ease-out motion-reduce:transition-none"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-36 leading-none font-semibold tabular-nums tracking-tight font-display ${bandClasses(score).text}`}>
          <CountUp value={grown ? score : 0} duration={1000} />
        </span>
        <span className="text-12 text-[var(--ink-faint)] mt-1">out of 100</span>
      </span>
    </div>
  );
}

// A must-have's three states (scoreCandidate): met and not met are read
// from the CV; "unverified" means the CV can't say either way (right to
// work, a clearance), so it's something to ask, not a fail.
const REQUIREMENT_STATUS = {
  met: { label: "Met", icon: "check", pill: "bg-[var(--mint)] text-[var(--forest)] border-[var(--mint-line)]" },
  not_met: { label: "Not met", icon: "x", pill: "bg-[var(--ui-danger-soft)] text-[var(--score-low)] border-[var(--danger-line)]" },
  unverified: { label: "To confirm", icon: "info", pill: "bg-[var(--ui-warn-soft)] text-[var(--ui-warn)] border-[var(--warn-line)]" },
};

function requirementStatus(r) {
  return r.status && REQUIREMENT_STATUS[r.status] ? r.status : r.met ? "met" : "not_met";
}

// "location: Leeds" reads better as "Location: Leeds".
function requirementText(text = "") {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Copies one line, or all of them, and says so for a moment.
function CopyText({ text, label, children, className = "" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: nothing to do but leave the text selectable.
    }
  }
  return (
    <button type="button" onClick={copy} aria-label={label} className={cx("print-hide inline-flex items-center gap-1 rounded-md text-13 font-medium text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--mist)] transition-colors", className)}>
      <Icon name={copied ? "check" : "copy"} size={13} />
      {children}
      <span className="sr-only" role="status">{copied ? "Copied" : ""}</span>
    </button>
  );
}

// The interview questions as a pinned note on the candidate, so they're on
// the profile when the interview comes round (and visible to the team).
function SaveQuestions({ candidateId, questions }) {
  const [state, setState] = useState("idle");
  async function save() {
    setState("saving");
    try {
      const body = `Questions to ask at interview\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;
      const note = await addCandidateNote(candidateId, body);
      if (note?.id) await pinCandidateNote(candidateId, note.id, true).catch(() => {});
      setState("saved");
    } catch {
      setState("error");
    }
  }
  return (
    <button
      type="button"
      onClick={save}
      disabled={state === "saving" || state === "saved"}
      className="print-hide inline-flex items-center gap-1 rounded-md px-2 py-1 text-13 font-medium text-[var(--forest)] hover:bg-[var(--mist)] disabled:hover:bg-transparent transition-colors"
    >
      <Icon name={state === "saved" ? "check" : "plus"} size={13} />
      {state === "saving" ? "Saving…" : state === "saved" ? "Pinned to their notes" : state === "error" ? "Couldn't save - try again" : "Save to their notes"}
      <span className="sr-only" role="status">{state === "saved" ? "Saved to their notes" : ""}</span>
    </button>
  );
}

// Salary estimates carry their own currency and pay period - the role can
// be anywhere, and hourly work is shown as an hourly rate.
function fmtSalary(n, currency = "GBP", period = "year") {
  if (!n) return "";
  const hourlyOrDaily = period === "hour" || period === "day";
  try {
    return new Intl.NumberFormat("en-GB", hourlyOrDaily
      ? { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { style: "currency", currency, notation: "compact", maximumSignificantDigits: 3 }
    ).format(n);
  } catch {
    return hourlyOrDaily ? `${currency} ${n.toFixed(2)}` : `${currency} ${Math.round(n / 1000)}k`;
  }
}

const PAY_PERIOD_SUFFIX = { hour: " an hour", day: " a day" };

function yearRange(start, end) {
  if (!start && !end) return "";
  if (start && !end) return `${start} – present`;
  if (start === end) return String(start);
  return `${start} – ${end}`;
}

function externalUrl(value, base) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return base ? `${base}${value.replace(/^@/, "")}` : `https://${value}`;
}

function Meter({ value, tone, grown, delay = 0 }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--border-soft)] overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: grown ? `${Math.max(0, Math.min(100, value))}%` : 0, background: tone, transition: `width .8s cubic-bezier(0.16,1,0.3,1) ${delay}ms` }}
      />
    </div>
  );
}

function Section({ id, title, meta, children }) {
  return (
    <section id={id} className="scroll-mt-24 px-6 sm:px-8 py-7 border-t border-[var(--border-soft)]">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h3 className="text-15 font-semibold tracking-tight text-[var(--ink)] font-display">
          {title}
        </h3>
        {meta && <span className="text-13 text-[var(--ink-faint)]">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function BulletList({ items, marker = "dot", tone }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-15 leading-relaxed text-[var(--ink)]">
          {marker === "check" ? (
            <Icon name="check" size={14} className="mt-[3px] text-[var(--forest)]" strokeWidth={2.2} />
          ) : marker === "x" ? (
            <Icon name="x" size={14} className="mt-[3px]" strokeWidth={2.2} />
          ) : (
            <span className="mt-[9px] w-1 h-1 rounded-full shrink-0" style={{ background: tone || "var(--ink-mute)" }} />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SkillList({ title, items, tone, empty }) {
  return (
    <div>
      <p className="text-13 font-medium text-[var(--ink-soft)] mb-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />
        {title} <span className="text-[var(--ink-faint)] tabular-nums">{items.length}</span>
      </p>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((s, i) => (
            <li key={i} className="text-15 text-[var(--ink)] leading-snug">
              {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-14 text-[var(--ink-faint)]">{empty}</p>
      )}
    </div>
  );
}

// The CV's own words behind the matched skills (lib/screening/analysis-report
// skillEvidence): the line that earned the credit, so a recruiter can check
// the match instead of trusting it.
function CvQuotes({ quotes, onShowInCv }) {
  const [all, setAll] = useState(false);
  const shown = all ? quotes : quotes.slice(0, 4);
  return (
    <div className="mb-7">
      <p className="text-13 font-medium text-[var(--ink-soft)] mb-3">Where the CV shows it</p>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {shown.map((q) => (
          <li key={q.skill} className="rounded-xl border border-[var(--border-soft)] bg-[var(--mist)] px-3.5 py-3">
            <p className="text-13 font-semibold text-[var(--forest)] flex items-center gap-1.5">
              <Icon name="check" size={12} strokeWidth={2.6} />
              {q.skill}
            </p>
            <blockquote className="mt-1.5 text-14 leading-relaxed text-[var(--ink)] border-l-2 border-[var(--mint-line)] pl-2.5">
              &ldquo;{q.quote}&rdquo;
            </blockquote>
            {onShowInCv && (
              <button
                type="button"
                onClick={() => onShowInCv(q.skill)}
                aria-label={`Show ${q.skill} in the CV`}
                className="print-hide mt-1.5 -ml-1 inline-flex items-center gap-1 min-h-[32px] px-1 rounded text-13 font-medium text-[var(--forest)] hover:underline"
              >
                Show in CV
                <Icon name="arrowRight" size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {quotes.length > 4 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="print-hide mt-2.5 text-14 font-medium text-[var(--forest)] hover:underline">
          {all ? "Show fewer" : `Show all ${quotes.length}`}
        </button>
      )}
    </div>
  );
}

function ContactRow({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--border-soft)] last:border-b-0">
      <Icon name={icon} size={15} className="mt-0.5 text-[var(--ink-faint)]" />
      <span className="w-28 shrink-0 text-14 text-[var(--ink-soft)]">{label}</span>
      <span className="min-w-0 text-15 text-[var(--ink)] break-words">{children}</span>
    </div>
  );
}

// `embedded`: shown inside a split-view pane (app/dashboard/workspace), which
// scrolls on its own - the sticky section menu would float mid-pane there.
// `candidateId`, when known, lets the AI-writing notice ask whether it's right.
// `onShowInCv(skill)`, when given, adds a "Show in CV" link to each quote.
export default function Report({ result, roleLabel, embedded = false, candidateId = null, onShowInCv = null }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 120);
    return () => clearTimeout(t);
  }, [result]);

  if (!result) return null;
  // Section ids are the menu's anchors. Embedded reports have no menu, and
  // several on one page (the split view) mustn't repeat the same ids.
  const sectionId = (name) => (embedded ? undefined : name);

  const tone = scoreTone(result.match_score);
  const blind = !!result.blind_mode;
  const name = blind ? "Blind-screened candidate" : result.name && result.name !== "Candidate" ? result.name : "Candidate";
  const headline = [result.current_title, result.current_employer].filter(Boolean).join(" at ");

  const breakdown = [
    { key: "skills", label: "Skills", value: result.skill_score },
    { key: "experience", label: "Experience", value: result.experience_score },
    // Stored as culture_score, but it measures how relevant the candidate's
    // industry experience is (lib/cv-analysis/scoring), so it's named for that.
    { key: "culture", label: "Industry relevance", value: result.culture_score },
  ].filter((r) => r.value != null);

  const matched = result.matched_skills || [];
  const missingRequired = result.missing_required || [];
  const missingPreferred = result.missing_preferred || [];
  // Older results only have a flat missing list.
  const missingFlat = !missingRequired.length && !missingPreferred.length ? result.missing_skills || [] : [];
  const requirements = result.requirements_met || [];
  const metCount = requirements.filter((r) => requirementStatus(r) === "met").length;
  const quotes = result.skill_evidence || [];
  const capped = result.score_rationale?.capped || result.floor_capped || !!result.score_rationale?.cap_reason;
  const capReason = result.score_rationale?.cap_reason || result.cap_reason;

  const hasContact =
    !blind &&
    (result.email || result.phone || result.linkedin || result.github || result.portfolio_url || result.location || result.notice_period || result.willing_to_relocate != null);
  const experience = result.experience_breakdown || [];
  const maxYears = Math.max(1, ...experience.map((e) => e.years || 0));

  const sections = [
    { id: "overview", label: "Overview", show: true },
    { id: "requirements", label: "Must-haves", show: requirements.length > 0 },
    { id: "skills", label: "Skills", show: true },
    { id: "experience", label: "Experience", show: experience.length > 0 || result.education?.length > 0 || result.certifications?.length > 0 },
    { id: "evidence", label: "Evidence", show: result.strengths?.length > 0 || result.weaknesses?.length > 0 || result.red_flags?.length > 0 },
    { id: "interview", label: "Interview questions", show: result.interview_questions?.length > 0 },
    { id: "contact", label: blind ? "Salary" : "Contact and salary", show: hasContact || !!result.salary_estimate },
  ].filter((s) => s.show);

  return (
    <Card className="overflow-hidden">
      {/* ── Verdict ─────────────────────────────────────────────────── */}
      <header className="px-6 sm:px-8 pt-7 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="shrink-0 flex sm:flex-col items-center gap-4 sm:gap-3">
            <ScoreRing score={result.match_score} stroke={tone.fg} grown={grown} />
            <span className={`inline-flex items-center gap-1.5 text-13 font-semibold px-2.5 py-1 rounded-full border ${bandClasses(result.match_score).pill}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
              {result.recommendation || tone.label}
            </span>
            <span className="sr-only">
              Match score {result.match_score} out of 100: {result.recommendation || tone.label}.
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {blind && <Icon name="eyeOff" size={16} className="text-[var(--ink-soft)]" />}
              <h2 className="text-24 font-semibold tracking-tight text-[var(--ink)] leading-tight font-display">
                {name}
              </h2>
            </div>
            {(headline || roleLabel) && (
              <p className="text-15 text-[var(--ink-soft)] mt-1">
                {!blind && headline}
                {!blind && headline && roleLabel ? " · " : ""}
                {roleLabel && <>for <span className="text-[var(--ink)]">{roleLabel}</span></>}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-14 text-[var(--ink-soft)]">
              {result.seniority_match && result.seniority_match !== "Unknown" && (
                <span>
                  Seniority: <span className="text-[var(--ink)] font-medium">{result.seniority_match}</span>
                </span>
              )}
              {result.confidence && (
                <span>
                  Confidence:{" "}
                  <span className="font-medium" style={{ color: result.confidence === "Low" ? "var(--score-low)" : result.confidence === "Medium" ? "var(--score-mid)" : "var(--ink)" }}>
                    {result.confidence}
                  </span>
                </span>
              )}
              {requirements.length > 0 && (
                <span>
                  Must-haves: <span className="text-[var(--ink)] font-medium tabular-nums">{metCount}/{requirements.length} met</span>
                </span>
              )}
            </div>
            {result.summary && <p className="text-15 leading-[1.65] text-[var(--ink)] mt-4 max-w-[62ch]">{result.summary}</p>}
          </div>
        </div>

        {(capped || result.confidence === "Low" || result.duplicate_of || result.warnings?.length > 0 || result.ai_writing) && (
          <div className="mt-5 space-y-2">
            {capped && (
              <Notice tone="warn">
                This score was capped by a floor check{capReason ? ` - ${capReason}` : ""}. If the CV reads stronger than the number, the evidence below shows what was discounted.
              </Notice>
            )}
            {result.confidence === "Low" && <Notice tone="warn">Low confidence - the CV was sparse or ambiguous, so treat the score as a rough guide.</Notice>}
            {result.duplicate_of && <Notice tone="warn">Possible duplicate of {result.duplicate_of} - same contact details.</Notice>}
            {(result.warnings || []).map((w) => (
              <Notice key={w} tone="warn">{w}</Notice>
            ))}
            {result.ai_writing && <AiWritingNotice notice={result.ai_writing} candidateId={candidateId} where={embedded ? "split_view" : "report"} />}
          </div>
        )}
      </header>

      {!embedded && sections.length > 1 && (
        <nav aria-label="Report sections" className="sticky top-[56px] z-10 bg-[var(--bg)]/95 backdrop-blur border-t border-[var(--border-soft)] px-4 sm:px-6 overflow-x-auto">
          <ul className="flex gap-1">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-block px-2.5 py-3 text-14 font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] whitespace-nowrap">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ── Overview ────────────────────────────────────────────────── */}
      <Section id={sectionId("overview")} title="Overview">
        {breakdown.length > 0 && (
          <div className="space-y-5">
            {breakdown.map((row, i) => {
              const t = scoreTone(row.value);
              return (
                <div key={row.key} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 items-baseline">
                  <span className="text-15 font-medium text-[var(--ink)]">{row.label}</span>
                  <span className="text-15 font-semibold tabular-nums" style={{ color: t.fg }}>
                    {row.value}
                  </span>
                  <div className="col-span-2">
                    <Meter value={row.value} tone={t.fg} grown={grown} delay={i * 90} />
                  </div>
                  {result.score_rationale?.[row.key] && <p className="col-span-2 text-14 leading-relaxed text-[var(--ink-soft)]">{result.score_rationale[row.key]}</p>}
                </div>
              );
            })}
            <p className="text-13 text-[var(--ink-faint)] flex items-start gap-1.5">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              Scored on the skills and work shown in the CV. The AI is told to ignore age, gender, ethnicity, religion, disability and every other protected characteristic, and can&apos;t set them as requirements.
            </p>
          </div>
        )}

        {(result.standout_factors?.length > 0 || result.cv_quality_issues?.length > 0) && (
          <div className={cx("grid gap-6 sm:grid-cols-2", breakdown.length > 0 && "mt-7")}>
            {result.standout_factors?.length > 0 && (
              <div>
                <p className="text-13 font-medium text-[var(--ink-soft)] mb-2">What stands out</p>
                <BulletList items={result.standout_factors} tone="var(--forest)" />
              </div>
            )}
            {result.cv_quality_issues?.length > 0 && (
              <div>
                <p className="text-13 font-medium text-[var(--ink-soft)] mb-2">CV quality notes</p>
                <BulletList items={result.cv_quality_issues} tone="var(--score-mid)" />
              </div>
            )}
          </div>
        )}

        {!breakdown.length && !result.standout_factors?.length && !result.cv_quality_issues?.length && (
          <p className="text-14 text-[var(--ink-faint)]">No breakdown was returned for this candidate.</p>
        )}
      </Section>

      {/* ── Must-haves ──────────────────────────────────────────────── */}
      {requirements.length > 0 && (
        <Section id={sectionId("requirements")} title="Must-haves" meta={`${metCount} of ${requirements.length} met`}>
          <ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
            {requirements.map((r, i) => {
              const st = REQUIREMENT_STATUS[requirementStatus(r)];
              return (
                <li key={`${r.requirement}-${i}`} className="fade-up-in flex items-start justify-between gap-3 py-3" style={{ "--stagger-delay": `${300 + i * 120}ms` }}>
                  <div className="min-w-0">
                    <p className="text-15 font-medium text-[var(--ink)]">{requirementText(r.requirement)}</p>
                    {r.evidence && <p className="text-14 leading-relaxed text-[var(--ink-soft)] mt-0.5">{r.evidence}</p>}
                  </div>
                  <span className={`inline-flex items-center gap-1 shrink-0 text-13 font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${st.pill}`}>
                    <Icon name={st.icon} size={12} strokeWidth={2.6} />
                    {st.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* ── Skills ──────────────────────────────────────────────────── */}
      <Section id={sectionId("skills")} title="Skills">
        {quotes.length > 0 && <CvQuotes quotes={quotes} onShowInCv={onShowInCv} />}
        <div className="grid gap-6 sm:grid-cols-3">
          <SkillList title="Matched" items={matched} tone="var(--forest)" empty="None matched." />
          {missingFlat.length ? (
            <SkillList title="Missing" items={missingFlat} tone="var(--score-low)" empty="Nothing missing." />
          ) : (
            <>
              <SkillList title="Missing, required" items={missingRequired} tone="var(--score-low)" empty="Nothing required is missing." />
              <SkillList title="Missing, preferred" items={missingPreferred} tone="var(--score-mid)" empty="Nothing preferred is missing." />
            </>
          )}
        </div>
        {result.other_skills?.length > 0 && (
          <p className="text-14 leading-relaxed text-[var(--ink-soft)] mt-6 pt-4 border-t border-[var(--border-soft)]">
            <span className="font-medium text-[var(--ink)]">Also on the CV: </span>
            {result.other_skills.join(", ")}
          </p>
        )}
      </Section>

      {/* ── Experience ──────────────────────────────────────────────── */}
      {sections.some((s) => s.id === "experience") && (
        <Section id={sectionId("experience")} title="Experience">
          {experience.length > 0 && (
            <div className="space-y-3">
              {experience.map((item, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_56px] gap-x-4 gap-y-1 items-baseline">
                  <span className="text-15 text-[var(--ink)] truncate">{item.area}</span>
                  <span className="text-14 text-right tabular-nums text-[var(--ink-soft)]">{item.years > 0 ? `${item.years} yr${item.years === 1 ? "" : "s"}` : "None"}</span>
                  <div className="col-span-2">
                    <Meter value={((item.years || 0) / maxYears) * 100} tone="var(--ink-mute)" grown={grown} delay={Math.min(i, 8) * 50} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {(result.education?.length > 0 || result.certifications?.length > 0) && (
            <div className={cx("grid gap-6 sm:grid-cols-2", experience.length > 0 && "mt-7 pt-6 border-t border-[var(--border-soft)]")}>
              {result.education?.length > 0 && (
                <div>
                  <p className="text-13 font-medium text-[var(--ink-soft)] mb-2">Education</p>
                  <ul className="space-y-3">
                    {result.education.map((e, i) => (
                      <li key={i}>
                        <p className="text-15 font-medium text-[var(--ink)]">
                          {e.degree}
                          {e.field_of_study ? `, ${e.field_of_study}` : ""}
                        </p>
                        <p className="text-14 text-[var(--ink-soft)]">
                          {[e.institution, yearRange(e.start_year, e.end_year), e.grade].filter(Boolean).join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.certifications?.length > 0 && (
                <div>
                  <p className="text-13 font-medium text-[var(--ink-soft)] mb-2">Certifications</p>
                  <ul className="space-y-2">
                    {result.certifications.map((c, i) => (
                      <li key={i} className="text-15 text-[var(--ink)]">
                        {c.name}
                        {(c.issuer || c.year) && <span className="text-14 text-[var(--ink-soft)]"> · {[c.issuer, c.year].filter(Boolean).join(", ")}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ── Evidence ────────────────────────────────────────────────── */}
      {sections.some((s) => s.id === "evidence") && (
        <Section id={sectionId("evidence")} title="Evidence">
          {result.red_flags?.length > 0 && (
            <div className="rounded-btn border border-[var(--danger-line)] bg-[var(--ui-danger-soft)] px-4 py-3.5 mb-6">
              <p className="text-14 font-semibold text-[var(--score-low)] mb-2 flex items-center gap-1.5">
                <Icon name="alert" size={14} /> Worth raising on the call
              </p>
              <BulletList items={result.red_flags} tone="var(--score-low)" />
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            {result.strengths?.length > 0 && (
              <div>
                <p className="text-13 font-medium text-[var(--ink-soft)] mb-2">Strengths</p>
                <BulletList items={result.strengths} marker="check" />
              </div>
            )}
            {result.weaknesses?.length > 0 && (
              <div className="text-[var(--ink-faint)]">
                <p className="text-13 font-medium text-[var(--ink-soft)] mb-2">Gaps</p>
                <BulletList items={result.weaknesses} marker="x" />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Interview questions ─────────────────────────────────────── */}
      {result.interview_questions?.length > 0 && (
        <Section
          id={sectionId("interview")}
          title="Interview questions"
          meta={
            <span className="inline-flex flex-wrap items-center gap-1">
              {candidateId && <SaveQuestions candidateId={candidateId} questions={result.interview_questions} />}
              <CopyText text={result.interview_questions.map((q, i) => `${i + 1}. ${q}`).join("\n")} label="Copy all interview questions" className="px-2 py-1">
                Copy all
              </CopyText>
            </span>
          }
        >
          <p className="text-14 text-[var(--ink-soft)] -mt-2 mb-4">Tailored to the gaps above.</p>
          <ol className="space-y-2">
            {result.interview_questions.map((q, i) => (
              <li key={i} className="group flex items-start gap-3 rounded-lg -mx-2 px-2 py-1.5 text-15 leading-relaxed text-[var(--ink)] hover:bg-[var(--mist)]">
                <span className="w-5 shrink-0 text-right tabular-nums text-[var(--ink-faint)] font-medium">{i + 1}.</span>
                <span className="flex-1">{q}</span>
                <CopyText text={q} label={`Copy question ${i + 1}`} className="p-1.5 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100" />
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* ── Contact & salary ────────────────────────────────────────── */}
      {sections.some((s) => s.id === "contact") && (
        <Section id={sectionId("contact")} title={blind ? "Salary" : "Contact and salary"}>
          {hasContact && (
            <div className="mb-6">
              {result.email && (
                <ContactRow icon="mail" label="Email">
                  <a href={`mailto:${result.email}`} className="hover:underline">{result.email}</a>
                </ContactRow>
              )}
              {result.phone && (
                <ContactRow icon="phone" label="Phone">
                  <a href={`tel:${result.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">{result.phone}</a>
                </ContactRow>
              )}
              {result.location && <ContactRow icon="pin" label="Location">{result.location}</ContactRow>}
              {result.notice_period && <ContactRow icon="clock" label="Notice period">{result.notice_period}</ContactRow>}
              {result.willing_to_relocate != null && (
                <ContactRow icon="pin" label="Relocation">{result.willing_to_relocate ? "Open to relocating" : "Not open to relocating"}</ContactRow>
              )}
              {[
                ["LinkedIn", result.linkedin, null],
                ["GitHub", result.github, "https://github.com/"],
                ["Portfolio", result.portfolio_url, null],
              ]
                .filter(([, v]) => v)
                .map(([label, v, base]) => (
                  <ContactRow key={label} icon="link" label={label}>
                    <a href={externalUrl(v, base)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--forest)] hover:underline">
                      Open profile <Icon name="external" size={12} />
                    </a>
                  </ContactRow>
                ))}
            </div>
          )}
          {result.salary_estimate && (
            <div className="rounded-xl bg-[var(--mist)] border border-[var(--border-soft)] px-5 py-4">
              <p className="text-13 font-medium text-[var(--ink-soft)] mb-1 flex items-center gap-1.5"><Icon name="briefcase" size={13} />{result.salary_estimate.period === "hour" || result.salary_estimate.period === "day" ? "Pay guide" : "Salary guide"}</p>
              <p className="text-24 font-semibold tracking-tight text-[var(--ink)] tabular-nums font-display">
                {fmtSalary(result.salary_estimate.low, result.salary_estimate.currency, result.salary_estimate.period)}
                {result.salary_estimate.high !== result.salary_estimate.low && <> – {fmtSalary(result.salary_estimate.high, result.salary_estimate.currency, result.salary_estimate.period)}</>}
                {PAY_PERIOD_SUFFIX[result.salary_estimate.period] || ""}
                {result.salary_estimate.seniority && <span className="text-14 font-normal text-[var(--ink-soft)] ml-2">{result.salary_estimate.seniority}</span>}
              </p>
              {result.salary_estimate.rationale && <p className="text-14 leading-relaxed text-[var(--ink-soft)] mt-1 max-w-[62ch]">{result.salary_estimate.rationale}</p>}
            </div>
          )}
        </Section>
      )}
      {/* Shown on every report, on screen and in print: the score informs a
          recruiter's decision, it never makes it (UK GDPR Art. 22). */}
      <p className="flex items-start gap-2 px-5 sm:px-7 py-4 border-t border-[var(--border-soft)] text-13 leading-relaxed text-[var(--ink-soft)]">
        <span className="mt-0.5 shrink-0 text-[var(--ink-faint)]">
          <Icon name="info" size={13} />
        </span>
        <span>
          This assessment is produced by AI from the CV and the role&apos;s requirements. It can be wrong or miss context, so a recruiter
          should review it before any decision - it isn&apos;t a decision in itself. Candidates can ask for a person to review how they
          were assessed.
        </span>
      </p>
    </Card>
  );
}
