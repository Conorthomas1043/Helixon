"use client";

// /dashboard/privacy - the workspace's GDPR controls in one place:
//   - how long candidates are kept without activity (lib/privacy-settings),
//     and who is coming up for deletion so they can be kept on purpose
//   - talent pool entries about to lapse
//   - whether the Team page shows who's online (staff presence)
//   - how to handle candidates' requests (access, erasure, correction)
//   - a privacy notice the agency can give candidates
// Settings are changed by the owner or an admin; everyone can see them and
// keep / extend people.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getPrivacyOverview, keepCandidates, updatePrivacySettings, updateTalentPoolEntry } from "@/lib/dashboard-api";
import { Card, Icon, Notice, Spinner, Toasts, cx, useToasts } from "@/app/analyse/_components/ui";
import { Avatar, PillButton, PillTabs, StagePill } from "@/app/analyse/_components/compareBits";

const NOTICE_TEMPLATE = `How [Agency name] uses your personal data

We process the CV and details you send us to find and put you forward for roles. Our lawful basis is our legitimate interest in providing recruitment services (and, where we put you forward to a client, taking steps at your request before a contract).

We use Helixon, a recruitment software provider, to organise applications and to help assess how your CV matches a role's requirements. Helixon's AI produces a match score and summary; a recruiter always reviews it, and no decision about you is made by software alone. You can ask for a person to review any assessment.

We keep your data for [12] months after our last contact with you, unless you agree to stay in our talent pool for future roles, and then delete it.

You can ask us for a copy of your data, to correct it, to delete it, or to object to how we use it, by contacting [email address]. You can also complain to the Information Commissioner's Office (ico.org.uk).`;

const REQUESTS = [
  {
    icon: "download",
    title: "A copy of their data",
    right: "Access & portability",
    how: "Open their profile → Export data. One file covers every job they've been screened for - send it with their original CV.",
  },
  {
    icon: "trash",
    title: "Delete their data",
    right: "Erasure",
    how: "Open their profile → Delete candidate, and choose to erase every record. Screenings, notes, history and files all go.",
  },
  {
    icon: "pencil",
    title: "Fix something that's wrong",
    right: "Rectification",
    how: "Open their profile → Edit details to correct their name, contact details or current role.",
  },
  {
    icon: "users",
    title: "A person to review their score",
    right: "Human review",
    how: "A recruiter reviews every AI assessment. Record your own view with the thumbs on the report, or a note on their profile.",
  },
];

function fmt(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-";
}

function daysUntil(iso) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

