// Marks a logged request with the status the app actually answered, for
// the cases the edge can't see: a page that doesn't exist (404, from
// app/not-found.js) and a server error (500, from instrumentation.js's
// onRequestError). proxy.ts passes the log line's id to the app in the
// x-helixon-log-uid request header. Best effort; never throws.

import "server-only";
import { supabase } from "@/lib/supabase";

export const LOG_UID_HEADER = "x-helixon-log-uid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markRequestStatus(uid, status) {
  if (!UUID.test(String(uid || "")) || ![404, 500].includes(status)) return;
  try {
    // Only a line logged moments ago that the edge hadn't already decided.
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from("request_logs")
        .update({ status_code: status })
        .eq("uid", uid)
        .gte("ts", since)
        .or(status === 500 ? "status_code.is.null,status_code.lt.500" : "status_code.is.null")
        .select("id");
      // The line is written just after the response starts; wait a moment if it isn't there yet.
      if (error || data?.length) return;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  } catch {
    // nothing to do
  }
}
