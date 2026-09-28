"use client";

// Building blocks for describing the role, shared by single and bulk
// analysis: the method picker, the "build it" form for hirers without a
// spec, the spec checklist, templates for every kind of work, and the
// chip input used for must-haves.

import { useMemo, useState } from "react";
import { Icon, Input, Label, Textarea, cx } from "./ui";
import {
  EXPERIENCE_OPTIONS,
  JOB_TYPES,
  JOB_TYPE_BY_ID,
  ROLE_TEMPLATES,
  WORK_PATTERNS,
  composeRoleText,
  mustHaveSuggestions,
  specChecklist,
} from "../_lib/roles";
import { ls, lsSet } from "../_lib/analyse";

// ── Method picker ───────────────────────────────────────────────────────

export const ROLE_METHODS = {
  saved: { label: "Your jobs", hint: "Pick a saved role", icon: "briefcase" },
  build: { label: "Build it", hint: "No spec? Answer a few questions", icon: "wand" },
  paste: { label: "Paste", hint: "An advert or description", icon: "text" },
  upload: { label: "Upload", hint: "PDF, Word or .txt", icon: "upload" },
  template: { label: "Templates", hint: "Start from a common role", icon: "layers" },
};

export function MethodPicker({ value, onChange, methods, counts = {} }) {
  return (
    <div role="tablist" aria-label="How to add the role" className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(112px,1fr))]">
      {methods.map((m) => {
        const meta = ROLE_METHODS[m];
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className={cx(
              "group text-left rounded-[12px] border px-3 py-2.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)]",
              active
                ? "border-[var(--forest)] bg-[#f4faf7] shadow-[0_0_0_3px_rgba(11,110,79,0.10)]"
                : "border-[var(--border)] bg-white hover:border-[var(--ink-mute)] hover:bg-[var(--mist)]"
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span
                className={cx(
                  "w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 transition-colors",
                  active ? "bg-[var(--forest)] text-white" : "bg-[var(--mist)] text-[var(--ink-soft)] group-hover:bg-white"
                )}
              >
                <Icon name={meta.icon} size={15} />
              </span>
              {counts[m] != null && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-[var(--mist)] border border-[var(--border)] text-[10.5px] font-semibold tabular-nums text-[var(--ink-soft)] flex items-center justify-center">
                  {counts[m]}
                </span>
              )}
            </span>
            <span className="block text-[13px] font-semibold text-[var(--ink)] leading-tight mt-2">{meta.label}</span>
            <span className="block text-[11.5px] leading-snug text-[var(--ink-faint)] mt-0.5">{meta.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Chips ───────────────────────────────────────────────────────────────

export function ChoiceChip({ active, onClick, icon, children, className = "" }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors",
        active
          ? "border-[var(--forest)] bg-[var(--forest)] text-white"
          : "border-[var(--border)] bg-white text-[var(--ink-soft)] hover:border-[var(--ink-mute)] hover:text-[var(--ink)]",
        className
      )}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}

// Free-text chips (must-haves, nice-to-haves) with one-click suggestions.
export function ChipInput({ id, label, hint, values, onChange, suggestions = [], placeholder, help }) {
  const [draft, setDraft] = useState("");
  const has = (v) => values.some((x) => x.toLowerCase() === v.toLowerCase());

  function add(value = draft) {
    const v = value.trim();
    if (v && !has(v)) onChange([...values, v]);
    setDraft("");
  }

  const open = suggestions.filter((s) => !has(s)).slice(0, 6);

  return (
    <div>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <div className="flex flex-wrap items-center gap-1.5 min-h-10 px-1.5 py-1.5 rounded-[10px] border border-[var(--border)] focus-within:border-[var(--forest)] focus-within:shadow-[0_0_0_3px_rgba(11,110,79,0.14)] bg-white">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-[var(--mint)] border border-[#cfe6da] text-[12.5px] text-[var(--forest-deep)]">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="p-0.5 rounded-full hover:bg-white/70">
              <Icon name="x" size={11} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => add()}
          placeholder={values.length ? "Add another" : placeholder}
          className="flex-1 min-w-[170px] h-7 px-1.5 text-[13px] outline-none bg-transparent placeholder:text-[var(--ink-mute)]"
        />
      </div>
      {open.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[11.5px] text-[var(--ink-faint)] mr-0.5">Suggested:</span>
          {open.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-dashed border-[var(--ink-mute)] text-[11.5px] text-[var(--ink-soft)] hover:border-[var(--forest)] hover:text-[var(--forest)] hover:bg-[#f4faf7] transition-colors"
            >
              <Icon name="plus" size={11} />
              {s}
            </button>
          ))}
        </div>
      )}
      {help && <p className="text-[11.5px] text-[var(--ink-faint)] mt-1.5">{help}</p>}
    </div>
  );
}

// ── Spec checklist ──────────────────────────────────────────────────────

export function SpecChecklist({ text }) {
  const items = useMemo(() => specChecklist(text), [text]);
  if (!text.trim()) {
    return <p className="text-[12px] text-[var(--ink-faint)]">Any format works - paste the advert exactly as it is.</p>;
  }
  const done = items.filter((i) => i.done).length;
  const nextTip = items.find((i) => !i.done)?.tip;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--mist)] overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--forest)] transition-[width] duration-300" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        <span className="text-[11.5px] tabular-nums text-[var(--ink-soft)]">{done} of {items.length} covered</span>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="What the description covers">
        {items.map((i) => (
          <li
            key={i.key}
            title={i.done ? undefined : i.tip}
            className={cx(
              "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11.5px] border",
              i.done ? "bg-[var(--mint)] border-[#cfe6da] text-[var(--forest-deep)]" : "bg-white border-dashed border-[var(--ink-mute)] text-[var(--ink-faint)]"
            )}
          >
            <Icon name={i.done ? "check" : "circle"} size={11} strokeWidth={i.done ? 2.6 : 1.7} />
            {i.label}
            <span className="sr-only">{i.done ? "covered" : "missing"}</span>
          </li>
        ))}
      </ul>
      {nextTip && <p className="text-[11.5px] text-[var(--ink-faint)] mt-2">Tip: {nextTip}</p>}
    </div>
  );
}

