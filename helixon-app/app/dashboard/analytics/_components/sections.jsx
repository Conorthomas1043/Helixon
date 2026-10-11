"use client";

// Part of the analytics page (../page.jsx): timing, outreach, advertising,
// money, retention, feedback and pipeline rows.

import { STAGE_LABELS } from "@/lib/candidates/stage-labels";
import { INK, INK_MUTED, INK_FAINT } from "@/lib/candidates/format";
import { MUTED_BAR, StatCard } from "./charts";

// "Time to fill"/"time to hire" and time-in-stage answer questions the
// rest of this page can't: not just how many candidates convert, but how
// long that actually takes, and where along the way. Median (not mean) -
// see app/api/analytics/timing's own comment on why.
export function TimingRow({ timing }) {
  const fmtDays = (d) => (d === null || d === undefined ? "—" : `${d}d`);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard
        label="Time to fill"
        value={fmtDays(timing?.timeToFillDays)}
        sub={timing?.timeToFillSampleSize ? `median · ${timing.timeToFillSampleSize} role${timing.timeToFillSampleSize === 1 ? "" : "s"} filled` : "no placements yet"}
      />
      <StatCard
        label="Time to hire"
        value={fmtDays(timing?.timeToHireDays)}
        sub={timing?.timeToHireSampleSize ? `median · ${timing.timeToHireSampleSize} placement${timing.timeToHireSampleSize === 1 ? "" : "s"}` : "no placements yet"}
      />
      <StatCard
        label="Offer acceptance"
        value={timing?.offerAcceptance?.rate === null || timing?.offerAcceptance?.rate === undefined ? "—" : `${timing.offerAcceptance.rate}%`}
        sub={
          timing?.offerAcceptance
            ? `${timing.offerAcceptance.accepted} accepted, ${timing.offerAcceptance.declined} declined${timing.offerAcceptance.pending ? `, ${timing.offerAcceptance.pending} pending` : ""}`
            : undefined
        }
      />
    </div>
  );
}

export function TimeInStage({ timeInStage }) {
  const withData = (timeInStage || []).filter((s) => s.count > 0);
  if (withData.length === 0) {
    return (
      <p className="text-[14px]" style={{ color: INK_MUTED }}>
        Fills in as candidates move through stages - this reads real stage-change history, not just current position.
      </p>
    );
  }
  const max = Math.max(1, ...withData.map((s) => s.medianDays || 0));
  return (
    <div className="space-y-2.5">
      {withData.map((s) => (
        <div key={s.key} className="flex items-center gap-3">
          <span className="text-[12px] w-20 shrink-0 truncate" style={{ color: INK_MUTED }}>
            {s.label}
          </span>
          <div className="flex-1 h-6 rounded-[6px] overflow-hidden" style={{ background: "var(--mist)" }}>
            <div
              className="h-full rounded-[6px] flex items-center justify-end px-2"
              style={{ width: `${Math.max(4, Math.round(((s.medianDays || 0) / max) * 100))}%`, background: MUTED_BAR }}
            >
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: INK }}>{s.medianDays}d</span>
            </div>
          </div>
          <span className="text-[12px] w-20 text-right shrink-0" style={{ color: INK_FAINT }}>
            {s.count} sample{s.count === 1 ? "" : "s"}
          </span>
        </div>
      ))}
    </div>
  );
}

