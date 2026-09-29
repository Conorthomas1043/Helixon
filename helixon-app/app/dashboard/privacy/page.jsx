"use client";

// /dashboard/privacy - the workspace's GDPR controls in one place:
//   - how long candidates are kept without activity (lib/privacy-settings),
//     and who is coming up for deletion so they can be kept on purpose
//   - talent pool entries about to lapse
//   - whether the Team page shows who's online (staff presence)
//   - how to handle candidates' requests (access, erasure, correction)
//   - a privacy notice the agency can give candidates
// Settings are changed by the owner or an admin; everyone can see them.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getPrivacyOverview, keepCandidates, updatePrivacySettings, updateTalentPoolEntry } from "@/lib/dashboard-api";
import { Card, Icon, Notice, Spinner, Switch, Toasts, useToasts } from "@/app/analyse/_components/ui";
import { PillButton } from "@/app/analyse/_components/compareBits";

function fmt(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-";
}

function Section({ eyebrow, title, children, action }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">{eyebrow}</p>
          <h2 className="text-[16px] font-semibold text-[var(--ink)] mt-0.5">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

const NOTICE_TEMPLATE = `How [Agency name] uses your personal data

We process the CV and details you send us to find and put you forward for roles. Our lawful basis is our legitimate interest in providing recruitment services (and, where we put you forward to a client, taking steps at your request before a contract).

We use Helixon, a recruitment software provider, to organise applications and to help assess how your CV matches a role's requirements. Helixon's AI produces a match score and summary; a recruiter always reviews it, and no decision about you is made by software alone. You can ask for a person to review any assessment.

We keep your data for [12] months after our last contact with you, unless you agree to stay in our talent pool for future roles, and then delete it.

You can ask us for a copy of your data, to correct it, to delete it, or to object to how we use it, by contacting [email address]. You can also complain to the Information Commissioner's Office (ico.org.uk).`;

function PrivacyContent() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState([]);
  const [copied, setCopied] = useState(false);
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
    try {
      const r = await keepCandidates(ids);
      toast(`Kept ${r.kept} - their ${data.settings.retentionMonths}-month clock restarts today`);
      setSelected([]);
      load();
    } catch (err) {
      toast(err.message || "Couldn't keep them.", "error");
    }
  }

  async function extend(id) {
    try {
      await updateTalentPoolEntry(id, { extend: true });
      toast("Kept in the talent pool");
      load();
    } catch (err) {
      toast(err.message || "Couldn't extend it.", "error");
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
  const deletions = data?.upcoming?.deletions || [];
  const expiries = data?.upcoming?.poolExpiries || [];

  return (
    <main className="min-h-screen bg-[var(--mist)]">
      <DashboardNav />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 text-[var(--ink-faint)]">Workspace</p>
          <h1 className="text-2xl font-semibold text-[var(--ink)]" style={{ fontFamily: "var(--font-display)" }}>
            Data &amp; privacy
          </h1>
          <p className="text-[13px] text-[var(--ink-soft)] mt-1 max-w-2xl">
            Your agency is the data controller for your candidates; Helixon processes their data for you. These settings help you meet
            UK GDPR - keeping data no longer than needed, and answering candidates&apos; requests.
          </p>
        </header>

        {status === "loading" && (
          <Card className="p-10 flex items-center justify-center gap-3 text-[13px] text-[var(--ink-soft)]">
            <Spinner /> Loading…
          </Card>
        )}
        {status === "error" && <Notice tone="error">{error}</Notice>}

        {status === "ready" && (
          <>
            {!manage && (
              <Notice tone="info">Only the workspace owner or an admin can change these settings. You can still keep candidates and use the tools below.</Notice>
            )}

            <div className="grid gap-6 lg:grid-cols-2 items-start">
              <Section eyebrow="Storage limitation" title="How long candidates are kept">
                <p className="text-[13px] text-[var(--ink-soft)]">
                  Candidates with no activity for this long are permanently deleted - CV, analyses, notes and history. Any activity (a stage
                  change, a note, an email) restarts the clock. People in the talent pool are kept until their pool entry lapses.
                </p>
                <div className="flex flex-wrap gap-2 mt-4" role="radiogroup" aria-label="Retention period">
                  {data.retentionChoices.map((m) => {
                    const on = data.settings.retentionMonths === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={!manage || saving}
                        onClick={() => save({ retentionMonths: m }, `Candidates are now kept for ${m} months without activity`)}
                        className="text-[13px] font-semibold px-4 py-2 rounded-full border transition-colors disabled:cursor-not-allowed"
                        style={{
                          background: on ? "var(--forest)" : "white",
                          color: on ? "white" : "var(--ink-soft)",
                          borderColor: on ? "var(--forest)" : "var(--border)",
                          opacity: !manage && !on ? 0.5 : 1,
                        }}
                      >
                        {m} months
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11.5px] text-[var(--ink-faint)] mt-3">
                  Checked every night. After an agency cancels, everything is deleted 90 days later whatever this is set to.
                </p>
              </Section>

              <Section eyebrow="Staff privacy" title="Team presence">
                <p className="text-[13px] text-[var(--ink-soft)]">
                  Shows teammates who&apos;s active, idle, busy or away on the Team page, and when anyone offline was last active. Helixon only
                  records when people have it open and were last using it - never what they click or type. Anyone can hide their own
                  presence.
                </p>
                <div className="mt-4">
                  <Switch
                    id="presence-enabled"
                    checked={data.settings.presenceEnabled}
                    onChange={(v) =>
                      manage && save({ presenceEnabled: v }, v ? "Team presence switched on" : "Team presence switched off - recorded times deleted")
                    }
                    label={data.settings.presenceEnabled ? "On for this workspace" : "Off - nothing is recorded"}
                    description={manage ? "Switching it off deletes what's been recorded." : "Ask the owner or an admin to change this."}
                  />
                </div>
                <p className="text-[11.5px] text-[var(--ink-faint)] mt-3">
                  Tell your team this is on - it&apos;s monitoring of staff, so it should be in your staff privacy notice.
                </p>
              </Section>
            </div>

            <Section
              eyebrow="Next 30 days"
              title={deletions.length ? `${deletions.length} candidate${deletions.length === 1 ? "" : "s"} due for deletion` : "Nobody is due for deletion"}
              action={
                deletions.length > 0 && (
                  <PillButton primary disabled={!selected.length} onClick={() => keep(selected)} icon="check">
                    Keep {selected.length || ""} selected
                  </PillButton>
                )
              }
            >
              {deletions.length === 0 ? (
                <p className="text-[13px] text-[var(--ink-soft)]">
                  No candidate reaches {data.settings.retentionMonths} months without activity in the next 30 days.
                </p>
              ) : (
                <>
                  <p className="text-[12.5px] text-[var(--ink-soft)] mb-3">
                    Only keep someone if you still have a reason to - e.g. they&apos;re in an active process or have agreed to be contacted about
                    future roles (then add them to the talent pool).
                  </p>
                  <ul className="divide-y divide-[var(--border-soft)] rounded-[12px] border border-[var(--border)] overflow-hidden">
                    {deletions.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={() => setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                          aria-label={`Keep ${c.name}`}
                          className="w-4 h-4 accent-[var(--forest)]"
                        />
                        <div className="min-w-0 flex-1">
                          <Link href={`/dashboard/candidates/${c.id}`} className="text-[13.5px] font-semibold text-[var(--ink)] hover:underline">
                            {c.name}
                          </Link>
                          <p className="text-[12px] text-[var(--ink-faint)]">
                            {[c.jobTitle, c.stage, `last activity ${fmt(c.lastActiveAt)}`].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className="text-[12px] font-semibold text-[#a83226] shrink-0">Deleted {fmt(c.deletesOn)}</span>
                        <button type="button" onClick={() => keep([c.id])} className="text-[12px] font-semibold text-[var(--forest)] shrink-0 hover:underline">
                          Keep
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {expiries.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-faint)] mb-2">Leaving the talent pool</p>
                  <ul className="divide-y divide-[var(--border-soft)] rounded-[12px] border border-[var(--border)] overflow-hidden">
                    {expiries.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                        <Link href={`/dashboard/candidates/${c.id}`} className="min-w-0 flex-1 text-[13.5px] font-semibold text-[var(--ink)] hover:underline truncate">
                          {c.name}
                        </Link>
                        <span className="text-[12px] text-[#8a5a12] shrink-0">Leaves {fmt(c.expiresAt)}</span>
                        <button type="button" onClick={() => extend(c.id)} className="text-[12px] font-semibold text-[var(--forest)] shrink-0 hover:underline">
                          Extend
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            <div className="grid gap-6 lg:grid-cols-2 items-start">
              <Section eyebrow="Candidates' rights" title="When a candidate asks about their data">
                <ul className="space-y-3 text-[13px]">
                  {[
                    ["Access or a copy (portability)", "Open their profile and choose Export data. The file covers every job they've been screened for. Send it with their original CV."],
                    ["Erasure", "Open their profile, Delete candidate, and choose to erase every record. This removes all their screenings, notes, history and files."],
                    ["Correction", "Use Edit details on their profile."],
                    ["Human review of an AI assessment", "A recruiter reviews every match score; record your own view with the thumbs on the report or a note on the profile."],
                  ].map(([title, body]) => (
                    <li key={title} className="flex gap-2.5">
                      <span className="mt-0.5 text-[var(--forest)] shrink-0">
                        <Icon name="check" size={14} />
                      </span>
                      <span>
                        <b className="text-[var(--ink)] font-semibold">{title}.</b> <span className="text-[var(--ink-soft)]">{body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11.5px] text-[var(--ink-faint)] mt-4">You normally have one month to respond.</p>
              </Section>

              <Section
                eyebrow="Transparency"
                title="Privacy notice for candidates"
                action={
                  <PillButton icon={copied ? "check" : "copy"} onClick={copyTemplate}>
                    {copied ? "Copied" : "Copy"}
                  </PillButton>
                }
              >
                <p className="text-[12.5px] text-[var(--ink-soft)] mb-3">
                  Candidates must be told how their data is used, including that software helps assess CVs. Adapt this for your website or
                  first email - fill in the [brackets].
                </p>
                <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--ink)] bg-[var(--mist)] rounded-[10px] p-3.5 max-h-72 overflow-y-auto font-sans">
                  {NOTICE_TEMPLATE}
                </pre>
              </Section>
            </div>

            <p className="text-[12px] text-[var(--ink-faint)]">
              More detail:{" "}
              <Link href="/privacy" className="underline">Privacy policy</Link> ·{" "}
              <Link href="/dpa" className="underline">Data processing agreement</Link> ·{" "}
              <Link href="/cookie-policy" className="underline">Cookie policy</Link>
            </p>
          </>
        )}
      </div>
      <Toasts toasts={toasts} />
    </main>
  );
}

export default function PrivacySettingsPage() {
  return <PrivacyContent />;
}
