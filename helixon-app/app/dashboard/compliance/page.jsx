"use client";

// /dashboard/compliance - the agency's compliance to-do list
// (app/api/compliance): checks expired, expiring or still to do; people at
// offer or placed without a verified right-to-work check; privacy notices
// due to people who didn't apply directly; references still awaited.

import { useMemo, useState } from "react";
import Link from "next/link";
import { getComplianceOverview, sendPrivacyNoticesTo } from "@/lib/dashboard-api";
import { useResource } from "@/lib/hooks/useResource";
import { CHECK_KINDS } from "@/lib/compliance/core";
import { Page, PageHeader, Card, Button, ErrorState, ErrorText, LoadingCard, Pill, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";
import { CheckStatePill } from "@/components/dashboard/CompliancePanel";

function fmt(d) {
  if (!d) return "";
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function Person({ id, name }) {
  return (
    <Link href={`/dashboard/candidates/${id}`} className="font-semibold hover:underline" style={{ color: INK }}>
      {name}
    </Link>
  );
}

function Empty({ children }) {
  return (
    <p className="text-14 text-[var(--ink-soft)]">
      {children}
    </p>
  );
}

const STATE_ORDER = { expired: 0, failed: 1, expiring: 2, pending: 3 };

export default function CompliancePage() {
  const { data, error, reload } = useResource("compliance", getComplianceOverview);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [notice, setNotice] = useState(null);

  const checks = useMemo(() => [...(data?.checks || [])].sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9)), [data]);
  const emailable = (data?.notices || []).filter((n) => n.email);

  async function sendNotices() {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    setSendError(null);
    setNotice(null);
    try {
      const r = await sendPrivacyNoticesTo(ids);
      setNotice(`Sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ""}${r.skipped ? `, ${r.skipped} had no email` : ""}.`);
      setSelected(new Set());
      reload();
    } catch (err) {
      setSendError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Page>
      <PageHeader
        eyebrow="Compliance"
        title="Compliance"
        subtitle="Right-to-work and other checks, privacy notices and references that need attention. Record checks from each candidate's Compliance card."
      />
      {error && !data ? (
        <ErrorState body="Compliance couldn't be loaded." onRetry={reload} />
      ) : !data ? (
        <LoadingCard rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Checks needing attention", checks.length, checks.some((c) => c.state === "expired")],
              ["No right to work", data.missingRtw.length, data.missingRtw.some((m) => m.stage === "Placed")],
              ["Privacy notices due", data.notices.length, data.notices.some((n) => n.overdue)],
              ["References awaited", data.references.length, false],
            ].map(([label, n, alarm]) => (
              <div key={label} className="rounded-xl px-4 py-3 bg-white border border-[var(--border)]">
                <p className="text-12 font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
                  {label}
                </p>
                <p className={`text-xl font-semibold tabular-nums ${alarm ? "text-[var(--score-low)]" : "text-[var(--ink)]"}`}>
                  {n}
                </p>
              </div>
            ))}
          </div>

          <Card title="Right to work missing" eyebrow="At offer or placed">
            {data.missingRtw.length === 0 ? (
              <Empty>Everyone at offer or placed has a verified right-to-work check.</Empty>
            ) : (
              <ul className="divide-y">
                {data.missingRtw.map((m) => (
                  <li key={m.candidateId} className="py-2.5 flex flex-wrap items-center gap-2 text-14">
                    <Person id={m.candidateId} name={m.candidateName} />
                    <span className="text-[var(--ink-soft)]">{[m.jobTitle, m.client].filter(Boolean).join(" · ")}</span>
                    <Pill color={m.stage === "Placed" ? "var(--score-low)" : INK_MUTED} background={m.stage === "Placed" ? "var(--ui-danger-soft)" : undefined}>
                      {m.stage}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Checks">
            {checks.length === 0 ? (
              <Empty>Nothing expired, expiring in the next 30 days, or left to do.</Empty>
            ) : (
              <ul className="divide-y">
                {checks.map((c) => (
                  <li key={c.id} className="py-2.5 flex flex-wrap items-center gap-2 text-14">
                    <Person id={c.candidateId} name={c.candidateName} />
                    <span className="text-[var(--ink)]">{c.label || CHECK_KINDS[c.kind]}</span>
                    <CheckStatePill state={c.state} />
                    <span className="text-13 text-[var(--ink-soft)]">
                      {c.expiresOn ? `expires ${fmt(c.expiresOn)}` : ""}
                      {c.followUpOn ? ` · re-check by ${fmt(c.followUpOn)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Privacy notices due"
            eyebrow="People who didn't apply directly must be told within a month"
            action={
              emailable.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(selected.size ? new Set() : new Set(emailable.slice(0, 50).map((n) => n.candidateId)))}>
                    {selected.size ? "Clear" : emailable.length > 50 ? "Select 50" : "Select all"}
                  </Button>
                  <Button size="sm" variant="primary" disabled={busy || selected.size === 0} onClick={sendNotices}>
                    {busy ? "Sending…" : `Email notice${selected.size ? ` (${selected.size})` : ""}`}
                  </Button>
                </div>
              )
            }
          >
            <ErrorText>{sendError}</ErrorText>
            {notice && (
              <p className="text-13 mb-2 text-[var(--forest)]" role="status">
                {notice}
              </p>
            )}
            {data.notices.length === 0 ? (
              <Empty>Everyone has had your privacy notice or given consent.</Empty>
            ) : (
              <ul className="divide-y">
                {data.notices.map((n) => (
                  <li key={n.candidateId} className="py-2 flex flex-wrap items-center gap-2 text-14">
                    {/* Padded label: a 24px hit area around the 18px box. */}
                    <label className="inline-flex p-[3px] -m-[3px] cursor-pointer">
                      <input type="checkbox" aria-label={`Select ${n.candidateName}`} disabled={!n.email} checked={selected.has(n.candidateId)} onChange={() => toggle(n.candidateId)} />
                    </label>
                    <Person id={n.candidateId} name={n.candidateName} />
                    <span className={`text-13 ${n.overdue ? "text-[var(--score-low)]" : "text-[var(--ink-soft)]"}`}>
                      {n.overdue ? "Overdue" : "Due"} {fmt(n.dueOn)}
                    </span>
                    {!n.email && (
                      <span className="text-13 text-[var(--ink-faint)]">
                        no email on file
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="References awaited">
            {data.references.length === 0 ? (
              <Empty>No references outstanding.</Empty>
            ) : (
              <ul className="divide-y">
                {data.references.map((r) => (
                  <li key={r.id} className="py-2.5 flex flex-wrap items-center gap-2 text-14">
                    <Person id={r.candidateId} name={r.candidateName} />
                    <span className="text-[var(--ink-soft)]">
                      from {r.refereeName}
                      {r.refereeCompany ? `, ${r.refereeCompany}` : ""}
                    </span>
                    <span className={`text-13 ${r.expired ? "text-[var(--score-low)]" : "text-[var(--ink-faint)]"}`}>
                      {r.expired ? "link expired" : r.requestedAt ? `asked ${fmt(r.requestedAt)}` : "not sent yet"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
