"use client";
// app/employee/files/page.js
// Shared filing system - folders and files visible to every active
// employee, stored in the private "employee-files" Storage bucket. See
// lib/employee-files.js for who can create/delete what.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useHeartbeat } from "../_shared/useHeartbeat";

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const FOLDER_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);
const FILE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

export default function EmployeeFilesPage() {
  const router = useRouter();
  useHeartbeat();
  const fileInputRef = useRef(null);

  const [checking, setChecking] = useState(true);
  const [employee, setEmployee] = useState(null);

  const [folderId, setFolderId] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/employee/me");
        if (!res.ok) { router.replace("/employee/login"); return; }
        const data = await res.json();
        if (!data.ok) { router.replace("/employee/login"); return; }
        setEmployee(data.employee);
      } catch {
        router.replace("/employee/login");
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  async function fetchFolder() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (folderId) params.set("folderId", folderId);
      const res = await fetch(`/api/employee/files?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Could not load files."); return; }
      setBreadcrumb(data.breadcrumb || []);
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!checking) fetchFolder();
  }, [checking, folderId]);

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/employee/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_folder", name: newFolderName.trim(), parent_id: folderId }),
      });
      const data = await res.json();
      if (!data.ok) { alert(data.error || "Could not create folder."); return; }
      setNewFolderName("");
      setShowNewFolder(false);
      fetchFolder();
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleDeleteFolder(folder) {
    if (!confirm(`Delete "${folder.name}"? It must be empty.`)) return;
    try {
      const res = await fetch("/api/employee/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_folder", id: folder.id }),
      });
      const data = await res.json();
      if (!data.ok) { alert(data.error || "Could not delete folder."); return; }
      fetchFolder();
    } catch {
      alert("Could not delete folder.");
    }
  }

  async function handleDeleteFile(file) {
    if (!confirm(`Delete "${file.name}"?`)) return;
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    try {
      const res = await fetch("/api/employee/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_file", id: file.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to delete.");
    } catch (err) {
      alert(err.message || "Failed to delete.");
      fetchFolder();
    }
  }

  async function handleFilesSelected(e) {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (selected.length === 0) return;

    setUploading(true);
    setUploadError("");
    for (const file of selected) {
      const form = new FormData();
      form.append("file", file);
      if (folderId) form.append("folderId", folderId);
      try {
        const res = await fetch("/api/employee/files/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!data.ok) setUploadError(`${file.name}: ${data.error || "Upload failed."}`);
      } catch {
        setUploadError(`${file.name}: Network error.`);
      }
    }
    setUploading(false);
    fetchFolder();
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--mist)" }}>
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "4px solid var(--border)", borderTopColor: "var(--forest)" }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }} aria-label="Main">
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link href="/employee/dashboard" className="flex items-center gap-3 group" aria-label="Employee dashboard">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>Helixon</span>
              <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "var(--ink-faint)" }}>Employee portal</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/employee/calendar" className="nav-link text-xs font-medium px-2" style={{ color: "var(--ink-soft)" }}>Calendar</Link>
            <Link href="/employee/goals" className="nav-link text-xs font-medium px-2" style={{ color: "var(--ink-soft)" }}>Goals</Link>
            <Link href="/employee/cold-calls" className="nav-link text-xs font-medium px-2" style={{ color: "var(--ink-soft)" }}>Cold calls</Link>
            <Link href="/employee/dashboard" className="text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:bg-white" style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}>
              ← My dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Files
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
              Shared folders and documents, visible to the whole team.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button
              onClick={() => setShowNewFolder((v) => !v)}
              className="text-xs font-semibold px-4 py-2.5 rounded-lg transition hover:bg-white"
              style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }}
            >
              + New folder
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-lg transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--forest)", color: "white" }}
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <input ref={fileInputRef} type="file" multiple onChange={handleFilesSelected} className="hidden" />
          </div>
        </div>

        {/* ── Breadcrumb ──────────────────────────────────────────────── */}
        <div className="flex items-center flex-wrap gap-1 mb-5 text-xs" style={{ color: "var(--ink-faint)" }}>
          <button onClick={() => setFolderId(null)} className="font-medium hover:underline" style={{ color: folderId ? "var(--ink-soft)" : "var(--forest)" }}>
            Files
          </button>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <span>/</span>
              <button
                onClick={() => setFolderId(crumb.id)}
                className="font-medium hover:underline"
                style={{ color: i === breadcrumb.length - 1 ? "var(--forest)" : "var(--ink-soft)" }}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {error && (
          <div className="rounded-[14px] px-4 py-3 text-sm mb-6" style={{ background: "#fdf1f0", border: "1px solid #f4d4d2", color: "#e0554f" }}>
            {error}
          </div>
        )}
        {uploadError && (
          <div className="rounded-[14px] px-4 py-3 text-sm mb-6" style={{ background: "#fdf1f0", border: "1px solid #f4d4d2", color: "#e0554f" }}>
            {uploadError}
          </div>
        )}

        {showNewFolder && (
          <form onSubmit={handleCreateFolder} className="flex gap-2 mb-5">
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 max-w-xs bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
              style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
            />
            <button type="submit" disabled={creatingFolder || !newFolderName.trim()} className="text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 hover:opacity-90" style={{ background: "var(--forest)", color: "white" }}>
              Create
            </button>
            <button type="button" onClick={() => setShowNewFolder(false)} className="text-sm px-4 py-2 rounded-lg transition hover:bg-white" style={{ color: "var(--ink-soft)" }}>
              Cancel
            </button>
          </form>
        )}

        <div className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }}>
          {loading ? (
            <div className="px-6 py-14 text-center text-sm" style={{ color: "var(--ink-faint)" }}>Loading…</div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm" style={{ color: "var(--ink-faint)" }}>Empty - create a folder or upload a file above.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {folders.map((folder) => {
                const canDelete = folder.created_by === employee?.id;
                const creator = folder.creator?.full_name || folder.creator?.display_name;
                return (
                  <div key={folder.id} className="flex items-center gap-3 px-5 py-3 group">
                    <span style={{ color: "var(--ink-faint)" }}>{FOLDER_ICON}</span>
                    <button onClick={() => setFolderId(folder.id)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{folder.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                        {creator ? `Created by ${creator} · ` : ""}{formatDate(folder.created_at)}
                      </p>
                    </button>
                    {canDelete && (
                      <button onClick={() => handleDeleteFolder(folder)} className="text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition shrink-0" style={{ color: "#e0554f" }}>
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
              {files.map((file) => {
                const canDelete = file.uploaded_by === employee?.id;
                const uploader = file.uploader?.full_name || file.uploader?.display_name;
                return (
                  <div key={file.id} className="flex items-center gap-3 px-5 py-3 group">
                    <span style={{ color: "var(--ink-faint)" }}>{FILE_ICON}</span>
                    <a
                      href={`/api/employee/files/${file.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0"
                    >
                      <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{file.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                        {formatBytes(file.size_bytes)}{uploader ? ` · Uploaded by ${uploader}` : ""} · {formatDate(file.created_at)}
                      </p>
                    </a>
                    {canDelete && (
                      <button onClick={() => handleDeleteFile(file)} className="text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition shrink-0" style={{ color: "#e0554f" }}>
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
