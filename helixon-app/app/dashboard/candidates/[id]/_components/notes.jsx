"use client";

// Part of the candidate profile page (../page.jsx).

import { CARD, INK, INK_FAINT, INK_MUTED, RED_STRONG, formatRelativeTime } from "@/lib/candidates/format";
import { useMemo, useState } from "react";
import { SectionHeading } from "./primitives";

export function NoteItem({ note, mine, onEdit, onDelete, onPin }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.body);
  const [saving, setSaving] = useState(false);

  if (editing) {
    return (
      <li className="text-[14px] rounded-[10px] p-3" style={{ background: "var(--mist)" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          aria-label="Edit note"
          className="w-full text-sm p-2.5 rounded-[8px] resize-none bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        />
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={() => { setEditing(false); setText(note.body); }} className="text-[13px] font-semibold px-3 py-1 rounded-full" style={{ color: INK_MUTED }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!text.trim() || saving}
            onClick={async () => {
              setSaving(true);
              const ok = await onEdit(note.id, text);
              setSaving(false);
              if (ok) setEditing(false);
            }}
            className="text-[13px] font-semibold px-3 py-1 rounded-full disabled:opacity-40"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className="group text-[14px] rounded-[10px] p-3"
      style={{ background: note.pinnedAt ? "var(--mint)" : "var(--mist)", border: note.pinnedAt ? "1px solid var(--forest)" : "1px solid transparent" }}
    >
      {note.pinnedAt && (
        <p className="text-[12px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--forest)" }}>
          Pinned
        </p>
      )}
      <p className="whitespace-pre-wrap" style={{ color: INK }}>{note.body}</p>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <p className="text-[12px]" style={{ color: INK_FAINT }}>
          - {note.author} · {formatRelativeTime(note.createdAt)}
        </p>
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          <button type="button" onClick={() => onPin(note.id, !note.pinnedAt)} className="hover:underline" style={{ color: INK_MUTED }}>
            {note.pinnedAt ? "Unpin" : "Pin"}
          </button>
          {mine && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="hover:underline" style={{ color: INK_MUTED }}>
                Edit
              </button>
              <button type="button" onClick={() => onDelete(note.id)} className="hover:underline" style={{ color: RED_STRONG }}>
                Delete
              </button>
            </>
          )}
        </span>
      </div>
    </li>
  );
}

export function NotesPanel({ notes, currentUserId, onAddNote, onEditNote, onDeleteNote, onPinNote }) {
  const [draft, setDraft] = useState("");
  // Pinned first (most recently pinned on top), then newest first.
  const ordered = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (Boolean(a.pinnedAt) !== Boolean(b.pinnedAt)) return a.pinnedAt ? -1 : 1;
        if (a.pinnedAt) return String(b.pinnedAt).localeCompare(String(a.pinnedAt));
        return String(b.createdAt).localeCompare(String(a.createdAt));
      }),
    [notes]
  );
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Working notes" title="Notes" />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.trim() || saving) return;
          setSaving(true);
          const ok = await onAddNote(draft);
          setSaving(false);
          if (ok) setDraft("");
        }}
        className="mb-4"
      >
        <textarea
          id="candidate-note-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note for the team… (type @name to notify someone)"
          rows={3}
          className="w-full text-sm p-3 rounded-[10px] resize-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={!draft.trim() || saving}
            className="text-[13px] font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Saving…" : "Add note"}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>
          No notes yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {ordered.map((n) => (
            <NoteItem
              key={n.id}
              note={n}
              mine={Boolean(currentUserId) && n.authorId === currentUserId}
              onEdit={onEditNote}
              onDelete={onDeleteNote}
              onPin={onPinNote}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Talent pool & other roles - keep someone for future jobs, and screen them
 * against another job from the CV already on file (lib/rescreen.js).
 * ---------------------------------------------------------------------- */
