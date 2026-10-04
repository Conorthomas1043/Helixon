"use client";

// Part of the employee mobile app (EmployeeMobileApp.jsx).

import { useCallback, useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { ErrorNotice, ICONS, Icon, SectionTitle } from "./shared";

// ── Files ────────────────────────────────────────────────────────────────
// Same data/API as app/employee/files (the desktop page) - folder
// navigation plus upload/download/delete.

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesTab({ employee }) {
  const [ask, confirmDialog] = useConfirm();
  const fileInputRef = useRef(null);
  const [folderId, setFolderId] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (folderId) params.set("folderId", folderId);
      const res = await fetch(`/api/employee/files?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not load files.");
      setBreadcrumb(data.breadcrumb || []);
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (err) {
      setError(err?.message || "Could not load files.");
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
    load();
  }, [load]);

  async function createFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch("/api/employee/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create_folder", name: newFolderName.trim(), parent_id: folderId }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Could not create folder."); return; }
      setNewFolderName("");
      setShowNewFolder(false);
      load();
    } catch {
      setError("Could not create folder.");
    }
  }

  async function deleteFolder(folder) {
    if (!(await ask({ title: `Delete "${folder.name}"?`, body: "Only empty folders can be deleted.", confirmLabel: "Delete folder", danger: true }))) return;
    try {
      const res = await fetch("/api/employee/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete_folder", id: folder.id }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Could not delete folder."); return; }
      load();
    } catch {
      setError("Could not delete folder.");
    }
  }

  async function deleteFile(file) {
    if (!(await ask({ title: `Delete "${file.name}"?`, confirmLabel: "Delete file", danger: true }))) return;
    setFiles((current) => current.filter((f) => f.id !== file.id));
    try {
      const res = await fetch("/api/employee/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete_file", id: file.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to delete.");
    } catch (err) {
      setError(err?.message || "Failed to delete.");
      load();
    }
  }

  async function handleFilesSelected(e) {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (selected.length === 0) return;
    setUploading(true);
    setError("");
    for (const file of selected) {
      const form = new FormData();
      form.append("file", file);
      if (folderId) form.append("folderId", folderId);
      try {
        const res = await fetch("/api/employee/files/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!data.ok) setError(`${file.name}: ${data.error || "Upload failed."}`);
      } catch {
        setError(`${file.name}: Network error.`);
      }
    }
    setUploading(false);
    load();
  }

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-2.5">
        <SectionTitle>Files</SectionTitle>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowNewFolder((v) => !v)}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "white", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
          >
            + Folder
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-full disabled:opacity-50"
            style={{ background: "var(--mint)", color: "var(--forest)" }}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <input ref={fileInputRef} type="file" multiple onChange={handleFilesSelected} className="hidden" />
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-1 mb-2.5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
        <button onClick={() => setFolderId(null)} className="font-medium" style={{ color: folderId ? "var(--ink-soft)" : "var(--forest)" }}>
          Files
        </button>
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <span>/</span>
            <button onClick={() => setFolderId(crumb.id)} className="font-medium" style={{ color: i === breadcrumb.length - 1 ? "var(--forest)" : "var(--ink-soft)" }}>
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {showNewFolder && (
        <form onSubmit={createFolder} className="flex gap-2 mb-3">
          <input
            autoFocus
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="flex-1 text-[14px] rounded-[10px] px-3 py-2.5"
            style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
          />
          <button type="submit" className="text-[13px] font-semibold px-3 py-2 rounded-[10px]" style={{ background: "var(--forest)", color: "white" }}>
            Add
          </button>
        </form>
      )}

      <ErrorNotice message={error} />

      {loading ? (
        <p className="text-[13px] text-center py-6" style={{ color: "var(--ink-faint)" }}>Loading…</p>
      ) : folders.length === 0 && files.length === 0 ? (
        <p className="text-[13px] text-center py-6" style={{ color: "var(--ink-faint)" }}>Empty - create a folder or upload a file.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {folders.map((folder) => {
            const canDelete = folder.created_by === employee?.id;
            return (
              <div key={folder.id} className="flex items-center gap-2.5 px-3.5 py-3 rounded-[12px]" style={{ background: "white", border: "1px solid var(--border)" }}>
                <span style={{ color: "var(--ink-faint)" }}><Icon path={ICONS.folder} size={16} /></span>
                <button onClick={() => setFolderId(folder.id)} className="flex-1 min-w-0 text-left">
                  <div className="text-[14px] font-medium truncate" style={{ color: "var(--ink)" }}>{folder.name}</div>
                </button>
                {canDelete && (
                  <button type="button" onClick={() => deleteFolder(folder)} aria-label="Delete folder" className="shrink-0" style={{ color: "var(--ink-faint)" }}>
                    <Icon path={ICONS.trash} size={14} />
                  </button>
                )}
              </div>
            );
          })}
          {files.map((file) => {
            const canDelete = file.uploaded_by === employee?.id;
            return (
              <div key={file.id} className="flex items-center gap-2.5 px-3.5 py-3 rounded-[12px]" style={{ background: "white", border: "1px solid var(--border)" }}>
                <span style={{ color: "var(--ink-faint)" }}><Icon path={ICONS.file} size={16} /></span>
                <a href={`/api/employee/files/${file.id}/download`} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium truncate" style={{ color: "var(--ink)" }}>{file.name}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--ink-faint)" }}>{formatBytes(file.size_bytes)}</div>
                </a>
                {canDelete && (
                  <button type="button" onClick={() => deleteFile(file)} aria-label="Delete file" className="shrink-0" style={{ color: "var(--ink-faint)" }}>
                    <Icon path={ICONS.trash} size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
