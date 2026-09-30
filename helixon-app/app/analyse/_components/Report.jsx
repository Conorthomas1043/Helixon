"use client";

// The assessment, laid out as one readable document rather than a stack of
// tabs: verdict first, then the evidence behind it. Section links at the top
// jump within the page. Colour is reserved for the score and for problems.

import { useEffect, useState } from "react";
import { Card, Icon, Notice, cx } from "./ui";
import { scoreTone } from "../_lib/analyse";

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
        <h3 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h3>
        {meta && <span className="text-[12px] text-[var(--ink-faint)]">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function BulletList({ items, marker = "dot", tone }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-[var(--ink)]">
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
      <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />
        {title} <span className="text-[var(--ink-faint)] tabular-nums">{items.length}</span>
      </p>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((s, i) => (
            <li key={i} className="text-[13.5px] text-[var(--ink)] leading-snug">
              {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-[var(--ink-faint)]">{empty}</p>
      )}
    </div>
  );
}

function ContactRow({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--border-soft)] last:border-b-0">
      <Icon name={icon} size={15} className="mt-0.5 text-[var(--ink-faint)]" />
      <span className="w-28 shrink-0 text-[12.5px] text-[var(--ink-soft)]">{label}</span>
      <span className="min-w-0 text-[13.5px] text-[var(--ink)] break-words">{children}</span>
    </div>
  );
}

