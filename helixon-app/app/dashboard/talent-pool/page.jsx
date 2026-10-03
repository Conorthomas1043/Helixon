"use client";

// /dashboard/talent-pool - people the agency has saved for future roles
// (app/api/talent-pool). Each entry carries why they're kept, their
// availability and a date to check in, all editable here.
//
// Every open job is pre-matched against the pool with a quick keyword fit
// (free, instant - lib/talent-pool-match.js): the strip at the top shows
// which jobs the pool could fill, and each person shows their best open
// job. Picking a job ranks everyone by fit; the best can then be screened
// properly in one go from the CVs already on file (app/api/candidates/[id]/
// rescreen) - no re-uploading. ?jobId= deep-links straight to a job;
// ?due=1 opens on the check-ins that are due.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { bulkUpdateCandidates, getJobs, getTalentPool, removeFromTalentPool, rescreenCandidate, updateTalentPoolEntry } from "@/lib/dashboard-api";
import { downloadCsv } from "@/lib/csv";
import { formatRelativeTime } from "@/lib/candidate-format";
import { scoreTone } from "@/app/analyse/_lib/analyse";
import { Card, Icon, Notice, Spinner, Toasts, cx, useToasts } from "@/app/analyse/_components/ui";
import { useUndoDelete } from "@/components/dashboard/use-undo-delete";
import { Avatar, PillButton } from "@/app/analyse/_components/compareBits";

const SCREEN_CONCURRENCY = 2;

const AVAILABILITY = {
  available: { label: "Available", fg: "var(--forest-deep)", bg: "var(--mint)", dot: "var(--score-strong)" },
  open: { label: "Open to offers", fg: "#8a5a12", bg: "#fdf6e9", dot: "var(--score-mid)" },
  not_looking: { label: "Not looking", fg: "var(--ink-soft)", bg: "var(--mist)", dot: "var(--ink-faint)" },
};
const UNKNOWN = { label: "Availability?", fg: "var(--ink-faint)", bg: "white", dot: "var(--border)" };

const byCheckIn = (a, b) => {
  const x = a.checkIn || "9999";
  const y = b.checkIn || "9999";
  return x < y ? -1 : x > y ? 1 : 0;
};

const SORTS = {
  recent: { label: "Recently saved", fn: (a, b) => new Date(b.savedAt) - new Date(a.savedAt) },
  checkIn: { label: "Check-in date", fn: byCheckIn },
  bestMatch: { label: "Best open-job match", fn: (a, b) => (b.bestMatch?.fit ?? -1) - (a.bestMatch?.fit ?? -1) },
  experience: { label: "Most experience", fn: (a, b) => (b.yearsExperience ?? -1) - (a.yearsExperience ?? -1) },
  name: { label: "Name A–Z", fn: (a, b) => a.name.localeCompare(b.name) },
  fit: { label: "Best fit for this job", fn: (a, b) => (b.fit ?? -1) - (a.fit ?? -1) },
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function fitTone(fit) {
  if (fit == null) return { fg: "var(--ink-faint)", ring: "var(--border)", label: "Can't check" };
  if (fit >= 70) return { fg: "var(--score-strong)", ring: "var(--score-strong)", label: "Likely fit" };
  if (fit >= 40) return { fg: "var(--score-mid)", ring: "var(--score-mid)", label: "Partial fit" };
  return { fg: "var(--score-low)", ring: "var(--score-low)", label: "Unlikely fit" };
}

function daysUntil(iso) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function shortDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ── Small pieces ─────────────────────────────────────────────────────── */

function Chip({ children, tone = "plain", title }) {
  const styles = {
    plain: "bg-[var(--mist)] text-[var(--ink-soft)]",
    match: "bg-[var(--mint)] text-[var(--forest-deep)]",
    miss: "bg-[#fbefed] text-[#a83226]",
  };
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", styles[tone])}>
      {tone === "match" && <Icon name="check" size={10} strokeWidth={2.4} />}
      {tone === "miss" && <Icon name="x" size={10} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, accent, onClick, active }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cx(
        "text-left rounded-[14px] p-4 sm:p-5 bg-white border transition-colors",
        active ? "border-[var(--forest)] ring-1 ring-[var(--forest)]" : "border-[var(--border)]",
        onClick && "hover:border-[var(--ink-mute)]"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">{label}</p>
      <p className="text-[26px] font-semibold tabular-nums leading-none mt-2.5" style={{ fontFamily: "var(--font-mono)", color: accent || "var(--ink)" }}>
        {value}
      </p>
      {sub && <p className="text-[11.5px] text-[var(--ink-faint)] mt-2">{sub}</p>}
    </Tag>
  );
}

function FitRing({ fit, size = 52 }) {
  const tone = fitTone(fit);
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center shrink-0" title="Quick keyword check of their CV against the job's requirements - not the real screening score">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mist)" strokeWidth="5" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={tone.ring}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - (fit ?? 0) / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums" style={{ color: tone.fg }}>
          {fit == null ? "–" : fit}
        </span>
      </div>
      <span className="text-[10.5px] mt-1 text-[var(--ink-faint)] whitespace-nowrap">{tone.label}</span>
    </div>
  );
}

