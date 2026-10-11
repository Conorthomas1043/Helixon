import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { recruiterDisplayName } from "@/lib/agency/recruiter-directory";
import { canManageWorkspace } from "@/lib/agency/workspace-admin";
import { aggregate, commissionFor, emptyMetrics, normalisePerformance, periodRange, placementInPeriod, scaleTargets } from "@/lib/analytics/performance";
import { getAccess } from "@/lib/agency/permissions";
import { agencyDb } from "@/lib/agency-db";
import { fetchAll } from "@/lib/fetch-all";

// GET ?period=this_month|last_month|this_quarter|... - each recruiter's
// activity and revenue for the period against their targets
// (lib/analytics/performance.js), plus the team's. Commission figures are shown to
// the owner/admins for everyone, and to each recruiter for themselves.

const LIMIT = 20000;

// Every matching row, a page at a time (one select stops at 1,000 rows,
// which undercounted commission and targets). `page(from, to)` builds the
// query. Tables from later migrations may not exist yet: count nothing for
// them. `fallback` is the same query without newer columns, tried before
// giving up.
async function rows(page, fallback) {
  let { data, error } = await fetchAll(page, { cap: LIMIT });
  if (error && fallback) ({ data, error } = await fetchAll(fallback, { cap: LIMIT }));
  if (error) {
    console.warn("[performance] Query skipped:", error.message);
    return [];
  }
  return data ?? [];
}

export const GET = customerRoute(async (request, _context, auth) => {
  const db = await agencyDb();
  const agencyId = auth.agencyId;
  const period = periodRange(new URL(request.url).searchParams.get("period"));
  const fromTs = `${period.from}T00:00:00Z`;
  const toTs = `${period.to}T00:00:00Z`;
  const placementQuery = (cols) =>
    db
      .from("placements")
      .select(cols)
      .eq("agency_id", agencyId)
      .or(`and(offer_date.gte.${period.from},offer_date.lt.${period.to}),and(offer_date.is.null,created_at.gte.${fromTs},created_at.lt.${toTs})`);
  const invoiceQuery = (cols) =>
    db.from("invoices").select(cols).eq("agency_id", agencyId).eq("status", "paid").gte("paid_on", period.from).lt("paid_on", period.to);
  const paged = (build) => (from, to) => build().order("id").range(from, to);

  const [{ data: agency }, members, candidates, activity, interviews, placements, invoices, canManage] = await Promise.all([
    supabase.from("agencies").select("settings").eq("id", agencyId).maybeSingle(),
    rows(paged(() => supabase.from("profiles").select("id, clerk_user_id, first_name, last_name, username").eq("agency_id", agencyId))),
    rows(paged(() => db.from("candidates").select("id, recruiter_id").eq("agency_id", agencyId).is("pooled_from_id", null).gte("created_at", fromTs).lt("created_at", toTs))),
    rows(
      paged(() =>
        supabase
          .from("candidate_activity")
          .select("id, type, actor, candidates!inner(agency_id)")
          .eq("candidates.agency_id", agencyId)
          .in("type", ["call_logged", "cv_sent_logged"])
          .gte("created_at", fromTs)
          .lt("created_at", toTs)
      )
    ),
    rows(paged(() => db.from("interviews").select("id, created_by").eq("agency_id", agencyId).gte("created_at", fromTs).lt("created_at", toTs))),
    // splits (shared placements) came later - without the column, every
    // placement is credited to its one recruiter.
    rows(paged(() => placementQuery("id, recruiter_id, splits, status, kind, fee_amount, offer_date, created_at")), paged(() =>
      placementQuery("id, recruiter_id, status, kind, fee_amount, offer_date, created_at")
    )),
    rows(paged(() => invoiceQuery("id, total, vat_amount, placements(recruiter_id, splits)")), paged(() => invoiceQuery("id, total, vat_amount, placements(recruiter_id)"))),
    canManageWorkspace(auth),
  ]);

  const settings = normalisePerformance(agency?.settings);
  const people = members.map((m) => ({ id: m.clerk_user_id, name: recruiterDisplayName(m) || "Teammate" }));
  const nameToId = new Map(people.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const byPerson = aggregate(
    {
      candidates,
      activity,
      interviews,
      placements: placements.map((p) => ({ ...p, ...placementInPeriod(p, period.from, period.to) })),
      invoices: invoices.map((i) => ({ ...i, recruiter_id: i.placements?.recruiter_id ?? null, splits: i.placements?.splits ?? null })),
    },
    nameToId
  );

  const plan = settings.commission;
  const team = emptyMetrics();
  const result = people.map((p) => {
    const metrics = byPerson.get(p.id) || emptyMetrics();
    for (const k of Object.keys(team)) team[k] = Math.round((team[k] + metrics[k]) * 100) / 100;
    const showCommission = canManage || p.id === auth.userId;
    return {
      ...p,
      me: p.id === auth.userId,
      metrics,
      targets: scaleTargets(settings.targets.people[p.id] || {}, period.months),
      commission: showCommission ? commissionFor(plan, metrics[plan.basis], { months: period.months, userId: p.id }) : undefined,
    };
  });

  // Money admin-only (lib/agency/permissions.js): members see activity, not fees,
  // cash or commission.
  const { canSeeFinancials } = await getAccess(auth);
  if (!canSeeFinancials) {
    const strip = (o) => (o ? { ...o, fees: null, cash: null } : o);
    for (const r of result) {
      r.metrics = strip(r.metrics);
      r.targets = strip(r.targets);
      r.commission = undefined;
    }
    team.fees = null;
    team.cash = null;
  }
  return NextResponse.json({
    period,
    financialsHidden: !canSeeFinancials,
    people: result,
    team: { metrics: team, targets: scaleTargets(settings.targets.team, period.months) },
    commission: plan.enabled ? { basis: plan.basis } : null,
    canManage,
  });
});
