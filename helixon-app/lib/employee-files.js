// lib/employee-files.js
// A shared filing system for the whole team: folders and files, stored in
// the private "employee-files" Supabase Storage bucket with metadata in
// employee_folders/employee_files. Every active employee can browse and
// download everything and can create folders/upload files, but only the
// person who created a folder or uploaded a file can delete it - same
// creator-owns-it model as shared todos/goals/cold calls.
//
// Folders can only be deleted empty: both tables' parent/folder foreign
// keys are ON DELETE RESTRICT, so Postgres itself refuses to delete a
// folder that still has subfolders or files in it (23503) - the app just
// turns that into a friendly error rather than needing its own
// pre-delete "is it empty" query.

import { supabase } from "@/lib/supabase";

const BUCKET = "employee-files";
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB - the hosting platform may enforce a smaller request-body limit of its own
const SIGNED_URL_TTL_SECONDS = 60;

const FOLDER_SELECT = "id,name,parent_id,created_by,created_at, creator:created_by(id,display_name,full_name,username)";
const FILE_SELECT = "id,folder_id,name,size_bytes,mime_type,uploaded_by,created_at, uploader:uploaded_by(id,display_name,full_name,username)";

async function getBreadcrumb(folderId) {
  const trail = [];
  let currentId = folderId;
  // Folder trees on a small internal team tool stay shallow - a hard cap
  // just guards against a corrupted/cyclic parent_id looping forever.
  for (let i = 0; i < 50 && currentId; i++) {
    const { data, error } = await supabase
      .from("employee_folders")
      .select("id,name,parent_id")
      .eq("id", currentId)
      .maybeSingle();
    if (error || !data) break;
    trail.unshift({ id: data.id, name: data.name });
    currentId = data.parent_id;
  }
  return trail;
}

export async function listFolder(folderId) {
  const [{ data: subfolders, error: folderError }, { data: files, error: fileError }, breadcrumb] = await Promise.all([
    folderId
      ? supabase.from("employee_folders").select(FOLDER_SELECT).eq("parent_id", folderId).order("name")
      : supabase.from("employee_folders").select(FOLDER_SELECT).is("parent_id", null).order("name"),
    folderId
      ? supabase.from("employee_files").select(FILE_SELECT).eq("folder_id", folderId).order("name")
      : supabase.from("employee_files").select(FILE_SELECT).is("folder_id", null).order("name"),
    getBreadcrumb(folderId),
  ]);

  if (folderError) console.error("[employee-files] listFolder (folders) failed:", folderError.message);
  if (fileError) console.error("[employee-files] listFolder (files) failed:", fileError.message);

  return {
    breadcrumb,
    folders: subfolders || [],
    files: files || [],
  };
}

export async function createFolder(employeeId, { name, parent_id }) {
  const { data, error } = await supabase
    .from("employee_folders")
    .insert({ name: String(name).trim(), parent_id: parent_id || null, created_by: employeeId })
    .select(FOLDER_SELECT)
    .single();

  if (error) {
    console.error("[employee-files] createFolder failed:", error.message);
    return null;
  }
  return data;
}

export async function deleteFolder(employeeId, id) {
  const { data, error } = await supabase
    .from("employee_folders")
    .delete()
    .eq("id", id)
    .eq("created_by", employeeId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23503") return { ok: false, reason: "not_empty" };
    console.error("[employee-files] deleteFolder failed:", error.message);
    return { ok: false, reason: "error" };
  }
  return { ok: !!data, reason: data ? null : "not_found" };
}

export async function uploadFile(employeeId, { folderId, name, buffer, mimeType, sizeBytes }) {
  const cleanName = String(name).trim().slice(0, 255) || "file";
  const storagePath = `${folderId || "root"}/${crypto.randomUUID()}-${cleanName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType || "application/octet-stream" });

  if (uploadError) {
    console.error("[employee-files] storage upload failed:", uploadError.message);
    return null;
  }

  const { data, error } = await supabase
    .from("employee_files")
    .insert({
      folder_id: folderId || null,
      name: cleanName,
      storage_path: storagePath,
      size_bytes: sizeBytes,
      mime_type: mimeType || null,
      uploaded_by: employeeId,
    })
    .select(FILE_SELECT)
    .single();

  if (error) {
    // Same cleanup pattern as lib/create-profile.js - don't leave an
    // orphaned blob in storage if the metadata row fails to insert.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    console.error("[employee-files] uploadFile metadata insert failed:", error.message);
    return null;
  }
  return data;
}

export async function deleteFile(employeeId, id) {
  const { data: file, error: lookupError } = await supabase
    .from("employee_files")
    .select("id,storage_path")
    .eq("id", id)
    .eq("uploaded_by", employeeId)
    .maybeSingle();

  if (lookupError || !file) return false;

  const { error: deleteError } = await supabase.from("employee_files").delete().eq("id", id);
  if (deleteError) {
    console.error("[employee-files] deleteFile metadata delete failed:", deleteError.message);
    return false;
  }

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([file.storage_path]);
  if (storageError) {
    // Metadata is already gone (the file will no longer show up anywhere),
    // so this is a cleanup failure, not a user-facing one.
    console.error("[employee-files] deleteFile storage remove failed:", storageError.message);
  }
  return true;
}

export async function getSignedDownloadUrl(id) {
  const { data: file, error } = await supabase
    .from("employee_files")
    .select("storage_path,name")
    .eq("id", id)
    .maybeSingle();

  if (error || !file) return null;

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS, { download: file.name });

  if (signError || !data) {
    console.error("[employee-files] getSignedDownloadUrl failed:", signError?.message);
    return null;
  }
  return { url: data.signedUrl, name: file.name };
}