export default function Report({ result, roleLabel }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 120);
    return () => clearTimeout(t);
  }, [result]);

  if (!result) return null;

  const tone = scoreTone(result.match_score);
  const blind = !!result.blind_mode;
  const name = blind ? "Blind-screened candidate" : result.name && result.name !== "Candidate" ? result.name : "Candidate";
  const headline = [result.current_title, result.current_employer].filter(Boolean).join(" at ");

  const breakdown = [
    { key: "skills", label: "Skills", value: result.skill_score },
    { key: "experience", label: "Experience", value: result.experience_score },
    { key: "culture", label: "Culture and fit", value: result.culture_score },
  ].filter((r) => r.value != null);

  const matched = result.matched_skills || [];
  const missingRequired = result.missing_required || [];
  const missingPreferred = result.missing_preferred || [];
  // Older results only have a flat missing list.
  const missingFlat = !missingRequired.length && !missingPreferred.length ? result.missing_skills || [] : [];
  const requirements = result.requirements_met || [];
  const metCount = requirements.filter((r) => r.met).length;
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
          <div className="sm:w-[132px] shrink-0">
            <div className="flex items-baseline gap-1">
              <span className="text-[52px] leading-none font-semibold tabular-nums tracking-tight" style={{ color: tone.fg, fontFamily: "var(--font-display)" }}>
                {result.match_score}
              </span>
              <span className="text-[14px] text-[var(--ink-faint)]">/100</span>
            </div>
            <div className="mt-3">
              <Meter value={result.match_score} tone={tone.fg} grown={grown} />
            </div>
            <p className="text-[12px] font-medium mt-2" style={{ color: tone.fg }}>
              {result.recommendation || tone.label}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {blind && <Icon name="eyeOff" size={16} className="text-[var(--ink-soft)]" />}
              <h2 className="text-[22px] font-semibold tracking-tight text-[var(--ink)] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                {name}
              </h2>
            </div>
            {(headline || roleLabel) && (
              <p className="text-[13.5px] text-[var(--ink-soft)] mt-1">
                {!blind && headline}
                {!blind && headline && roleLabel ? " · " : ""}
                {roleLabel && <>for <span className="text-[var(--ink)]">{roleLabel}</span></>}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12.5px] text-[var(--ink-soft)]">
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
            {result.summary && <p className="text-[14.5px] leading-[1.65] text-[var(--ink)] mt-4 max-w-[62ch]">{result.summary}</p>}
          </div>
        </div>

        {(capped || result.confidence === "Low" || result.duplicate_of || result.warnings?.length > 0) && (
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
          </div>
        )}
      </header>

      {sections.length > 1 && (
        <nav aria-label="Report sections" className="sticky top-[56px] z-10 bg-white/95 backdrop-blur border-t border-[var(--border-soft)] px-4 sm:px-6 overflow-x-auto">
          <ul className="flex gap-1">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-block px-2.5 py-3 text-[12.5px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] whitespace-nowrap">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ── Overview ────────────────────────────────────────────────── */}
      <Section id="overview" title="Overview">
        {breakdown.length > 0 && (
          <div className="space-y-5">
            {breakdown.map((row, i) => {
              const t = scoreTone(row.value);
              return (
                <div key={row.key} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 items-baseline">
                  <span className="text-[13.5px] font-medium text-[var(--ink)]">{row.label}</span>
                  <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: t.fg }}>
                    {row.value}
                  </span>
                  <div className="col-span-2">
                    <Meter value={row.value} tone={t.fg} grown={grown} delay={i * 90} />
                  </div>
                  {result.score_rationale?.[row.key] && <p className="col-span-2 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{result.score_rationale[row.key]}</p>}
                </div>
              );
            })}
          </div>
        )}

        {(result.standout_factors?.length > 0 || result.cv_quality_issues?.length > 0) && (
          <div className={cx("grid gap-6 sm:grid-cols-2", breakdown.length > 0 && "mt-7")}>
            {result.standout_factors?.length > 0 && (
              <div>
                <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-2">What stands out</p>
                <BulletList items={result.standout_factors} tone="var(--forest)" />
              </div>
            )}
            {result.cv_quality_issues?.length > 0 && (
              <div>
                <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-2">CV quality notes</p>
                <BulletList items={result.cv_quality_issues} tone="var(--score-mid)" />
              </div>
            )}
          </div>
        )}

        {!breakdown.length && !result.standout_factors?.length && !result.cv_quality_issues?.length && (
          <p className="text-[13px] text-[var(--ink-faint)]">No breakdown was returned for this candidate.</p>
        )}
      </Section>

      {/* ── Must-haves ──────────────────────────────────────────────── */}
      {requirements.length > 0 && (
        <Section id="requirements" title="Must-haves" meta={`${metCount} of ${requirements.length} met`}>
          <ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
            {requirements.map((r, i) => (
              <li key={`${r.requirement}-${i}`} className="flex gap-3 py-3">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: r.met ? "var(--mint)" : "#fbefed", color: r.met ? "var(--forest)" : "var(--score-low)" }}
                  aria-label={r.met ? "Met" : "Not met"}
                >
                  <Icon name={r.met ? "check" : "x"} size={11} strokeWidth={2.6} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-[var(--ink)]">{r.requirement}</p>
                  {r.evidence && <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)] mt-0.5">{r.evidence}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Skills ──────────────────────────────────────────────────── */}
      <Section id="skills" title="Skills">
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
          <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)] mt-6 pt-4 border-t border-[var(--border-soft)]">
            <span className="font-medium text-[var(--ink)]">Also on the CV: </span>
            {result.other_skills.join(", ")}
          </p>
        )}
      </Section>

      {/* ── Experience ──────────────────────────────────────────────── */}
      {sections.some((s) => s.id === "experience") && (
        <Section id="experience" title="Experience">
          {experience.length > 0 && (
            <div className="space-y-3">
              {experience.map((item, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_56px] gap-x-4 gap-y-1 items-baseline">
                  <span className="text-[13.5px] text-[var(--ink)] truncate">{item.area}</span>
                  <span className="text-[12.5px] text-right tabular-nums text-[var(--ink-soft)]">{item.years > 0 ? `${item.years} yr${item.years === 1 ? "" : "s"}` : "None"}</span>
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
                  <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-2">Education</p>
                  <ul className="space-y-3">
                    {result.education.map((e, i) => (
                      <li key={i}>
                        <p className="text-[13.5px] font-medium text-[var(--ink)]">
                          {e.degree}
                          {e.field_of_study ? `, ${e.field_of_study}` : ""}
                        </p>
                        <p className="text-[12.5px] text-[var(--ink-soft)]">
                          {[e.institution, yearRange(e.start_year, e.end_year), e.grade].filter(Boolean).join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.certifications?.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-2">Certifications</p>
                  <ul className="space-y-2">
                    {result.certifications.map((c, i) => (
                      <li key={i} className="text-[13.5px] text-[var(--ink)]">
                        {c.name}
                        {(c.issuer || c.year) && <span className="text-[12.5px] text-[var(--ink-soft)]"> · {[c.issuer, c.year].filter(Boolean).join(", ")}</span>}
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
        <Section id="evidence" title="Evidence">
          {result.red_flags?.length > 0 && (
            <div className="rounded-[10px] border border-[#f2d2cd] bg-[#fdf6f5] px-4 py-3.5 mb-6">
              <p className="text-[12.5px] font-semibold text-[#a83226] mb-2 flex items-center gap-1.5">
                <Icon name="alert" size={14} /> Worth raising on the call
              </p>
              <BulletList items={result.red_flags} tone="#c0392b" />
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            {result.strengths?.length > 0 && (
              <div>
                <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-2">Strengths</p>
                <BulletList items={result.strengths} marker="check" />
              </div>
            )}
            {result.weaknesses?.length > 0 && (
              <div className="text-[var(--ink-faint)]">
                <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-2">Gaps</p>
                <BulletList items={result.weaknesses} marker="x" />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Interview questions ─────────────────────────────────────── */}
      {result.interview_questions?.length > 0 && (
        <Section id="interview" title="Interview questions" meta="Tailored to the gaps above">
          <ol className="space-y-3.5">
            {result.interview_questions.map((q, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-[var(--ink)]">
                <span className="w-5 shrink-0 text-right tabular-nums text-[var(--ink-faint)] font-medium">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* ── Contact & salary ────────────────────────────────────────── */}
      {sections.some((s) => s.id === "contact") && (
        <Section id="contact" title={blind ? "Salary" : "Contact and salary"}>
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
            <div>
              <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-1">{result.salary_estimate.period === "hour" || result.salary_estimate.period === "day" ? "Estimated pay" : "Estimated salary"}</p>
              <p className="text-[22px] font-semibold tracking-tight text-[var(--ink)] tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                {fmtSalary(result.salary_estimate.low, result.salary_estimate.currency, result.salary_estimate.period)}
                {result.salary_estimate.high !== result.salary_estimate.low && <> – {fmtSalary(result.salary_estimate.high, result.salary_estimate.currency, result.salary_estimate.period)}</>}
                {PAY_PERIOD_SUFFIX[result.salary_estimate.period] || ""}
                {result.salary_estimate.seniority && <span className="text-[13px] font-normal text-[var(--ink-soft)] ml-2">{result.salary_estimate.seniority}</span>}
              </p>
              {result.salary_estimate.rationale && <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)] mt-1 max-w-[62ch]">{result.salary_estimate.rationale}</p>}
            </div>
          )}
        </Section>
      )}
      {/* Shown on every report, on screen and in print: the score informs a
          recruiter's decision, it never makes it (UK GDPR Art. 22). */}
      <p className="flex items-start gap-2 px-5 sm:px-7 py-4 border-t border-[var(--border-soft)] text-[12px] leading-relaxed text-[var(--ink-soft)]">
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
