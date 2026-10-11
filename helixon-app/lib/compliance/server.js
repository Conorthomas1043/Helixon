// Server helpers shared by the compliance routes (app/api/candidates/[id]/
// compliance, references, privacy-notice).

import "server-only";
import { supabase } from "@/lib/supabase";
import { cleanUuid } from "@/lib/sanitize";

export async function loadCandidate(agencyId, rawId, columns = "id") {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await supabase.from("candidates").select(columns).eq("id", id).eq("agency_id", agencyId).maybeSingle();
  return data;
}

// A check's fields from JSON, or from multipart form fields plus an
// optional `document` file. { body, file }.
export async function readCheckBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const body = {};
    for (const [k, v] of form.entries()) if (typeof v === "string") body[k] = v;
    const file = form.get("document");
    return { body, file: file && typeof file === "object" && file.size > 0 ? file : null };
  }
  return { body: await request.json().catch(() => ({})), file: null };
}
