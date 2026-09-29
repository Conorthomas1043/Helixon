// app/api/site/route.js
// The public slice of the admin's site settings (lib/site-settings.js):
// the announcement banner, the maintenance message and whether the chat
// assistant is on. Read by components/SiteAnnouncement.jsx, the chat
// widget and /under-development. Cached briefly at the edge.

import { getSiteSettings, publicSiteSettings } from "@/lib/site-settings";

export async function GET() {
  const settings = await getSiteSettings();
  return Response.json(
    { ok: true, ...publicSiteSettings(settings) },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
