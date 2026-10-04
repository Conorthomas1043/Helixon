// Copies of compliance documents (a passport scan, a DBS certificate) in
// the private "cvs" bucket - see lib/candidate-files.js for how the bucket
// is locked down. Path: <agency>/<candidate>/compliance/<random>.<ext>,
// without the original filename (which is kept in compliance_checks).

import "server-only";
import { supabase } from "@/lib/supabase";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, documentExtension } from "@/lib/compliance";

const BUCKET = "cvs";

// { path, name, mime } or { error }.
export async function storeComplianceDocument({ agencyId, candidateId, file }) {
  if (!file || typeof file.arrayBuffer !== "function") return { error: "No file." };
  if (file.size > MAX_DOCUMENT_BYTES) return { error: "Documents can be up to 10MB." };
  const ext = documentExtension(file.name, file.type);
  if (!ext) return { error: "Upload a PDF, JPG or PNG." };
  const path = `${agencyId}/${candidateId}/compliance/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: DOCUMENT_TYPES[ext], upsert: false });
  if (error) {
    console.error("[compliance-files] Upload failed:", error.message);
    return { error: "The document couldn't be uploaded." };
  }
  return { path, name: String(file.name || "Document").slice(0, 200), mime: DOCUMENT_TYPES[ext] };
}

export async function complianceDocumentUrl(path, name) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60, { download: name || true });
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function removeComplianceDocuments(paths = []) {
  const clean = paths.filter((p) => typeof p === "string" && p.includes("/compliance/"));
  for (let i = 0; i < clean.length; i += 1000) {
    const { error } = await supabase.storage.from(BUCKET).remove(clean.slice(i, i + 1000));
    if (error) return error;
  }
  return null;
}
