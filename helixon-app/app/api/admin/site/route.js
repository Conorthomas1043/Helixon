import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin-audit";
import { adminJson as json, adminErrorResponse } from "@/lib/admin-http";
import { FEATURES, SETTING_KEYS, cleanSetting, getSiteSettings, saveSiteSetting } from "@/lib/site-settings";

// Site controls (/admin/site): maintenance mode, the announcement banner
// and feature switches. GET reads them uncached; PATCH { key, value }
// replaces one key and audits the before/after.

export async function GET() {
  try {
    const admin = await requireAdminSession();
    const { settings, meta, unavailable } = await getSiteSettings({ fresh: true, withMeta: true });
    return json({ ok: true, admin: { username: admin.username }, settings, meta, features: FEATURES, unavailable: Boolean(unavailable) });
  } catch (error) {
    return adminErrorResponse("site", error);
  }
}

export async function PATCH(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const body = await request.json().catch(() => null);
    const key = typeof body?.key === "string" ? body.key : "";
    if (!SETTING_KEYS.includes(key)) return json({ error: "Unknown setting." }, 400);

    const before = (await getSiteSettings({ fresh: true }))[key];
    const value = cleanSetting(key, body.value);

    try {
      await saveSiteSetting(key, value, admin.username);
    } catch (error) {
      if (error?.code === "42P01" || error?.code === "PGRST205") {
        return json({ error: "Site controls need the latest database migration (admin_controls)." }, 409);
      }
      throw error;
    }

    await writeAdminAudit({
      adminUsername: admin.username,
      action: `site_${key}_update`,
      targetType: "site_setting",
      targetId: key,
      metadata: { before, after: value },
      request,
    });

    return json({ ok: true, key, value });
  } catch (error) {
    return adminErrorResponse("site", error);
  }
}
