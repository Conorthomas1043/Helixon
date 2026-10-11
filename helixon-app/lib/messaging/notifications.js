// In-app notifications (the bell in the nav; table from migration
// 20261003010000). notify() never throws - a notification failing to save
// mustn't break whatever it's telling someone about.

import "server-only";
import { supabase } from "@/lib/supabase";

// userId: who it's for (a Clerk user id), or null for everyone in the agency.
export async function notify({ agencyId, userId = null, kind, title, body = null, href = null }) {
  if (!agencyId || !kind || !title) return;
  try {
    const { error } = await supabase.from("notifications").insert({
      agency_id: agencyId,
      user_id: userId || null,
      kind: String(kind).slice(0, 60),
      title: String(title).slice(0, 300),
      body: body ? String(body).slice(0, 1000) : null,
      href: href && href.startsWith("/") ? href.slice(0, 500) : null,
    });
    if (error) console.warn("[notifications] Not saved:", error.message);
  } catch (err) {
    console.warn("[notifications] Not saved:", err.message);
  }
}

export function toNotification(row) {
  return { id: row.id, kind: row.kind, title: row.title, body: row.body, href: row.href, read: Boolean(row.read_at), createdAt: row.created_at, forEveryone: !row.user_id };
}