// Availability as a coloured pill that is itself the picker.
function AvailabilityPicker({ value, onChange, disabled }) {
  const a = AVAILABILITY[value] || UNKNOWN;
  return (
    <label
      className="relative inline-flex items-center gap-1.5 text-[11.5px] font-semibold pl-2 pr-6 py-0.5 rounded-full border cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
      style={{ color: a.fg, background: a.bg, borderColor: value ? "transparent" : "var(--border)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.dot }} aria-hidden="true" />
      {a.label}
      <Icon name="arrowRight" size={10} className="absolute right-2 rotate-90 opacity-60" />
      <select
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="Availability"
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        <option value="">Unknown</option>
        {Object.entries(AVAILABILITY).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// "Check in 3 Oct" chip; the date input sits on top so clicking it opens
// the browser's own date picker.
function CheckInPicker({ value, onChange, disabled }) {
  const overdue = value && value <= todayIso();
  return (
    <span className="inline-flex items-center">
      <label
        className={cx(
          "relative inline-flex items-center gap-1 text-[11.5px] font-medium px-2 py-0.5 rounded-full border cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2",
          overdue
            ? "bg-[#fbefed] text-[#a83226] border-transparent font-semibold"
            : value
              ? "bg-white text-[var(--ink-soft)] border-[var(--border)]"
              : "bg-white text-[var(--ink-faint)] border-dashed border-[var(--border)]"
        )}
        title={value ? "Change the check-in date" : "Set a date to check in with them"}
      >
        <Icon name="clock" size={11} />
        {value ? (overdue ? `Check in due · ${shortDate(value)}` : `Check in ${shortDate(value)}`) : "Set check-in"}
        <input
          type="date"
          value={value || ""}
          disabled={disabled}
          min="2020-01-01"
          onClick={(e) => e.currentTarget.showPicker?.()}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label="Check-in date"
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      {value && (
        <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label="Clear check-in date" className="ml-0.5 p-0.5 rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)]">
          <Icon name="x" size={11} />
        </button>
      )}
    </span>
  );
}

function NoteEditor({ note, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note || "");
  const [saving, setSaving] = useState(false);

  if (editing) {
    return (
      <div className="mt-2 flex items-start gap-2 max-w-2xl">
        <textarea
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          rows={2}
          maxLength={500}
          placeholder="Why keep them? e.g. great closer, wants remote, salary £60k+"
          aria-label="Why keep them"
          className="flex-1 min-w-0 text-[12.5px] px-3 py-2 rounded-[10px] border border-[var(--border)] resize-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forest)]"
        />
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const ok = await onSave(text);
              setSaving(false);
              if (ok) setEditing(false);
            }}
            className="text-[12px] font-semibold px-3 py-1 rounded-full bg-[var(--forest)] text-white disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setText(note || "");
            }}
            className="text-[12px] font-semibold px-3 py-1 text-[var(--ink-soft)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return note ? (
    <button type="button" onClick={() => setEditing(true)} className="group mt-2 flex items-start gap-1.5 text-left" title="Edit note">
      <span className="text-[12.5px] text-[var(--ink)] italic leading-snug">“{note}”</span>
      <span className="text-[11px] font-semibold not-italic text-[var(--ink-faint)] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
    </button>
  ) : (
    <button type="button" onClick={() => setEditing(true)} className="mt-1.5 text-[12px] font-medium text-[var(--ink-faint)] hover:text-[var(--forest)]">
      + Add a note
    </button>
  );
}

// Entries lapse after the agency's retention period (GDPR storage
// limitation - lib/data-retention.js); within a month of that, offer to
// extend.
function PoolExpiry({ expiresAt, onExtend, disabled }) {
  if (!expiresAt) return null;
  const days = daysUntil(expiresAt);
  const date = new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (days > 30) {
    return (
      <span className="text-[11px] text-[var(--ink-faint)]" title="Taken out of the pool on this date unless extended - your retention policy">
        · kept until {date}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#fdf6e9] text-[#8a5a12]">
      <Icon name="clock" size={11} />
      Leaves the pool {days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}
      <button type="button" onClick={onExtend} disabled={disabled} className="underline underline-offset-2 disabled:opacity-50">
        Extend
      </button>
    </span>
  );
}

function RoleLink({ role }) {
  const tone = scoreTone(role.score);
  return (
    <Link
      href={`/dashboard/candidates/${role.candidateId}`}
      className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-0.5 rounded-full border border-[var(--border)] bg-white hover:bg-[var(--mist)]"
      title={`Screened for ${role.jobTitle}`}
    >
      <span className="truncate max-w-[160px] text-[var(--ink-soft)]">{role.jobTitle}</span>
      {role.score != null && (
        <b className="tabular-nums" style={{ color: tone.fg }}>
          {role.score}
        </b>
      )}
    </Link>
  );
}

function RowStatus({ item, screened, screening }) {
  const status = screening?.status;
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
        <Spinner size={12} /> Screening…
      </span>
    );
  if (status === "queued") return <span className="text-[12px] text-[var(--ink-faint)]">Queued</span>;
  if (status === "failed") return <span className="text-[12px] text-[#a83226] max-w-[200px] sm:text-right">{screening.error}</span>;
  if (screened)
    return (
      <Link href={`/dashboard/candidates/${screened.candidateId}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--forest)] hover:underline">
        Screened{screened.score != null ? `: ${screened.score}` : ""}
        <Icon name="arrowRight" size={12} />
      </Link>
    );
  if (!item.hasCv) return <span className="text-[11px] text-[var(--ink-faint)]">No CV text on file</span>;
  return null;
}

/* ── A person in the pool ─────────────────────────────────────────────── */

function PoolRow({ item, job, selected, onToggle, screening, onUpdate, onRemove, onMatchJob, busy }) {
  const screened = job ? item.screened : null;
  const canPick = job ? !screened && item.hasCv && !screening : true;

  return (
    <li className={cx("px-4 sm:px-5 py-4 transition-colors", selected ? "bg-[#f4faf7]" : "bg-white hover:bg-[#fbfcfb]")}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={!canPick}
          onChange={() => onToggle(item.id)}
          aria-label={`Select ${item.name}`}
          className="mt-3 w-4 h-4 shrink-0 accent-[var(--forest)] disabled:opacity-30"
        />
        <Link href={`/dashboard/candidates/${item.id}`} className="shrink-0 mt-0.5" tabIndex={-1} aria-hidden="true">
          <Avatar name={item.name} size={42} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Link href={`/dashboard/candidates/${item.id}`} className="text-[15px] font-semibold text-[var(--ink)] hover:underline">
              {item.name}
            </Link>
            <AvailabilityPicker value={item.status} disabled={busy} onChange={(v) => onUpdate(item, { status: v })} />
            <CheckInPicker value={item.checkIn} disabled={busy} onChange={(v) => onUpdate(item, { checkIn: v })} />
          </div>
          <p className="text-[12.5px] text-[var(--ink-soft)] mt-1">
            {[item.currentTitle, item.currentCompany].filter(Boolean).join(" · ") || "No current role on file"}
            <span className="text-[var(--ink-faint)]">
              {[item.location, item.yearsExperience != null && `${item.yearsExperience} yrs`]
                .filter(Boolean)
                .map((x) => ` · ${x}`)
                .join("")}
            </span>
          </p>

          <NoteEditor note={item.note} onSave={(note) => onUpdate(item, { note })} />

          {job ? (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {item.matched.map((s) => (
                <Chip key={`m-${s}`} tone="match">
                  {s}
                </Chip>
              ))}
              {item.missing.map((s) => (
                <Chip key={`x-${s}`} tone="miss" title="Not found in their CV">
                  {s}
                </Chip>
              ))}
              {item.experienceOk === false && <Chip tone="miss">Under {job.minYearsExperience} yrs</Chip>}
            </div>
          ) : (
            item.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {item.skills.slice(0, 7).map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
                {item.skills.length > 7 && <span className="text-[11px] text-[var(--ink-faint)] self-center">+{item.skills.length - 7}</span>}
              </div>
            )
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5">
            {!job && item.bestMatch && (
              <button
                type="button"
                onClick={() => onMatchJob(item.bestMatch.jobId)}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold pl-2 pr-2.5 py-0.5 rounded-full bg-[var(--mint)] text-[var(--forest-deep)] hover:brightness-95"
                title="Their best fit among your open jobs - click to match the pool against it"
              >
                <Icon name="sparkle" size={11} />
                {item.bestMatch.title} · {item.bestMatch.fit}% fit
              </button>
            )}
            {item.roles.length > 0 && (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[var(--ink-faint)]">Screened for</span>
                {item.roles.map((r) => (
                  <RoleLink key={r.candidateId} role={r} />
                ))}
              </span>
            )}
            <span className="text-[11px] text-[var(--ink-faint)]">
              Saved {formatRelativeTime(item.savedAt)}
              {item.savedBy ? ` by ${item.savedBy}` : ""}
            </span>
            <PoolExpiry expiresAt={item.expiresAt} disabled={busy} onExtend={() => onUpdate(item, { extend: true })} />
          </div>

          {/* Fit and status under the name on phones - the side column is too tight there. */}
          {job && (
            <div className="sm:hidden flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[12.5px]">
              <span className="font-semibold tabular-nums" style={{ color: fitTone(item.fit).fg }}>
                {item.fit == null ? "No fit score" : `${item.fit}% fit`}
              </span>
              <RowStatus item={item} screened={screened} screening={screening} />
            </div>
          )}
        </div>

        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 min-w-[96px]">
          {job ? (
            <>
              <FitRing fit={item.fit} />
              <RowStatus item={item} screened={screened} screening={screening} />
            </>
          ) : (
            <details className="relative">
              <summary className="list-none cursor-pointer px-2 py-1 rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--mist)]" aria-label={`More for ${item.name}`}>
                <span aria-hidden="true" className="text-[16px] leading-none">⋯</span>
              </summary>
              <div className="absolute right-0 mt-1 w-48 rounded-[10px] p-1 z-20 bg-white border border-[var(--border)] shadow-[0_12px_32px_rgba(19,32,27,0.14)]">
                <Link href={`/dashboard/candidates/${item.id}`} className="block text-[12.5px] px-2.5 py-1.5 rounded-[8px] hover:bg-[var(--mist)]">
                  Open profile
                </Link>
                {item.bestMatch && (
                  <button type="button" onClick={() => onMatchJob(item.bestMatch.jobId)} className="w-full text-left text-[12.5px] px-2.5 py-1.5 rounded-[8px] hover:bg-[var(--mist)]">
                    Match to {item.bestMatch.title}
                  </button>
                )}
                <button type="button" onClick={() => onRemove(item)} className="w-full text-left text-[12.5px] px-2.5 py-1.5 rounded-[8px] text-[#a83226] hover:bg-[#fbefed]">
                  Remove from pool
                </button>
              </div>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}

function PoolSkeleton() {
  return (
    <Card className="divide-y divide-[var(--border-soft)]" aria-busy="true" aria-label="Loading talent pool">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-5">
          <div className="w-10 h-10 rounded-full shimmer-block" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-48 rounded shimmer-block" />
            <div className="h-3 w-72 rounded shimmer-block" />
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

const AVAILABILITY_FILTERS = [
  ["all", "Everyone"],
  ["available", "Available"],
  ["open", "Open to offers"],
  ["not_looking", "Not looking"],
  ["due", "Check-in due"],
];

function TalentPoolContent() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("jobId") || "";

  const [jobs, setJobs] = useState([]);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  // ?due=1 (from the Overview's Follow-ups) opens on check-ins that are due.
  const dueOnly = params.get("due") === "1";
  const [availability, setAvailability] = useState(dueOnly ? "due" : "all"); // all | available | open | not_looking | due
  const [skill, setSkill] = useState("");
  const [sortBy, setSortBy] = useState(jobId ? "fit" : dueOnly ? "checkIn" : "recent");

  const [selected, setSelected] = useState([]);
  const [screening, setScreening] = useState({}); // id -> { status, error }
  const [running, setRunning] = useState(false);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const stopRef = useRef(false);
  const { toasts, toast, dismiss } = useToasts();
  const undoable = useUndoDelete(toast);

  useEffect(() => {
    getJobs()
      .then(setJobs)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    getTalentPool({ jobId })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Couldn't load the talent pool.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, reloadKey]);

  // Picking a job ranks by fit; clearing it goes back to the saved order.
  const setJob = useCallback(
    (next) => {
      setSelected([]);
      setScreening({});
      setStatus("loading");
      setSortBy(next ? "fit" : "recent");
      router.replace(next ? `/dashboard/talent-pool?jobId=${next}` : "/dashboard/talent-pool", { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router]
  );

  const job = data?.job || null;
  const allItems = useMemo(() => data?.items || [], [data]);
  const effectiveSort = !job && sortBy === "fit" ? "recent" : sortBy;

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = todayIso();
    const list = allItems.filter((i) => {
      if (availability === "due" ? !(i.checkIn && i.checkIn <= today) : availability !== "all" && i.status !== availability) return false;
      if (skill && !i.skills.some((s) => s.toLowerCase() === skill)) return false;
      if (q && ![i.name, i.currentTitle, i.currentCompany, i.location, i.note, ...i.skills].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort(SORTS[effectiveSort].fn);
  }, [allItems, search, availability, skill, effectiveSort]);

  const counts = useMemo(() => {
    const today = todayIso();
    return {
      all: allItems.length,
      available: allItems.filter((i) => i.status === "available").length,
      open: allItems.filter((i) => i.status === "open").length,
      not_looking: allItems.filter((i) => i.status === "not_looking").length,
      due: allItems.filter((i) => i.checkIn && i.checkIn <= today).length,
    };
  }, [allItems]);

  const pickable = useMemo(() => items.filter((i) => (job ? !i.screened && i.hasCv : true)), [items, job]);
  const filtering = Boolean(search.trim() || skill || availability !== "all");

  function patchItem(id, fields) {
    setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...fields } : i)) }));
  }

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  // Availability, check-in and note, saved as they're changed.
  async function updateEntry(item, fields) {
    const before = { status: item.status, checkIn: item.checkIn, note: item.note, expiresAt: item.expiresAt };
    if (!fields.extend) patchItem(item.id, fields);
    setBusyIds((s) => new Set(s).add(item.id));
    try {
      const saved = await updateTalentPoolEntry(item.id, fields);
      patchItem(item.id, { status: saved.status, checkIn: saved.checkIn, note: saved.note, expiresAt: saved.expiresAt });
      if (fields.extend) toast(`Kept in the pool until ${new Date(saved.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`);
      return true;
    } catch (err) {
      patchItem(item.id, before);
      toast(err.message || "Couldn't save that.", "error");
      return false;
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(item.id);
        return next;
      });
    }
  }

  function removeItem(item) {
    const index = data?.items.findIndex((i) => i.id === item.id) ?? -1;
    undoable({
      key: `pool:${item.id}`,
      message: `${item.name} removed from the pool`,
      hide: () => {
        setData((d) => ({ ...d, total: d.total - 1, items: d.items.filter((i) => i.id !== item.id) }));
        setSelected((s) => s.filter((x) => x !== item.id));
      },
      restore: () =>
        setData((d) => {
          if (!d || d.items.some((i) => i.id === item.id)) return d;
          const items = [...d.items];
          items.splice(index < 0 ? items.length : Math.min(index, items.length), 0, item);
          return { ...d, total: d.total + 1, items };
        }),
      commit: () => removeFromTalentPool(item.id),
    });
  }

  async function bulkAvailability(value) {
    if (!value || selected.length === 0) return;
    setBulkBusy(true);
    const ids = [...selected];
    const next = value === "clear" ? null : value;
    let failedCount = 0;
    for (let i = 0; i < ids.length; i += 4) {
      await Promise.all(
        ids.slice(i, i + 4).map((id) =>
          updateTalentPoolEntry(id, { status: next })
            .then(() => patchItem(id, { status: next }))
            .catch(() => {
              failedCount += 1;
            })
        )
      );
    }
    setBulkBusy(false);
    if (failedCount) toast(`Couldn't update ${failedCount} of them.`, "error");
    else toast(`Updated ${ids.length}`);
  }

  async function bulkRemove() {
    const ids = [...selected];
    if (!confirm(`Remove ${ids.length} ${ids.length === 1 ? "person" : "people"} from the talent pool? Their profiles and screenings stay as they are.`)) return;
    setBulkBusy(true);
    try {
      await bulkUpdateCandidates(ids, { action: "unpool" });
      setData((d) => ({ ...d, total: d.total - ids.length, items: d.items.filter((i) => !ids.includes(i.id)) }));
      setSelected([]);
      toast(`Removed ${ids.length} from the pool`);
    } catch (err) {
      toast(err.message || "Couldn't remove them.", "error");
    } finally {
      setBulkBusy(false);
    }
  }

  // Screens the selection a couple at a time. Each is a full analysis, so a
  // 429 (hourly allowance used up) stops the rest.
  async function screenSelected() {
    if (!job || selected.length === 0) return;
    const queue = selected.filter((id) => pickable.some((p) => p.id === id));
    stopRef.current = false;
    setRunning(true);
    setScreening((s) => ({ ...s, ...Object.fromEntries(queue.map((id) => [id, { status: "queued" }])) }));

    let done = 0;
    async function worker() {
      while (queue.length && !stopRef.current) {
        const id = queue.shift();
        setScreening((s) => ({ ...s, [id]: { status: "running" } }));
        try {
          const r = await rescreenCandidate(id, job.id);
          done += 1;
          const role = { candidateId: r.candidateId, jobId: job.id, jobTitle: job.title, score: r.score, stage: "Screened" };
          setScreening((s) => ({ ...s, [id]: { status: "done" } }));
          setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, screened: role, roles: [...i.roles, role] } : i)) }));
        } catch (err) {
          if (err.status === 409 && err.existingId) {
            setScreening((s) => ({ ...s, [id]: { status: "done" } }));
            patchItem(id, { screened: { candidateId: err.existingId, jobId: job.id, score: null } });
          } else {
            if (err.status === 429) stopRef.current = true;
            setScreening((s) => ({ ...s, [id]: { status: "failed", error: err.message } }));
          }
        }
        setSelected((sel) => sel.filter((x) => x !== id));
      }
    }
    await Promise.all(Array.from({ length: SCREEN_CONCURRENCY }, worker));
    setScreening((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v.status !== "queued")));
    setRunning(false);
    if (stopRef.current && queue.length) toast("Stopped - the rest weren't screened.", "error");
    else if (done) toast(`Screened ${done} for ${job.title}`);
  }

  function exportCsv() {
    downloadCsv(
      `talent-pool-${todayIso()}.csv`,
      items.map((i) => ({
        Name: i.name,
        "Current title": i.currentTitle || "",
        "Current company": i.currentCompany || "",
        Location: i.location || "",
        "Years experience": i.yearsExperience ?? "",
        Availability: AVAILABILITY[i.status]?.label || "",
        "Check in": i.checkIn || "",
        Note: i.note || "",
        Skills: i.skills.join("; "),
        "Best open job": i.bestMatch ? `${i.bestMatch.title} (${i.bestMatch.fit}%)` : "",
        ...(job ? { [`Fit for ${job.title}`]: i.fit ?? "", Screened: i.screened?.score ?? "" } : {}),
        "Screened for": i.roles.map((r) => `${r.jobTitle}${r.score != null ? ` (${r.score})` : ""}`).join("; "),
        Saved: i.savedAt?.slice(0, 10) || "",
        "Saved by": i.savedBy || "",
      }))
    );
  }

  const screenedForJob = useMemo(
    () => allItems.filter((i) => i.screened?.candidateId).sort((a, b) => (b.screened.score ?? -1) - (a.screened.score ?? -1)),
    [allItems]
  );
  const compareHref =
    job && screenedForJob.length >= 2
      ? `/analyse/compare?jobId=${job.id}&ids=${screenedForJob.slice(0, 4).map((i) => i.screened.candidateId).join(",")}`
      : null;

  const openJobsWithPool = data?.openJobs || [];
  const stats = data?.stats;
  const allSelected = pickable.length > 0 && pickable.every((i) => selected.includes(i.id));

  return (
    <main className="min-h-screen bg-[var(--mist)] pb-28">
      <DashboardNav />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 text-[var(--ink-faint)]">Candidate database</p>
            <h1 className="text-2xl font-semibold text-[var(--ink)]" style={{ fontFamily: "var(--font-display)" }}>
              Talent pool
            </h1>
            <p className="text-[13px] text-[var(--ink-soft)] mt-1 max-w-2xl">
              People worth keeping for future roles. When a new job comes in, match it against the pool and screen the best from
              the CVs you already have.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data && data.total > 0 && (
              <PillButton icon="clipboard" onClick={exportCsv}>
                Export CSV
              </PillButton>
            )}
            <PillButton href="/dashboard/candidates" icon="plus" primary={Boolean(data) && data.total === 0}>
              Add from Candidates
            </PillButton>
          </div>
        </header>

        {status === "loading" && !data && <PoolSkeleton />}
        {status === "error" && (
          <Notice
            tone="error"
            action={
              <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline">
                Try again
              </button>
            }
          >
            {error}
          </Notice>
        )}

        {status !== "error" && data && data.total === 0 && (
          <Card className="p-8 sm:p-12 text-center">
            <span className="mx-auto w-12 h-12 rounded-full bg-[var(--mint)] text-[var(--forest)] flex items-center justify-center mb-4">
              <Icon name="bookmark" size={20} />
            </span>
            <p className="text-[16px] font-semibold text-[var(--ink)]">Start building your talent pool</p>
            <p className="text-[13px] text-[var(--ink-soft)] mt-1.5 max-w-md mx-auto">
              Save strong candidates who weren&apos;t right this time - from their profile, the report after an analysis, or by selecting
              several on the Candidates list. When a new job comes in, they&apos;re matched to it automatically.
            </p>
            <div className="mt-6 grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
              {[
                ["bookmark", "Save", "Keep anyone worth another look, with a note on why."],
                ["sparkle", "Match", "Every open job is checked against the pool for free."],
                ["refresh", "Screen", "Score the best fits from their CV on file - no re-upload."],
              ].map(([icon, title, body]) => (
                <div key={title} className="rounded-[12px] border border-[var(--border)] p-3.5">
                  <span className="text-[var(--forest)]">
                    <Icon name={icon} size={16} />
                  </span>
                  <p className="text-[13px] font-semibold text-[var(--ink)] mt-1.5">{title}</p>
                  <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <PillButton href="/dashboard/candidates" primary icon="arrowRight">
                Go to Candidates
              </PillButton>
            </div>
          </Card>
        )}

        {data && data.total > 0 && (
          <>
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="In the pool" value={stats.total} sub={`${stats.addedLast30} added in the last 30 days`} />
                <StatCard
                  label="Available now"
                  value={stats.available}
                  sub="Available or open to offers"
                  accent="var(--score-strong)"
                  active={availability === "available"}
                  onClick={() => setAvailability((a) => (a === "available" ? "all" : "available"))}
                />
                <StatCard
                  label="Check-ins due"
                  value={stats.checkInsDue}
                  sub={stats.checkInsDue ? "Time to get back in touch" : "Nothing due"}
                  accent={stats.checkInsDue ? "var(--score-low)" : undefined}
                  active={availability === "due"}
                  onClick={() => setAvailability((a) => (a === "due" ? "all" : "due"))}
                />
                <StatCard
                  label="Open jobs with fits"
                  value={openJobsWithPool.filter((j) => j.likely > 0).length}
                  sub={`of ${openJobsWithPool.length} open job${openJobsWithPool.length === 1 ? "" : "s"}`}
                  accent="var(--forest)"
                />
              </div>
            )}

            {job ? (
              <Card className="p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="w-10 h-10 rounded-[10px] bg-[var(--mint)] text-[var(--forest)] flex items-center justify-center shrink-0">
                      <Icon name="briefcase" size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">Matching the pool against</p>
                      <p className="text-[16px] font-semibold text-[var(--ink)] truncate">
                        {job.title}
                        {job.client && <span className="font-normal text-[var(--ink-soft)]"> · {job.client}</span>}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mt-2">
                        {job.requiredSkills.map((s) => (
                          <Chip key={s}>{s}</Chip>
                        ))}
                        {job.minYearsExperience ? <Chip>{job.minYearsExperience}+ yrs</Chip> : null}
                        {job.requiredSkills.length === 0 && !job.minYearsExperience && (
                          <span className="text-[12px] text-[var(--ink-soft)]">
                            No requirements listed on this job, so there&apos;s nothing to pre-check - screening still works.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      value={jobId}
                      onChange={(e) => setJob(e.target.value)}
                      disabled={running}
                      aria-label="Change job"
                      className="text-[12.5px] font-semibold px-3.5 py-2 rounded-full border border-[var(--border)] bg-white max-w-[220px] disabled:opacity-60"
                    >
                      {!jobs.some((j) => j.id === jobId) && <option value={jobId}>{job.title}</option>}
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                          {j.status !== "open" ? " (closed)" : ""}
                        </option>
                      ))}
                    </select>
                    <PillButton href={`/dashboard/jobs/${job.id}`} icon="external">
                      View job
                    </PillButton>
                    {compareHref && (
                      <PillButton href={compareHref} primary icon="compare">
                        Compare top {Math.min(4, screenedForJob.length)}
                      </PillButton>
                    )}
                    <button
                      type="button"
                      onClick={() => setJob("")}
                      disabled={running}
                      aria-label="Stop matching against this job"
                      className="p-2 rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--mist)] disabled:opacity-40"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            ) : (
              openJobsWithPool.length > 0 && (
                <section aria-labelledby="open-jobs-title">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3 mb-2.5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">Match to a job</p>
                      <h2 id="open-jobs-title" className="text-[15px] font-semibold text-[var(--ink)]">
                        Open jobs you could fill from the pool
                      </h2>
                    </div>
                    <select
                      value=""
                      onChange={(e) => e.target.value && setJob(e.target.value)}
                      aria-label="Match against any job"
                      className="self-start sm:self-auto text-[12px] font-semibold px-3 py-1.5 rounded-full border border-[var(--border)] bg-white"
                    >
                      <option value="">Any job…</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                          {j.status !== "open" ? " (closed)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
                    {openJobsWithPool.slice(0, 12).map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => setJob(j.id)}
                        className="snap-start shrink-0 w-[250px] text-left rounded-[14px] bg-white border border-[var(--border)] p-4 hover:border-[var(--forest)] hover:shadow-[0_6px_20px_-12px_rgba(19,32,27,0.35)] transition"
                      >
                        <p className="text-[14px] font-semibold text-[var(--ink)] truncate">{j.title}</p>
                        <p className="text-[12px] text-[var(--ink-soft)] truncate">{j.client || "No client set"}</p>
                        <div className="flex items-center justify-between mt-3">
                          {j.likely > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full bg-[var(--mint)] text-[var(--forest-deep)]">
                              <Icon name="sparkle" size={11} />
                              {j.likely} likely fit{j.likely === 1 ? "" : "s"}
                            </span>
                          ) : (
                            <span className="text-[12px] text-[var(--ink-faint)]">{j.requiredSkills.length ? "No likely fits yet" : "No requirements to check"}</span>
                          )}
                          <span className="text-[12px] font-semibold text-[var(--forest)] inline-flex items-center gap-1">
                            Match <Icon name="arrowRight" size={12} />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )
            )}

            <Card className="overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-[var(--border-soft)] space-y-3">
                <div className="flex flex-col md:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none">
                      <Icon name="search" size={15} />
                    </span>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, role, skill, location or note…"
                      aria-label="Search the talent pool"
                      className="w-full text-[13.5px] pl-10 pr-4 py-2 rounded-full border border-[var(--border)] bg-white text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={skill}
                      onChange={(e) => setSkill(e.target.value)}
                      aria-label="Filter by skill"
                      className="text-[12.5px] font-semibold px-3.5 py-2 rounded-full bg-white min-w-0 flex-1 md:flex-none md:w-44"
                      style={{ border: `1px solid ${skill ? "var(--forest)" : "var(--border)"}` }}
                    >
                      <option value="">Any skill</option>
                      {(data.topSkills || []).map((s) => (
                        <option key={s.label} value={s.label.toLowerCase()}>
                          {s.label} ({s.count})
                        </option>
                      ))}
                    </select>
                    <select
                      value={effectiveSort}
                      onChange={(e) => setSortBy(e.target.value)}
                      aria-label="Sort"
                      className="text-[12.5px] font-semibold px-3.5 py-2 rounded-full border border-[var(--border)] bg-white min-w-0 flex-1 md:flex-none md:w-48"
                    >
                      {Object.entries(SORTS)
                        .filter(([k]) => k !== "fit" || job)
                        .map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
                  {AVAILABILITY_FILTERS.map(([k, label]) => {
                    const on = availability === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setAvailability(k)}
                        aria-pressed={on}
                        className={cx(
                          "shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors",
                          on ? "bg-[var(--forest)] border-[var(--forest)] text-white" : "bg-white border-[var(--border)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                        )}
                      >
                        {AVAILABILITY[k] && <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "white" : AVAILABILITY[k].dot }} />}
                        {label}
                        <span className={cx("text-[10px] tabular-nums px-1.5 rounded-full", on ? "bg-white/25" : "bg-[var(--mist)] text-[var(--ink-faint)]")}>
                          {counts[k]}
                        </span>
                      </button>
                    );
                  })}
                  {filtering && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setSkill("");
                        setAvailability("all");
                      }}
                      className="shrink-0 text-[12px] font-semibold text-[var(--forest)] px-2"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5 bg-[#fbfcfb] border-b border-[var(--border-soft)] text-[12px] text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={pickable.length === 0 || running}
                  onChange={() => setSelected(allSelected ? [] : pickable.map((i) => i.id))}
                  aria-label="Select all shown"
                  className="w-4 h-4 accent-[var(--forest)] disabled:opacity-30"
                />
                <span>
                  {status === "loading" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Spinner size={12} /> Updating…
                    </span>
                  ) : (
                    <>
                      Showing <b className="text-[var(--ink)] tabular-nums">{items.length}</b> of {data.total}
                      {job && effectiveSort === "fit" ? " · best fit first" : ""}
                    </>
                  )}
                </span>
                {job && pickable.length > 0 && !running && (
                  <button
                    type="button"
                    onClick={() => setSelected(pickable.filter((i) => (i.fit ?? 0) >= 40).slice(0, 5).map((i) => i.id))}
                    className="ml-auto font-semibold text-[var(--forest)] hover:underline"
                  >
                    Select top 5 by fit
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <p className="p-10 text-center text-[13px] text-[var(--ink-soft)]">No one in the pool matches these filters.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-soft)]">
                  {items.map((item) => (
                    <PoolRow
                      key={item.id}
                      item={item}
                      job={job}
                      selected={selected.includes(item.id)}
                      onToggle={toggle}
                      screening={screening[item.id]}
                      onUpdate={updateEntry}
                      onRemove={removeItem}
                      onMatchJob={setJob}
                      busy={busyIds.has(item.id)}
                    />
                  ))}
                </ul>
              )}
            </Card>

            {job && (
              <p className="text-[12px] text-[var(--ink-faint)]">
                Fit is a quick check of which of the job&apos;s requirements appear in each CV - free and instant, but only a guide. Screening
                gives the real match score, and puts them in the pipeline under this job.
              </p>
            )}
          </>
        )}
      </div>

      {/* Selection tray */}
      {(selected.length > 0 || running) && (
        <div className="fixed bottom-5 inset-x-0 z-30 px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[760px] flex flex-wrap items-center gap-2.5 rounded-[16px] bg-[var(--ink)] text-white pl-5 pr-2.5 py-2.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)]">
            <span className="text-[13px] font-semibold">{running ? `Screening for ${job?.title}…` : `${selected.length} selected`}</span>
            {!running && (
              <button type="button" onClick={() => setSelected([])} className="text-[12px] font-medium text-white/70 hover:text-white">
                Clear
              </button>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {job ? (
                running ? (
                  <button
                    type="button"
                    onClick={() => {
                      stopRef.current = true;
                    }}
                    className="text-[12.5px] font-semibold px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={screenSelected}
                    disabled={selected.length === 0}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-4 py-2 rounded-full bg-[var(--forest)] hover:bg-[var(--forest-deep)] disabled:opacity-50"
                  >
                    <Icon name="sparkle" size={13} />
                    Screen {selected.length} for {job.title}
                  </button>
                )
              ) : (
                <>
                  <select
                    value=""
                    disabled={bulkBusy}
                    onChange={(e) => bulkAvailability(e.target.value)}
                    aria-label="Set availability for the selected"
                    className="text-[12.5px] font-semibold px-3.5 py-2 rounded-full bg-white/10 text-white border border-white/15 [&>option]:text-[var(--ink)]"
                  >
                    <option value="">Set availability…</option>
                    {Object.entries(AVAILABILITY).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                    <option value="clear">Unknown</option>
                  </select>
                  <button
                    type="button"
                    onClick={bulkRemove}
                    disabled={bulkBusy}
                    className="text-[12.5px] font-semibold px-3.5 py-2 rounded-full bg-white/10 hover:bg-[#a83226] disabled:opacity-50"
                  >
                    Remove from pool
                  </button>
                </>
              )}
            </span>
          </div>
        </div>
      )}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}

export default function TalentPoolPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--mist)]"><DashboardNav /></main>}>
      <TalentPoolContent />
    </Suspense>
  );
}