// Reusable "label · count (rate%)" bar list - source of hire, rejection
// reasons, both shaped the same way by app/api/analytics/timing.
export function RankedList({ items, emptyLabel, rateLabel }) {
  if (!items || items.length === 0) {
    return (
      <p className="text-[14px]" style={{ color: INK_MUTED }}>
        {emptyLabel}
      </p>
    );
  }
  const max = Math.max(1, ...items.map((i) => i.count ?? i.total ?? 0));
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const value = item.count ?? item.total ?? 0;
        const pct = Math.max(4, Math.round((value / max) * 100));
        return (
          <div key={item.key} className="flex items-center gap-3">
            <span className="text-[13px] w-32 shrink-0 truncate" style={{ color: INK_MUTED }}>
              {item.label}
            </span>
            <div className="flex-1 h-6 rounded-[6px] overflow-hidden" style={{ background: "var(--mist)" }}>
              <div
                className="h-full rounded-[6px] flex items-center justify-end px-2"
                style={{ width: `${pct}%`, background: MUTED_BAR }}
              >
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: INK }}>{value}</span>
              </div>
            </div>
            {rateLabel && item.placementRate !== null && item.placementRate !== undefined && (
              <span className="text-[12px] w-24 text-right shrink-0" style={{ color: INK_FAINT }}>
                {item.placementRate}% {rateLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OutreachRow({ outreach }) {
  if (!outreach || outreach.total === 0) {
    return (
      <p className="text-[14px]" style={{ color: INK_MUTED }}>
        No outreach logged yet - use &quot;Log a call/email/meeting&quot; on a candidate&apos;s profile.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {outreach.byType.map((t) => (
        <StatCard key={t.key} label={t.label} value={t.count} />
      ))}
    </div>
  );
}

export function AdvertisingTable({ advertising }) {
  if (!advertising || advertising.length === 0) {
    return (
      <p className="text-[14px]" style={{ color: INK_MUTED }}>
        Log clicks/spend per channel on a job&apos;s page to see apply rate and cost per applicant here.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ color: INK_FAINT }}>
            <th className="text-left font-semibold pb-2">Channel</th>
            <th className="text-right font-semibold pb-2">Clicks</th>
            <th className="text-right font-semibold pb-2">Spend</th>
            <th className="text-right font-semibold pb-2">Applicants</th>
            <th className="text-right font-semibold pb-2">Apply rate</th>
            <th className="text-right font-semibold pb-2">Cost/applicant</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {advertising.map((row) => (
            <tr key={row.key}>
              <td className="py-2 font-medium" style={{ color: INK }}>{row.label}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>{row.clicks}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>{row.spend == null ? "—" : `£${row.spend.toLocaleString()}`}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>{row.applicants}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>{row.applyRate !== null ? `${row.applyRate}%` : "—"}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>{row.costPerApplicant !== null ? `£${row.costPerApplicant.toLocaleString()}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinancialRow({ financial }) {
  const fmt = (n) => (n === null || n === undefined ? "—" : `£${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Fee income" value={fmt(financial.totalFee)} sub={`${financial.placementsWithFee} placement${financial.placementsWithFee === 1 ? "" : "s"} reported`} />
        <StatCard label="Cost attributed" value={fmt(financial.totalCost)} />
        <StatCard label="Margin" value={fmt(financial.margin)} sub={financial.margin === null ? "no cost entries yet" : undefined} />
        <StatCard label="Avg fee / placement" value={fmt(financial.avgFee)} />
      </div>
      {financial.byRecruiter.length > 0 && (
        <ul className="divide-y">
          {financial.byRecruiter.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-3 py-2">
              <span className="text-[14px] font-medium" style={{ color: INK }}>{r.name}</span>
              <span className="text-[13px]" style={{ color: INK_MUTED }}>
                <strong style={{ color: "var(--forest)", fontFamily: "var(--font-mono)" }}>{fmt(r.total)}</strong> · {r.placements} placement{r.placements === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] mt-3" style={{ color: INK_FAINT }}>
        Self-reported, entered per placement on the candidate&apos;s profile - Helixon has no independent way to verify these.
      </p>
    </>
  );
}

export function RetentionAndReuse({ retention, reuse }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="30-day retention"
        value={retention.thirtyDay.rate === null ? "—" : `${retention.thirtyDay.rate}%`}
        sub={retention.thirtyDay.rate === null ? "no check-ins yet" : `${retention.thirtyDay.retained} retained, ${retention.thirtyDay.left} left`}
      />
      <StatCard
        label="90-day retention"
        value={retention.ninetyDay.rate === null ? "—" : `${retention.ninetyDay.rate}%`}
        sub={retention.ninetyDay.rate === null ? "no check-ins yet" : `${retention.ninetyDay.retained} retained, ${retention.ninetyDay.left} left`}
      />
      <StatCard
        label="Candidate reuse"
        value={reuse.rate === null ? "—" : `${reuse.rate}%`}
        sub={reuse.totalPeople ? `${reuse.reused} of ${reuse.totalPeople} submitted to 2+ roles` : "matched by email"}
      />
    </div>
  );
}

export function FeedbackRow({ feedback }) {
  const nps = feedback.candidateNps;
  const client = feedback.clientSatisfaction;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <StatCard
          label="Candidate NPS"
          value={nps.score === null ? "—" : nps.score}
          sub={nps.responses ? `${nps.responses} response${nps.responses === 1 ? "" : "s"} · ${nps.promoters} promoters, ${nps.detractors} detractors` : "no responses yet"}
        />
      </div>
      <div>
        <StatCard
          label="Client satisfaction"
          value={client.avgRating === null ? "—" : `${client.avgRating}/5`}
          sub={client.responses ? `${client.responses} response${client.responses === 1 ? "" : "s"}` : "no responses yet"}
        />
      </div>
    </div>
  );
}

export function PipelineBar({ pipeline }) {
  const stages = Object.keys(STAGE_LABELS);
  const max = Math.max(1, ...stages.map((k) => pipeline.stageCounts[k] ?? 0));
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {stages.map((key) => {
        const count = pipeline.stageCounts[key] ?? 0;
        const heightPct = Math.max(6, Math.round((count / max) * 100));
        const isPlaced = key === "Placed";
        return (
          <div key={key} className="flex flex-col items-center">
            <span className="text-base font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: INK }}>
              {count}
            </span>
            <div className="w-full rounded-full mt-2 mb-2 flex items-end" style={{ height: 36, background: "var(--mist)" }}>
              <div className="w-full rounded-full" style={{ height: `${heightPct}%`, background: isPlaced ? "var(--forest)" : MUTED_BAR }} />
            </div>
            <span className="text-[12px] font-semibold uppercase tracking-wide text-center leading-tight" style={{ color: INK_MUTED }}>
              {STAGE_LABELS[key]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
