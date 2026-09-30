// lib/candidate-files.js
// Original CV files, kept so recruiters can preview, download and send the
// real document - the analysis only ever kept the extracted text before,
// and threw the file away.
//
// Stored in the private "cvs" Supabase Storage bucket (no public access
// and no storage RLS policies: only this server, via the service-role
// client, can read or write it). Access goes through
// app/api/candidates/[id]/cv, which checks the candidate belongs to the
// caller's agency and then hands out a signed URL valid for one minute.
//
// Path: <agency_id>/<candidate_id>/<random>.<ext> - scoped per agency and
// candidate, and deliberately without the original filename, which is
// often the candidate's name (keeps PII out of storage paths and logs).
// The display name lives in candidates.cv_filename; the storage path in
// candidates.cv_file_url (an existing, previously unused column - it holds
// a bucket path, not a URL).
import { supabase } from "@/lib/supabase";

const BUCKET = "cvs";
const SIGNED_URL_TTL_SECONDS = 60;

const MIME_BY_EXT = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function extensionOf(name = "") {
  const ext = name.toLowerCase().split(".").pop();
  return MIME_BY_EXT[ext] ? ext : null;
}

export function cvMimeType(fileName = "") {
  return MIME_BY_EXT[extensionOf(fileName)] || "application/octet-stream";
}

// Uploads the CV and returns { path, fileName }. Throws on failure - the
// caller decides whether that blocks anything (in /api/run it doesn't: the
// analysis is still worth saving without the file).
//
// format is what the file's bytes say it is (lib/document/fileSignature.js).
// When given it decides the stored extension and content type, so a file
// only named ".pdf" is never served back to recruiters as a PDF.
export async function storeCandidateCv({ agencyId, candidateId, file, format = null }) {
  const fileName = String(file?.name || "cv").slice(0, 200);
  const ext = MIME_BY_EXT[format] ? format : extensionOf(fileName) || (file?.type === MIME_BY_EXT.pdf ? "pdf" : "docx");
  const path = `${agencyId}/${candidateId}/${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: MIME_BY_EXT[ext],
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return { path, fileName };
}

// One-minute signed URL. download=true makes the browser save it under the
// original filename; otherwise it opens inline (PDFs preview in the tab).
export async function candidateCvUrl({ path, fileName, download = false }) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, download ? { download: fileName || true } : undefined);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// Best-effort removal - returns the error (or null) rather than throwing,
// so a storage hiccup is logged by the caller without blocking a database
// erasure that has already happened.
export async function removeCandidateCvs(paths = []) {
  const clean = paths.filter((p) => typeof p === "string" && p && !/^https?:/i.test(p));
  // Storage removes at most 1,000 objects per call.
  for (let i = 0; i < clean.length; i += 1000) {
    const { error } = await supabase.storage.from(BUCKET).remove(clean.slice(i, i + 1000));
    if (error) return error;
  }
  return null;
}

// Copies a stored CV to a new candidate row (screening someone already on
// file against another job). Each row gets its own copy so erasing one
// never removes the file another still points at. Returns { path } or
// throws.
export async function copyCandidateCv({ agencyId, candidateId, fromPath }) {
  const ext = String(fromPath || "").split(".").pop();
  const path = `${agencyId}/${candidateId}/${crypto.randomUUID()}.${MIME_BY_EXT[ext] ? ext : "pdf"}`;
  const { error } = await supabase.storage.from(BUCKET).copy(fromPath, path);
  if (error) throw new Error(error.message);
  return { path };
}