// ── Build it ────────────────────────────────────────────────────────────

const HOURLY_TYPES = new Set(["warehouse", "driving", "hospitality", "retail", "care", "cleaning", "construction", "manufacturing", "security"]);

function Step({ n, title, hint, children }) {
  return (
    <section className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3">
      <span className="w-6 h-6 rounded-full bg-[var(--mist)] border border-[var(--border)] text-[11.5px] font-semibold text-[var(--ink-soft)] flex items-center justify-center tabular-nums">{n}</span>
      <div className="min-w-0 space-y-2.5">
        <div className="flex items-baseline justify-between gap-2 pt-[3px]">
          <h3 className="text-[13px] font-semibold text-[var(--ink)]">{title}</h3>
          {hint && <span className="text-[11.5px] text-[var(--ink-faint)]">{hint}</span>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function RoleBuilder({ draft, onChange, onEditAsText }) {
  const [showPreview, setShowPreview] = useState(false);
  const type = JOB_TYPE_BY_ID[draft.jobType];
  const text = composeRoleText(draft);
  const ready = draft.title.trim().length > 1 && text.length >= 50;

  function set(patch) {
    onChange({ ...draft, ...patch });
  }

  function pickType(id) {
    const patch = { jobType: draft.jobType === id ? "" : id };
    // Frontline work is usually advertised by the hour, office work by the year.
    if (!draft.payMin && !draft.payMax) patch.payPeriod = HOURLY_TYPES.has(id) ? "hour" : "year";
    set(patch);
  }

  function togglePattern(p) {
    set({ patterns: draft.patterns.includes(p) ? draft.patterns.filter((x) => x !== p) : [...draft.patterns, p] });
  }

  return (
    <div className="space-y-6">
      <Step n={1} title="What kind of work is it?">
        <div className="flex flex-wrap gap-1.5">
          {JOB_TYPES.map((t) => (
            <ChoiceChip key={t.id} active={draft.jobType === t.id} onClick={() => pickType(t.id)} icon={t.icon}>
              {t.label}
            </ChoiceChip>
          ))}
        </div>
      </Step>

      <Step n={2} title="The job">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rb-title">Job title</Label>
            <Input id="rb-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder={type ? `e.g. ${type.titles[0]}` : "e.g. Warehouse Operative"} />
          </div>
          <div>
            <Label htmlFor="rb-location" hint="Optional">Location</Label>
            <Input id="rb-location" value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. Leeds LS10, or Remote" />
          </div>
        </div>
        {type && !draft.title && (
          <div className="flex flex-wrap gap-1.5">
            {type.titles.map((t) => (
              <button key={t} type="button" onClick={() => set({ title: t })} className="h-6 px-2 rounded-full border border-[var(--border)] text-[11.5px] text-[var(--ink-soft)] hover:border-[var(--forest)] hover:text-[var(--forest)] transition-colors">
                {t}
              </button>
            ))}
          </div>
        )}
      </Step>

      <Step n={3} title="Pay and hours" hint="Optional">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[110px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-faint)]">£</span>
            <Input aria-label="Pay from" inputMode="decimal" value={draft.payMin} onChange={(e) => set({ payMin: e.target.value })} placeholder={draft.payPeriod === "hour" ? "12.50" : "28,000"} className="pl-6" />
          </div>
          <span className="text-[12px] text-[var(--ink-faint)]">to</span>
          <div className="relative w-[110px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-faint)]">£</span>
            <Input aria-label="Pay to (optional)" inputMode="decimal" value={draft.payMax} onChange={(e) => set({ payMax: e.target.value })} placeholder={draft.payPeriod === "hour" ? "13.00" : "32,000"} className="pl-6" />
          </div>
          <div className="inline-flex p-0.5 rounded-[9px] bg-[var(--mist)] border border-[var(--border)]" role="radiogroup" aria-label="Pay period">
            {[["hour", "per hour"], ["year", "per year"]].map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={draft.payPeriod === v}
                onClick={() => set({ payPeriod: v })}
                className={cx("h-7 px-2.5 rounded-[7px] text-[12px] font-medium", draft.payPeriod === v ? "bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[var(--ink-soft)]")}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WORK_PATTERNS.map((p) => (
            <ChoiceChip key={p} active={draft.patterns.includes(p)} onClick={() => togglePattern(p)} className="h-7 px-2.5 text-[12px]">
              {p}
            </ChoiceChip>
          ))}
        </div>
      </Step>

      <Step n={4} title="Experience needed">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Experience needed">
          {EXPERIENCE_OPTIONS.map((o) => (
            <ChoiceChip key={o.value} active={draft.experience === o.value} onClick={() => set({ experience: draft.experience === o.value ? "" : o.value })} className="h-7 px-2.5 text-[12px]">
              {o.label}
            </ChoiceChip>
          ))}
        </div>
      </Step>

      <Step n={5} title="What they'll do" hint="Optional - one task per line">
        <Textarea
          value={draft.duties}
          onChange={(e) => set({ duties: e.target.value })}
          rows={3}
          aria-label="Main tasks"
          placeholder={"e.g. Picking and packing orders\nLoading and unloading deliveries"}
        />
      </Step>

      <Step n={6} title="Requirements">
        <ChipInput
          id="rb-must"
          label="Must-haves"
          values={draft.mustHaves}
          onChange={(mustHaves) => set({ mustHaves })}
          suggestions={mustHaveSuggestions(draft.jobType)}
          placeholder="Type and press Enter - e.g. a licence, skill or availability"
        />
        <ChipInput
          id="rb-nice"
          label="Nice to have"
          hint="Optional"
          values={draft.niceToHaves}
          onChange={(niceToHaves) => set({ niceToHaves })}
          placeholder="e.g. previous experience in a similar role"
        />
      </Step>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--mist)] px-3.5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cx("inline-flex items-center gap-1.5 text-[12.5px] font-medium", ready ? "text-[var(--forest-deep)]" : "text-[var(--ink-soft)]")}>
            <Icon name={ready ? "check" : "info"} size={14} />
            {ready ? "Ready - this is what the CV will be scored against" : "Add a job title and a little detail to continue"}
          </span>
          <span className="flex items-center gap-1">
            <button type="button" onClick={() => setShowPreview((v) => !v)} className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-white">
              <Icon name="eye" size={13} /> {showPreview ? "Hide" : "Preview"}
            </button>
            {text && (
              <button type="button" onClick={() => onEditAsText(text)} className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-white">
                <Icon name="text" size={13} /> Edit as text
              </button>
            )}
          </span>
        </div>
        {showPreview && (
          <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-[8px] bg-white border border-[var(--border)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--ink-soft)]" style={{ fontFamily: "var(--font-mono)" }}>
            {text || "Nothing yet - start with the kind of work and a job title."}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Templates ───────────────────────────────────────────────────────────

export function TemplateGallery({ onPick }) {
  const [filter, setFilter] = useState("all");
  const [saved, setSaved] = useState(() => ls("jobTemplates", []));

  const types = useMemo(() => JOB_TYPES.filter((t) => ROLE_TEMPLATES.some((r) => r.type === t.id)), []);
  const visible = filter === "all" ? ROLE_TEMPLATES : ROLE_TEMPLATES.filter((t) => t.type === filter);

  function remove(t) {
    const next = saved.filter((s) => (s.id || s.savedAt) !== (t.id || t.savedAt));
    setSaved(next);
    lsSet("jobTemplates", next);
  }

  return (
    <div className="space-y-4">
      {saved.length > 0 && (
        <div>
          <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">Saved by you</p>
          <ul className="space-y-1">
            {saved.map((t) => (
              <li key={t.id || t.savedAt} className="group flex items-center gap-2 rounded-[10px] hover:bg-[var(--mist)] pr-1">
                <button type="button" onClick={() => onPick(t.text)} className="flex-1 min-w-0 text-left px-3 py-2">
                  <span className="block text-[13px] text-[var(--ink)] truncate">{t.name}</span>
                </button>
                <button type="button" onClick={() => remove(t)} aria-label={`Delete template ${t.name}`} className="p-1.5 rounded-md text-[var(--ink-faint)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--score-low)]">
                  <Icon name="x" size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter templates by type of work">
          <ChoiceChip active={filter === "all"} onClick={() => setFilter("all")} className="h-7 px-2.5 text-[12px]">
            All
          </ChoiceChip>
          {types.map((t) => (
            <ChoiceChip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)} icon={t.icon} className="h-7 px-2.5 text-[12px]">
              {t.label}
            </ChoiceChip>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 max-h-[340px] overflow-y-auto -mx-1 px-1 py-1">
          {visible.map((t) => {
            const type = JOB_TYPE_BY_ID[t.type];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t.text)}
                className="flex items-center gap-3 text-left px-3 py-2.5 rounded-[12px] border border-[var(--border)] bg-white hover:border-[var(--forest)] hover:bg-[#f4faf7] transition-colors"
              >
                <span className="w-9 h-9 rounded-[10px] bg-[var(--mist)] text-[var(--ink-soft)] flex items-center justify-center shrink-0">
                  <Icon name={type?.icon || "briefcase"} size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[var(--ink)] truncate">{t.title}</span>
                  <span className="block text-[11.5px] text-[var(--ink-faint)] truncate">{type?.label} · {t.level}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11.5px] text-[var(--ink-faint)] mt-2">Picking one opens it as text so you can tailor it - pay, hours, requirements.</p>
      </div>
    </div>
  );
}
