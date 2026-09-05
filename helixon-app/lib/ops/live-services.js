import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { getRedis } from "@/lib/redis";

const DAY_MS = 24 * 60 * 60 * 1000;

function monthlyAmount(price, quantity = 1) {
  const unit = Number(price?.unit_amount || 0) / 100;
  const interval = price?.recurring?.interval;
  const count = Number(price?.recurring?.interval_count || 1);

  switch (interval) {
    case "year":
      return (unit * quantity) / (12 * count);
    case "week":
      return (unit * quantity * 4.345) / count;
    case "day":
      return (unit * quantity * 30) / count;
    default:
      // month, or no recurring interval at all (one-off) - treat as monthly.
      return (unit * quantity) / count;
  }
}

/**
 * Real MRR and subscription breakdown, computed directly from Stripe's
 * price objects rather than the `subscriptions` table mirror (which only
 * ever gets `status` written to it by the webhook - no amount field, so
 * the old admin dashboard's "MRR" was always 0).
 */
export async function getStripeSnapshot() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { configured: false };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

  try {
    const byStatus = {};
    const byPlan = new Map();
    let mrr = 0;
    let currency = "gbp";
    let seen = 0;

    for await (const sub of stripe.subscriptions.list({
      status: "all",
      limit: 100,
      expand: ["data.items.data.price.product"],
    })) {
      seen += 1;
      if (seen > 1000) break; // sanity cap - this is a live dashboard call, not a batch job

      byStatus[sub.status] = (byStatus[sub.status] || 0) + 1;

      const isRevenue = sub.status === "active" || sub.status === "trialing";

      for (const item of sub.items?.data || []) {
        const price = item.price;
        if (!price) continue;

        currency = price.currency || currency;
        const planName = price.product?.name || price.nickname || price.id;
        byPlan.set(planName, (byPlan.get(planName) || 0) + 1);

        if (isRevenue) {
          mrr += monthlyAmount(price, item.quantity || 1);
        }
      }
    }

    return {
      configured: true,
      currency,
      mrr: Math.round(mrr * 100) / 100,
      totalSubscriptions: seen,
      byStatus,
      byPlan: [...byPlan.entries()]
        .map(([plan, count]) => ({ plan, count }))
        .sort((a, b) => b.count - a.count),
    };
  } catch (error) {
    console.error("[live-services] Stripe snapshot failed:", error.message);
    return { configured: true, error: "Failed to reach Stripe." };
  }
}

/**
 * Real identity data from Clerk - the actual source of truth for users
 * since the migration off Supabase Auth (see lib/customer-auth.js). The
 * admin Users page still reads supabase.auth.admin.listUsers(), which is
 * now a stale identity source; this is the live one.
 */
export async function getClerkSnapshot() {
  if (!process.env.CLERK_SECRET_KEY) {
    return { configured: false };
  }

  try {
    const client = await clerkClient();
    const [totalCount, recent] = await Promise.all([
      client.users.getCount(),
      client.users.getUserList({ limit: 100, orderBy: "-created_at" }),
    ]);

    const users = recent?.data || [];
    const now = Date.now();
    const newLast7d = users.filter((u) => now - u.createdAt < 7 * DAY_MS).length;
    const newLast30d = users.filter((u) => now - u.createdAt < 30 * DAY_MS).length;
    const banned = users.filter((u) => u.banned).length;
    const withVerifiedEmail = users.filter((u) =>
      u.emailAddresses?.some((e) => e.verification?.status === "verified"),
    ).length;

    return {
      configured: true,
      totalUsers: totalCount,
      newLast7d,
      newLast30d,
      bannedInSample: banned,
      verifiedEmailPctInSample: users.length
        ? Math.round((withVerifiedEmail / users.length) * 100)
        : null,
      sampleSize: users.length,
    };
  } catch (error) {
    console.error("[live-services] Clerk snapshot failed:", error.message);
    return { configured: true, error: "Failed to reach Clerk." };
  }
}

/** Connectivity + round-trip latency for the rate-limiting store. */
export async function getRedisSnapshot() {
  const redisPromise = getRedis();
  if (!redisPromise) {
    return { configured: false };
  }

  try {
    const redis = await redisPromise;
    const start = Date.now();
    await redis.ping();
    return { configured: true, connected: true, latencyMs: Date.now() - start };
  } catch (error) {
    console.error("[live-services] Redis snapshot failed:", error.message);
    return { configured: true, connected: false, error: "Failed to reach Redis." };
  }
}

/** Sending-domain verification status - the thing most likely to silently break deliverability. */
export async function getResendSnapshot() {
  if (!process.env.RESEND_API_KEY) {
    return { configured: false };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.domains.list();
    const domains = result?.data?.data || result?.data || [];

    return {
      configured: true,
      domains: domains.map((d) => ({ name: d.name, status: d.status })),
      allVerified: domains.length > 0 && domains.every((d) => d.status === "verified"),
    };
  } catch (error) {
    console.error("[live-services] Resend snapshot failed:", error.message);
    return { configured: true, error: "Failed to reach Resend." };
  }
}

/**
 * Recent error count from Sentry, parsed straight out of the DSN already
 * committed in sentry.server.config.js (org/project IDs are not secret -
 * they're in the public DSN). Needs SENTRY_AUTH_TOKEN to actually call the
 * API; without one this just reports itself as not configured rather than
 * failing.
 */
export async function getSentrySnapshot() {
  const dsn = "https://1fa4e4a3f6cc154682501e16738d3cfb@o4511588978130944.ingest.de.sentry.io/4511588993073232";
  const token = process.env.SENTRY_AUTH_TOKEN;

  if (!token) {
    return { configured: false };
  }

  const orgId = dsn.match(/@o(\d+)\./)?.[1];
  const projectId = dsn.match(/\/(\d+)$/)?.[1];

  if (!orgId || !projectId) {
    return { configured: false };
  }

  try {
    const response = await fetch(
      `https://sentry.io/api/0/organizations/${orgId}/issues/?project=${projectId}&statsPeriod=24h&query=is:unresolved`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error(`Sentry API returned HTTP ${response.status}`);
    }

    const issues = await response.json();

    return {
      configured: true,
      unresolvedLast24h: Array.isArray(issues) ? issues.length : null,
      topIssues: (Array.isArray(issues) ? issues : []).slice(0, 5).map((i) => ({
        title: i.title,
        count: Number(i.count || 0),
        level: i.level,
      })),
    };
  } catch (error) {
    console.error("[live-services] Sentry snapshot failed:", error.message);
    return { configured: true, error: "Failed to reach Sentry." };
  }
}

/** Everything above, fetched in parallel and tolerant of individual failures. */
export async function getServicesSnapshot() {
  const [stripe, clerk, redis, resend, sentry] = await Promise.all([
    getStripeSnapshot(),
    getClerkSnapshot(),
    getRedisSnapshot(),
    getResendSnapshot(),
    getSentrySnapshot(),
  ]);

  return { stripe, clerk, redis, resend, sentry };
}
