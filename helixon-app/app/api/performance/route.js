import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { canManageWorkspace } from "@/lib/workspace-admin";
import { aggregate, commissionFor, emptyMetrics, normalisePerformance, periodRange, placementInPeriod, scaleTargets } from "@/lib/performance";
import { getAccess } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// GET ?period=this_month|last_month|this_quarter|... - each recruiter's
// activity and revenue for the period against their targets
// (lib/performance.js), plus the team's. Commission figures are shown to
// the owner/admins for everyone, and to each recruiter for themselves.

const LIMIT = 20000;

// Tables from later migrations may not exist yet: count nothing for them.
// `fallback` is the same query without newer columns, tried before giving up.
async function rows(query, fallback) {
  let { data, error } = await query;
  if (error && fallback) ({ data, error } = await fallback());
  if (error) {
    console.warn("[performance] Query skipped:", error.message);
    return [];
  }
  return data ?? [];
}

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
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
      .or(`and(offer_date.gte.${period.from},offer_date.lt.${period.to}),and(offer_date.is.null,created_at.gte.${fromTs},created_at.lt.${toTs})`)
      .limit(LIMIT);
  const invoiceQuery = (cols) =>
    db.from("invoices").select(cols).eq("agency_id", agencyId).eq("status", "paid").gte("paid_on", period.from).lt("paid_on", period.to).limit(LIMIT);

  const [{ data: agency }, members, candidates, activity, interviews, placements, invoices, canManage] = await Promise.all([
    supabase.from("agencies").select("settings").eq("id", agencyId).maybeSingle(),
    rows(supabase.from("profiles").select("clerk_user_id, first_name, last_name, username").eq("agency_id", agencyId)),
    rows(db.from("candidates").select("recruiter_id").eq("agency_id", agencyId).is("pooled_from_id", null).gte("created_at", fromTs).lt("created_at", toTs).limit(LIMIT)),
    rows(
      supabase
        .from("candidate_activity")
        .select("type, actor, candidates!inner(agency_id)")
        .eq("candidates.agency_id", agencyId)
        .in("type", ["call_logged", "cv_sent_logged"])
        .gte("created_at", fromTs)
        .lt("created_at", toTs)
        .limit(LIMIT)
    ),
    rows(db.from("interviews").select("created_by").eq("agency_id", agencyId).gte("created_at", fromTs).lt("created_at", toTs).limit(LIMIT)),
    // splits (shared placements) came later - without the column, every
    // placement is credited to its one recruiter.
    rows(placementQuery("recruiter_id, splits, status, kind, fee_amount, offer_date, created_at"), () =>
      placementQuery("recruiter_id, status, kind, fee_amount, offer_date, created_at")
    ),
    rows(invoiceQuery("total, vat_amount, placements(recruiter_id, splits)"), () => invoiceQuery("total, vat_amount, placements(recruiter_id)")),
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

  // Money admin-only (lib/permissions.js): members see activity, not fees,
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
}
