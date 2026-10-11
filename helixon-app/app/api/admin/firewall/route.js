import { BlockList, isIP } from "node:net";
import { requireAdminSession } from "@/lib/admin/auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin/csrf";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin/audit";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin/http";
import { getClientIp } from "@/lib/ratelimit";
import { cleanLine, cleanUuid } from "@/lib/sanitize";
import { getFirewallPolicy } from "@/lib/security/firewall";
import { RULE_KINDS, clearFirewallRulesCache, isCountryCode, parseCidr, ruleProblem } from "@/lib/security/rules";
import { alertRecipients, cleanSetting, getSiteSettings, saveSiteSetting } from "@/lib/ops/site-settings";
import { fields, id, nested, num, text } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const RuleInput = fields({ kind: text(40), value: text(400), note: text(400), hours: num });
const RuleRemoveInput = fields({ id });
// cleanSetting (lib/ops/site-settings.js) checks both in full.
const FirewallSettingsInput = fields({ alerts: nested, policy: nested });

// The Security page's controls beyond single IP blocks:
//   GET                          rules, the policy in force, the admin's own IP
//   POST   { kind, value, note, hours }   add an allow-list IP, or block a country,
//                                         an IP range (CIDR), a path prefix or a
//                                         user-agent fragment
//   DELETE { id }                         remove a rule
//   PATCH  { policy }                     thresholds / auto-block / alert emails on-off
//   PATCH  { alerts }                     who gets alert emails (firewall + daily health)
// Every change is audited. Rules reach every server within ~30 seconds
// (lib/security/rules.js caches them).


export async function GET(request) {
  try {
    await requireAdminSession();
    const supabase = getAdminSupabase();
    const [{ data, error }, settings] = await Promise.all([
      supabase.from("firewall_rules").select("id,kind,value,note,expires_at,created_by,created_at").order("created_at", { ascending: false }),
      getSiteSettings({ fresh: true }),
    ]);
    if (error) return adminDbError("firewall", error);
    const now = Date.now();
    return json({
      ok: true,
      rules: (data || []).map((r) => ({ ...r, expired: Boolean(r.expires_at) && new Date(r.expires_at).getTime() <= now })),
      policy: getFirewallPolicy(settings.firewall, alertRecipients(settings)),
      alerts: { ...settings.alerts, effective: alertRecipients(settings), envFallback: !settings.alerts?.recipients?.length && Boolean(process.env.SECURITY_ALERT_EMAIL) },
      myIp: getClientIp(request),
    });
  } catch (error) {
    return adminErrorResponse("firewall", error);
  }
}

export async function POST(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const parsedBody = await parseBody(request, RuleInput, { allowEmpty: true });
    if (parsedBody.response) return parsedBody.response;
    const body = parsedBody.body;

    const kind = RULE_KINDS.includes(body.kind) ? body.kind : null;
    if (!kind) return json({ error: "Unknown rule type." }, 400);

    let value = String(body.value || "").trim();
    if (kind === "allow_ip" && isIP(value) === 0) return json({ error: "Enter a valid IP address." }, 400);
    if (kind === "block_country") {
      if (!isCountryCode(value)) return json({ error: "Use a two-letter country code, like GB or US." }, 400);
      value = value.toUpperCase();
      // Blocking your own country is the fastest way to lock yourself out.
      const myCountry = String(request.headers.get("x-vercel-ip-country") || "").toUpperCase();
      if (myCountry && myCountry === value) {
        return json({ error: `You're connecting from ${value}. Add your IP to the allow list first, then block the country.` }, 400);
      }
    }

    const problem = ruleProblem(kind, value);
    if (problem) return json({ error: problem }, 400);
    if (kind === "block_ua") value = value.toLowerCase();
    if (kind === "block_cidr") {
      // Blocking a range you're in would lock you out of this console.
      const cidr = parseCidr(value);
      const mine = getClientIp(request);
      const family = isIP(mine);
      if (family === cidr.family) {
        const list = new BlockList();
        list.addSubnet(cidr.address, cidr.prefix, family === 4 ? "ipv4" : "ipv6");
        if (list.check(mine, family === 4 ? "ipv4" : "ipv6")) {
          return json({ error: `That range includes your own IP (${mine}). Allow-list your IP first if you really mean it.` }, 400);
        }
      }
    }

    const hours = Number(body.hours);
    const expiresAt = Number.isFinite(hours) && hours > 0 ? new Date(Date.now() + Math.min(hours, 24 * 365) * 3600e3).toISOString() : null;
    const note = cleanLine(body.note, 200) || null;

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("firewall_rules")
      .upsert({ kind, value, note, expires_at: expiresAt, created_by: admin.username, created_at: new Date().toISOString() }, { onConflict: "kind,value" })
      .select("id,kind,value,note,expires_at,created_by,created_at")
      .single();
    if (error) return adminDbError("firewall", error);
    clearFirewallRulesCache();

    await writeAdminAudit({
      adminUsername: admin.username,
      action: { allow_ip: "firewall_allow_ip", block_country: "firewall_block_country", block_path: "firewall_block_path", block_ua: "firewall_block_ua", block_cidr: "firewall_block_cidr" }[kind],
      targetType: "firewall_rule",
      targetId: data.id,
      metadata: { value, note, expiresAt },
      request,
    });
    return json({ ok: true, rule: data });
  } catch (error) {
    return adminErrorResponse("firewall", error);
  }
}

export async function DELETE(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const parsedBody = await parseBody(request, RuleRemoveInput, { allowEmpty: true });
    if (parsedBody.response) return parsedBody.response;
    const body = parsedBody.body;
    const id = cleanUuid(body.id);
    if (!id) return json({ error: "A valid rule id is required." }, 400);

    const supabase = getAdminSupabase();
    const { data, error } = await supabase.from("firewall_rules").delete().eq("id", id).select("kind,value").maybeSingle();
    if (error) return adminDbError("firewall", error);
    if (!data) return json({ error: "Rule not found." }, 404);
    clearFirewallRulesCache();

    await writeAdminAudit({
      adminUsername: admin.username,
      action: "firewall_rule_removed",
      targetType: "firewall_rule",
      targetId: id,
      metadata: { kind: data.kind, value: data.value },
      request,
    });
    return json({ ok: true });
  } catch (error) {
    return adminErrorResponse("firewall", error);
  }
}

export async function PATCH(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const parsedBody = await parseBody(request, FirewallSettingsInput, { allowEmpty: true });
    if (parsedBody.response) return parsedBody.response;
    const body = parsedBody.body;
    const current = await getSiteSettings({ fresh: true });
    if (body.alerts) {
      const alerts = cleanSetting("alerts", { ...current.alerts, ...body.alerts });
      await saveSiteSetting("alerts", alerts, admin.username);
      await writeAdminAudit({
        adminUsername: admin.username,
        action: "alert_recipients_update",
        targetType: "site_setting",
        targetId: "alerts",
        metadata: { before: current.alerts, after: alerts },
        request,
      });
      return json({ ok: true, alerts });
    }

    const before = current.firewall;
    const value = cleanSetting("firewall", { ...before, ...(body.policy || {}) });

    await saveSiteSetting("firewall", value, admin.username);

    await writeAdminAudit({
      adminUsername: admin.username,
      action: "firewall_policy_update",
      targetType: "site_setting",
      targetId: "firewall",
      metadata: { before, after: value },
      request,
    });
    return json({ ok: true, policy: getFirewallPolicy(value) });
  } catch (error) {
    return adminErrorResponse("firewall", error);
  }
}
