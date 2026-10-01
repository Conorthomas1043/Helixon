"use client";

// "Share with client" on a shortlist: make a private review link (optionally
// anonymised, expiring), email it to the client contact, and see / revoke
// the links already made (app/api/shortlists/[id]/shares).

import { useCallback, useEffect, useState } from "react";
import { getShortlistShares, createShortlistShare, revokeShortlistShare } from "@/lib/dashboard-api";
import { Button, Dialog, ErrorText, Field, Pill, Select, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";
import { formatDate } from "@/lib/candidate-format";

export default function ShareShortlist({ shortlist, onClose }) {
  const [shares, setShares] = useState(null);
  const [f, setF] = useState({
    recipientName: "",
    recipientEmail: shortlist.clientEmail || "",
    blind: false,
    includeConcerns: false,
    showScore: true,
    expiresInDays: "30",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getShortlistShares(shortlist.id).then(setShares).catch(() => setShares([]));
  }, [shortlist.id, reloadKey]);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  async function create(send) {
    setBusy(true);
    setError("");
    try {
      const res = await createShortlistShare(shortlist.id, { ...f, expiresInDays: Number(f.expiresInDays), send });
      setCreated(res);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id) {
    try {
      await revokeShortlistShare(shortlist.id, id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  const check = (k, label) => (
    <label className="flex items-center gap-2 text-[13px]" style={{ color: INK }}>
      <input type="checkbox" checked={f[k]} onChange={(e) => setF((v) => ({ ...v, [k]: e.target.checked }))} className="accent-[var(--forest)]" />
      {label}
    </label>
  );

  return (
    <Dialog title="Share with the client" onClose={onClose} busy={busy} width={620}>
      {created ? (
        <div className="space-y-3 text-[13px]" style={{ color: INK }}>
          <p>{created.emailed ? `Sent to ${created.share.recipientEmail}.` : created.sendError ? `Link made, but ${created.sendError.toLowerCase()} Copy it below.` : "Here's the link:"}</p>
          <TextInput readOnly value={created.share.url} onFocus={(e) => e.target.select()} aria-label="Review link" />
          <div className="flex gap-2">
            <Button onClick={() => navigator.clipboard?.writeText(created.share.url)}>Copy link</Button>
            <Button variant="primary" onClick={() => setCreated(null)}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px]" style={{ color: INK_MUTED }}>
            They get a private page with a client-ready profile of each person and can answer Interview / Maybe / Not for us with a comment. No login needed; their answers appear on this shortlist.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Their name">
              <TextInput maxLength={200} value={f.recipientName} onChange={(e) => setF((v) => ({ ...v, recipientName: e.target.value }))} />
            </Field>
            <Field label="Their email">
              <TextInput type="email" maxLength={254} value={f.recipientEmail} onChange={(e) => setF((v) => ({ ...v, recipientEmail: e.target.value }))} />
            </Field>
            <Field label="Link works for">
              <Select value={f.expiresInDays} onChange={(e) => setF((v) => ({ ...v, expiresInDays: e.target.value }))} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "0", label: "Until revoked" }]} />
            </Field>
          </div>
          <div className="space-y-1.5">
            {check("blind", "Anonymise (no names, employers, schools or location)")}
            {check("showScore", "Show match scores")}
            {check("includeConcerns", "Include points to explore")}
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy || !f.recipientEmail.trim()} onClick={() => create(true)}>{busy ? "Working…" : "Email the link"}</Button>
            <Button disabled={busy} onClick={() => create(false)}>Just make the link</Button>
          </div>
        </div>
      )}

      {shares?.length > 0 && (
        <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: INK_FAINT }}>Links</p>
          <ul className="space-y-2">
            {shares.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: INK }}>
                <span className="flex-1 min-w-0 truncate">
                  {s.recipientName || s.recipientEmail || "Link"} {s.blind && <Pill>Anonymised</Pill>}{" "}
                  {!s.active && <Pill color="#b42318" background="#fef2f2">{s.revokedAt ? "Revoked" : "Expired"}</Pill>}
                  <span className="block" style={{ color: INK_FAINT }}>
                    {s.viewCount ? `Opened ${s.viewCount}× · last ${formatDate(s.lastViewedAt)}` : "Not opened yet"}
                    {s.expiresAt ? ` · until ${formatDate(s.expiresAt)}` : ""}
                  </span>
                </span>
                {s.active && (
                  <>
                    <Button size="sm" onClick={() => navigator.clipboard?.writeText(s.url)}>Copy</Button>
                    <Button size="sm" variant="ghost" onClick={() => revoke(s.id)}>Revoke</Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