/* ── Small pieces ─────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="rounded-[14px] p-4 sm:p-5 bg-white border border-[var(--border)]">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
        {icon && <Icon name={icon} size={12} />}
        {label}
      </p>
      <p className="text-[26px] font-semibold tabular-nums leading-none mt-2.5" style={{ fontFamily: "var(--font-mono)", color: accent || "var(--ink)" }}>
        {value}
      </p>
      {sub && <p className="text-[11.5px] text-[var(--ink-faint)] mt-2">{sub}</p>}
    </div>
  );
}

function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">{eyebrow}</p>
        <h2 className="text-[16px] font-semibold text-[var(--ink)] mt-0.5">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// "in 10 days" - red within a week, amber within a month.
function Countdown({ iso, verb }) {
  const days = daysUntil(iso);
  const urgent = days <= 7;
  return (
    <span className="text-right shrink-0">
      <span
        className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: urgent ? "#fbefed" : "#fdf6e9", color: urgent ? "#a83226" : "#8a5a12" }}
      >
        <Icon name="clock" size={11} />
        {days === 0 ? "Today" : `In ${days} day${days === 1 ? "" : "s"}`}
      </span>
      <span className="hidden sm:block text-[11px] text-[var(--ink-faint)] mt-1">
        {verb} {fmt(iso)}
      </span>
    </span>
  );
}

function AllClear({ children }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <span className="w-11 h-11 rounded-full bg-[var(--mint)] text-[var(--forest)] flex items-center justify-center mb-3">
        <Icon name="check" size={20} strokeWidth={2.2} />
      </span>
      <p className="text-[14.5px] font-semibold text-[var(--ink)]">You&apos;re all clear</p>
      <p className="text-[13px] text-[var(--ink-soft)] mt-1 max-w-sm">{children}</p>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

function PrivacyContent() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState([]);
  const [tab, setTab] = useState("deletions");
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const { toasts, toast } = useToasts();

  const load = useCallback(() => {
    getPrivacyOverview()
      .then((d) => {
        setData(d);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message || "Couldn't load your privacy settings.");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(fields, message) {
    setSaving(true);
    try {
      await updatePrivacySettings(fields);
      toast(message);
      load();
    } catch (err) {
      toast(err.message || "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function keep(ids) {
    setBusyId(ids.length === 1 ? ids[0] : "bulk");
    try {
      const r = await keepCandidates(ids);
      toast(`Kept ${r.kept} - their ${data.settings.retentionMonths}-month clock restarts today`);
      setSelected([]);
      load();
    } catch (err) {
      toast(err.message || "Couldn't keep them.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function extend(id) {
    setBusyId(id);
    try {
      await updateTalentPoolEntry(id, { extend: true });
      toast("Kept in the talent pool");
      load();
    } catch (err) {
      toast(err.message || "Couldn't extend it.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(NOTICE_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  const manage = data?.canManage;
  const months = data?.settings?.retentionMonths;
  const deletions = useMemo(() => data?.upcoming?.deletions || [], [data]);
  const expiries = useMemo(() => data?.upcoming?.poolExpiries || [], [data]);
  const allSelected = deletions.length > 0 && deletions.every((d) => selected.includes(d.id));

  return (
    <main className="min-h-screen bg-[var(--mist)] pb-24">
      <DashboardNav />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 text-[var(--ink-faint)]">Workspace</p>
            <h1 className="text-2xl font-semibold text-[var(--ink)]" style={{ fontFamily: "var(--font-display)" }}>
              Data &amp; privacy
            </h1>
            <p className="text-[13px] text-[var(--ink-soft)] mt-1 max-w-2xl">
              You&apos;re the data controller for your candidates; Helixon processes their data for you. Keep data no longer than you need
              it, and answer candidates&apos; requests - all from here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PillButton href="/privacy" icon="shield">
              Privacy policy
            </PillButton>
            <PillButton href="/dpa" icon="clipboard">
              DPA
            </PillButton>
          </div>
        </header>

        {status === "loading" && (
          <Card className="p-10 flex items-center justify-center gap-3 text-[13px] text-[var(--ink-soft)]">
            <Spinner /> Loading…
          </Card>
        )}
        {status === "error" && (
          <Notice
            tone="error"
            action={
              <button type="button" onClick={load} className="font-semibold underline">
                Try again
              </button>
            }
          >
            {error}
          </Notice>
        )}

        {status === "ready" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard icon="clock" label="Retention period" value={`${months} mo`} sub="Deleted after this long without activity" />
              <StatCard
                icon="trash"
                label="Due for deletion"
                value={deletions.length}
                sub="In the next 30 days"
                accent={deletions.length ? "var(--score-low)" : "var(--score-strong)"}
              />
              <StatCard
                icon="bookmark"
                label="Leaving talent pool"
                value={expiries.length}
                sub="In the next 30 days"
                accent={expiries.length ? "var(--score-mid)" : undefined}
              />
              <StatCard
                icon="users"
                label="Team presence"
                value={data.settings.presenceEnabled ? "On" : "Off"}
                sub={data.settings.presenceEnabled ? "Anyone can hide their own" : "Nothing is recorded"}
                accent={data.settings.presenceEnabled ? "var(--forest)" : "var(--ink-faint)"}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
              <div className="space-y-6 min-w-0">
              {/* Review list */}
              <Card className="overflow-hidden">
                <div className="p-5 sm:p-6 pb-4 border-b border-[var(--border-soft)]">
                  <SectionTitle eyebrow="Next 30 days" title="Coming up for review" />
                  <PillTabs
                    value={tab}
                    onChange={(v) => {
                      setTab(v);
                      setSelected([]);
                    }}
                    ariaLabel="What to review"
                    options={[
                      { value: "deletions", label: `Due for deletion · ${deletions.length}`, icon: "trash" },
                      { value: "pool", label: `Leaving the pool · ${expiries.length}`, icon: "bookmark" },
                    ]}
                  />
                </div>

                {tab === "deletions" &&
                  (deletions.length === 0 ? (
                    <AllClear>No candidate reaches {months} months without activity in the next 30 days.</AllClear>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-3 px-5 sm:px-6 py-2.5 bg-[#fbfcfb] border-b border-[var(--border-soft)] text-[12px] text-[var(--ink-soft)]">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => setSelected(allSelected ? [] : deletions.map((d) => d.id))}
                          aria-label="Select everyone due"
                          className="w-4 h-4 accent-[var(--forest)]"
                        />
                        <span>Only keep someone you still have a reason to - an active process, or they&apos;ve agreed to future contact.</span>
                      </div>
                      <ul className="divide-y divide-[var(--border-soft)]">
                        {deletions.map((c) => (
                          <li key={c.id} className={cx("flex items-center gap-3 px-5 sm:px-6 py-3.5 transition-colors", selected.includes(c.id) ? "bg-[#f4faf7]" : "bg-white")}>
                            <input
                              type="checkbox"
                              checked={selected.includes(c.id)}
                              onChange={() => setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                              aria-label={`Select ${c.name}`}
                              className="w-4 h-4 shrink-0 accent-[var(--forest)]"
                            />
                            <span className="hidden sm:inline-flex">
                              <Avatar name={c.name} size={38} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link href={`/dashboard/candidates/${c.id}`} className="text-[14px] font-semibold text-[var(--ink)] hover:underline truncate">
                                  {c.name}
                                </Link>
                                <StagePill stage={c.stage} />
                              </div>
                              <p className="text-[12px] text-[var(--ink-faint)] truncate mt-0.5">
                                {[c.jobTitle, `last activity ${fmt(c.lastActiveAt)}`].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <Countdown iso={c.deletesOn} verb="Deleted" />
                            <PillButton onClick={() => keep([c.id])} disabled={busyId === c.id} className="!px-3 !py-1.5 !text-[12px] shrink-0">
                              {busyId === c.id ? "…" : "Keep"}
                            </PillButton>
                          </li>
                        ))}
                      </ul>
                    </>
                  ))}

                {tab === "pool" &&
                  (expiries.length === 0 ? (
                    <AllClear>No talent pool entries lapse in the next 30 days.</AllClear>
                  ) : (
                    <ul className="divide-y divide-[var(--border-soft)]">
                      {expiries.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 px-5 sm:px-6 py-3.5 bg-white">
                          <span className="hidden sm:inline-flex">
                              <Avatar name={c.name} size={38} />
                            </span>
                          <div className="min-w-0 flex-1">
                            <Link href={`/dashboard/candidates/${c.id}`} className="text-[14px] font-semibold text-[var(--ink)] hover:underline truncate block">
                              {c.name}
                            </Link>
                            <p className="text-[12px] text-[var(--ink-faint)]">In the talent pool - extending keeps them for another {months} months</p>
                          </div>
                          <Countdown iso={c.expiresAt} verb="Leaves" />
                          <PillButton onClick={() => extend(c.id)} disabled={busyId === c.id} className="!px-3 !py-1.5 !text-[12px] shrink-0">
                            {busyId === c.id ? "…" : "Extend"}
                          </PillButton>
                        </li>
                      ))}
                    </ul>
                  ))}
              </Card>

              {/* Candidates' requests */}
              <section aria-labelledby="requests-title">
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">Candidates&apos; rights</p>
                  <h2 id="requests-title" className="text-[16px] font-semibold text-[var(--ink)] mt-0.5">
                    When a candidate asks about their data
                  </h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {REQUESTS.map((r) => (
                    <div key={r.title} className="rounded-[14px] bg-white border border-[var(--border)] p-5">
                      <span className="w-10 h-10 rounded-[11px] bg-[var(--mint)] text-[var(--forest)] flex items-center justify-center">
                        <Icon name={r.icon} size={18} />
                      </span>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-faint)] mt-4">{r.right}</p>
                      <p className="text-[14.5px] font-semibold text-[var(--ink)] mt-0.5">{r.title}</p>
                      <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)] mt-2">{r.how}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-[var(--ink-faint)] mt-3">You normally have one month to respond.</p>
              </section>
              </div>

              {/* Settings */}
              <aside className="space-y-4 lg:sticky lg:top-[76px]">
                {!manage && (
                  <Notice tone="info">Only the workspace owner or an admin can change these settings.</Notice>
                )}
                <Card className="p-5 sm:p-6">
                  <SectionTitle eyebrow="Storage limitation" title="How long to keep candidates" />
                  <div className="grid grid-cols-4 gap-1.5 p-1 rounded-full bg-[var(--mist)] border border-[var(--border)]" role="radiogroup" aria-label="Retention period">
                    {data.retentionChoices.map((m) => {
                      const on = months === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={!manage || saving}
                          onClick={() => !on && save({ retentionMonths: m }, `Candidates are now kept for ${m} months without activity`)}
                          className={cx(
                            "text-[13px] font-semibold py-2 rounded-full transition-colors disabled:cursor-not-allowed",
                            on ? "bg-[var(--forest)] text-white shadow-sm" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                          )}
                        >
                          {m} mo
                        </button>
                      );
                    })}
                  </div>
                  <ol className="mt-5 space-y-3 text-[12.5px] text-[var(--ink-soft)]">
                    {[
                      ["Any activity restarts the clock", "A stage change, note, tag or email."],
                      [`After ${months} months with none`, "The candidate is deleted - CV, analyses, notes and history."],
                      ["Talent pool is protected", `Entries last ${months} months, and can be extended.`],
                    ].map(([title, body], i) => (
                      <li key={title} className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-[var(--mint)] text-[var(--forest)] text-[11px] font-semibold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span>
                          <b className="font-semibold text-[var(--ink)]">{title}.</b> {body}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-[11.5px] text-[var(--ink-faint)] mt-4 pt-4 border-t border-[var(--border-soft)]">
                    Checked every night. If your agency cancels, everything is deleted 90 days later.
                  </p>
                </Card>

                <Card className="p-5 sm:p-6">
                  <SectionTitle
                    eyebrow="Staff privacy"
                    title="Team presence"
                    action={
                      <button
                        type="button"
                        role="switch"
                        aria-checked={data.settings.presenceEnabled}
                        aria-label="Team presence"
                        disabled={!manage || saving}
                        onClick={() =>
                          save(
                            { presenceEnabled: !data.settings.presenceEnabled },
                            data.settings.presenceEnabled ? "Team presence switched off - recorded times deleted" : "Team presence switched on"
                          )
                        }
                        className="relative w-11 h-6 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0 mt-1"
                        style={{ background: data.settings.presenceEnabled ? "var(--forest)" : "var(--border)" }}
                      >
                        <span
                          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                          style={{ transform: data.settings.presenceEnabled ? "translateX(20px)" : "none" }}
                        />
                      </button>
                    }
                  />
                  <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">
                    Shows who&apos;s active, idle, busy or away on the Team page, and when anyone offline was last active. Only records when
                    people have Helixon open - never what they click or type.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {["Anyone can hide theirs", "Off deletes what's recorded"].map((t) => (
                      <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--mist)] text-[var(--ink-soft)]">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11.5px] text-[var(--ink-faint)] mt-4 pt-4 border-t border-[var(--border-soft)]">
                    It&apos;s monitoring of staff - mention it in your staff privacy notice while it&apos;s on.
                  </p>
                </Card>
              </aside>
            </div>

            {/* Candidate notice */}
            <Card className="overflow-hidden">
              <div className="grid lg:grid-cols-[340px_minmax(0,1fr)]">
                <div className="p-5 sm:p-6 lg:border-r border-b lg:border-b-0 border-[var(--border-soft)] bg-[#fbfcfb]">
                  <SectionTitle eyebrow="Transparency" title="Privacy notice for candidates" />
                  <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed">
                    Candidates must be told how their data is used - including that software helps assess CVs. Put this on your website or in
                    your first email.
                  </p>
                  <ul className="mt-4 space-y-2 text-[12.5px] text-[var(--ink-soft)]">
                    {["Fill in the [bracketed] parts", `Set the retention to match yours (${months} months)`, "Add the email address candidates should use"].map((t) => (
                      <li key={t} className="flex gap-2">
                        <span className="text-[var(--forest)] mt-0.5">
                          <Icon name="check" size={13} />
                        </span>
                        {t}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <PillButton primary icon={copied ? "check" : "copy"} onClick={copyTemplate}>
                      {copied ? "Copied" : "Copy notice"}
                    </PillButton>
                  </div>
                </div>
                <div className="p-5 sm:p-8 bg-[var(--mist)]">
                  <div className="mx-auto max-w-[620px] bg-white rounded-[12px] border border-[var(--border)] shadow-[0_10px_30px_-18px_rgba(19,32,27,0.35)] px-6 sm:px-9 py-7">
                    {NOTICE_TEMPLATE.split("\n\n").map((para, i) =>
                      i === 0 ? (
                        <h3 key={i} className="text-[17px] font-semibold text-[var(--ink)] mb-4" style={{ fontFamily: "var(--font-display)" }}>
                          {para}
                        </h3>
                      ) : (
                        <p key={i} className="text-[13px] leading-relaxed text-[var(--ink-soft)] mb-3 last:mb-0">
                          {para.split(/(\[[^\]]+\])/).map((part, j) =>
                            part.startsWith("[") ? (
                              <mark key={j} className="bg-[#fdf6e9] text-[#8a5a12] rounded px-0.5 font-semibold">
                                {part}
                              </mark>
                            ) : (
                              part
                            )
                          )}
                        </p>
                      )
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Selection tray, like the talent pool's */}
      {selected.length > 0 && tab === "deletions" && (
        <div className="fixed bottom-5 inset-x-0 z-30 px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[560px] flex items-center gap-3 rounded-[16px] bg-[var(--ink)] text-white pl-5 pr-2.5 py-2.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)]">
            <span className="text-[13px] font-semibold">{selected.length} selected</span>
            <button type="button" onClick={() => setSelected([])} className="text-[12px] font-medium text-white/70 hover:text-white">
              Clear
            </button>
            <button
              type="button"
              onClick={() => keep(selected)}
              disabled={busyId === "bulk"}
              className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-4 py-2 rounded-full bg-[var(--forest)] hover:bg-[var(--forest-deep)] disabled:opacity-50"
            >
              <Icon name="check" size={13} />
              Keep {selected.length} for another {months} months
            </button>
          </div>
        </div>
      )}
      <Toasts toasts={toasts} />
    </main>
  );
}

export default function PrivacySettingsPage() {
  return <PrivacyContent />;
}
