"use client";

// Panels on a candidate's profile for working with the candidate directly:
// documents to sign (offer letters, contracts), their self-service link,
// interview times for them to pick, and merging a duplicate record.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelBookingLink,
  createBookingLink,
  createPortalLink,
  getBookingLinks,
  getCandidates,
  getPlacements,
  getPortalLink,
  mergeCandidate,
  revokePortalLink,
  setCandidateNextAction,
  summariseCallNotes,
} from "@/lib/dashboard-api";
import { offerLetterText } from "@/lib/signatures-shared";
import SignaturesCard from "@/components/dashboard/SignaturesCard";
import { Button, Card, Dialog, ErrorText, Field, Select, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";
import { useConfirm } from "@/components/dashboard/use-confirm";
import CopyButton from "@/components/dashboard/CopyButton";

// Offer letters and contracts, worded from the candidate's latest placement.
export function CandidateDocumentsCard({ candidate }) {
  const [placement, setPlacement] = useState(null);
  useEffect(() => {
    getPlacements({ candidateId: candidate.id })
      .then((list) => setPlacement((list || [])[0] || null))
      .catch(() => {});
  }, [candidate.id]);

  const template = useCallback(
    (kind, agencyName) => {
      const base = {
        agencyName,
        candidateName: candidate.fullName,
        jobTitle: placement?.jobTitle || candidate.jobTitle,
        clientName: placement?.clientName || candidate.company,
        currency: placement?.currency || "GBP",
        startDate: placement?.startDate,
      };
      if (kind === "contract") {
        return { title: `Assignment confirmation - ${base.jobTitle || "contract"}`, body: offerLetterText({ ...base, kind: "contract", payRate: placement?.payRate, rateUnit: placement?.rateUnit, endDate: placement?.endDate }) };
      }
      if (kind === "offer") {
        return { title: `Offer - ${base.jobTitle || "role"}`, body: offerLetterText({ ...base, salary: placement?.salary }) };
      }
      return { title: "", body: "" };
    },
    [candidate, placement]
  );

  return (
    <SignaturesCard
      kinds={placement?.kind === "contract" ? ["contract", "offer", "other"] : ["offer", "contract", "other"]}
      signer={{ name: candidate.fullName, email: candidate.email }}
      template={template}
      candidateId={candidate.id}
      placementId={placement?.id || null}
    />
  );
}

// A private link where the candidate updates their own details and uploads
// documents (app/portal/[token]).
export function SelfServiceCard({ candidate }) {
  const [ask, confirmDialog] = useConfirm();
  const [state, setState] = useState({ loading: true, link: null, unavailable: false });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPortalLink(candidate.id)
      .then((d) => { if (!cancelled) setState({ loading: false, link: d.link, unavailable: Boolean(d.unavailable) }); })
      .catch(() => { if (!cancelled) setState({ loading: false, link: null, unavailable: false }); });
    return () => { cancelled = true; };
  }, [candidate.id]);

  async function create(send) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await createPortalLink(candidate.id, { send });
      setState((s) => ({ ...s, link: res.link }));
      setNote(res.emailError ? `Link made, but the email didn't send: ${res.emailError}` : send ? `Emailed to ${candidate.email}.` : "Link ready - copy it below.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!(await ask({ title: "Turn this link off?", body: "The candidate won't be able to use it any more.", confirmLabel: "Turn link off", danger: true }))) return;
    setBusy(true);
    try {
      await revokePortalLink(candidate.id);
      setState((s) => ({ ...s, link: null }));
      setNote("Link turned off.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (state.unavailable) return null;
  const { link } = state;
  return (
    <>
      {confirmDialog}
    <Card title="Candidate self-service">
      <p className="text-[13px] mb-3" style={{ color: INK_MUTED }}>
        A private link where they update their details and availability and upload documents like their right to work.
      </p>
      {state.loading ? (
        <p className="text-[14px]" style={{ color: INK_FAINT }}>Loading…</p>
      ) : link ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <TextInput readOnly value={link.url} aria-label="Self-service link" onFocus={(e) => e.target.select()} />
            <CopyButton size="sm" text={link.url}>Copy</CopyButton>
          </div>
          <p className="text-[12px]" style={{ color: INK_FAINT }}>
            Works until {new Date(link.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            {link.lastUsedAt ? ` · last opened ${new Date(link.lastUsedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : " · not opened yet"}
          </p>
          <div className="flex gap-2">
            {candidate.email && <Button size="sm" disabled={busy} onClick={() => create(true)}>Email a new link</Button>}
            <Button size="sm" variant="ghost" disabled={busy} onClick={revoke}>Turn off</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {candidate.email && <Button size="sm" variant="primary" disabled={busy} onClick={() => create(true)}>Email them a link</Button>}
          <Button size="sm" disabled={busy} onClick={() => create(false)}>Create link</Button>
        </div>
      )}
      {note && <p className="text-[13px] mt-2" style={{ color: INK_MUTED }}>{note}</p>}
      <ErrorText>{error}</ErrorText>
    </Card>
    </>
  );
}

function OfferTimesDialog({ candidate, onClose, onSaved }) {
  const [slots, setSlots] = useState(["", "", ""]);
  const [f, setF] = useState({ durationMinutes: "60", kind: "video", location: "", interviewers: "" });
  const [send, setSend] = useState(Boolean(candidate.email));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    const chosen = slots.filter(Boolean).map((s) => new Date(s).toISOString());
    if (!chosen.length) {
      setError("Add at least one time.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await createBookingLink(candidate.id, { ...f, durationMinutes: Number(f.durationMinutes), slots: chosen, send });
      onSaved(res);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title="Offer interview times" onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-[13px]" style={{ color: INK_MUTED }}>
          {candidate.fullName} picks one on a private link, and the interview is booked with calendar invites to them and the hiring contact.
        </p>
        <div className="space-y-2">
          {slots.map((s, i) => (
            <TextInput key={i} type="datetime-local" aria-label={`Time ${i + 1}`} value={s} onChange={(e) => setSlots((x) => x.map((v, j) => (j === i ? e.target.value : v)))} />
          ))}
          {slots.length < 12 && (
            <button type="button" className="text-[13px] font-semibold" style={{ color: "var(--forest)" }} onClick={() => setSlots((x) => [...x, ""])}>
              + Another time
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select
              value={f.kind}
              onChange={(e) => setF((x) => ({ ...x, kind: e.target.value }))}
              options={[
                { value: "video", label: "Video call" },
                { value: "phone", label: "Phone" },
                { value: "in_person", label: "In person" },
              ]}
            />
          </Field>
          <Field label="Length (minutes)">
            <TextInput type="number" min={5} max={600} value={f.durationMinutes} onChange={(e) => setF((x) => ({ ...x, durationMinutes: e.target.value }))} />
          </Field>
          <Field label={f.kind === "in_person" ? "Address" : "Link or dial-in"}>
            <TextInput maxLength={500} value={f.location} onChange={(e) => setF((x) => ({ ...x, location: e.target.value }))} />
          </Field>
          <Field label="Interviewers">
            <TextInput maxLength={500} value={f.interviewers} onChange={(e) => setF((x) => ({ ...x, interviewers: e.target.value }))} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[14px]" style={{ color: INK }}>
          <input type="checkbox" checked={send && Boolean(candidate.email)} disabled={!candidate.email} onChange={(e) => setSend(e.target.checked)} />
          Email the times to {candidate.email || "the candidate (no email on file)"}
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Offer times"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

// Interview times offered for the candidate to pick (app/book/[token]).
export function BookingLinksCard({ candidate, onBooked }) {
  const [links, setLinks] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [note, setNote] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getBookingLinks(candidate.id)
      .then((d) => {
        if (cancelled) return;
        setLinks(d.links || []);
        setUnavailable(Boolean(d.unavailable));
        if ((d.links || []).some((l) => l.status === "booked")) onBooked?.();
      })
      .catch(() => { if (!cancelled) setLinks([]); });
    return () => { cancelled = true; };
    // onBooked only refreshes the profile - not a reason to re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id, reloadKey]);

  if (unavailable) return null;
  const open = (links || []).filter((l) => l.status === "open" && l.openSlots.length > 0);
  return (
    <Card title="Interview booking" action={<Button size="sm" onClick={() => setDialog(true)}>Offer times</Button>}>
      {links === null ? (
        <p className="text-[14px]" style={{ color: INK_FAINT }}>Loading…</p>
      ) : open.length === 0 ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>Offer a few times and let {candidate.fullName.split(" ")[0]} pick - no back-and-forth emails.</p>
      ) : (
        <ul className="space-y-3">
          {open.map((l) => (
            <li key={l.id} className="text-[14px]">
              <p style={{ color: INK }}>{l.openSlots.length} time{l.openSlots.length === 1 ? "" : "s"} waiting for a pick</p>
              <div className="flex gap-3 text-[12px] font-semibold mt-1">
                <CopyButton plain text={l.url} style={{ color: "var(--forest)" }}>Copy link</CopyButton>
                <button
                  type="button"
                  style={{ color: INK_FAINT }}
                  onClick={async () => {
                    setNote("");
                    try {
                      await cancelBookingLink(candidate.id, l.id);
                      setNote("Link cancelled. The candidate can no longer pick a time from it.");
                    } catch (err) {
                      setNote(`Couldn't cancel that link: ${err.message}`);
                    }
                    setReloadKey((k) => k + 1);
                  }}
                >
                  Cancel link
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-[13px] mt-2" style={{ color: INK_MUTED }}>{note}</p>}
      {dialog && (
        <OfferTimesDialog
          candidate={candidate}
          onClose={() => setDialog(false)}
          onSaved={(res) => {
            setDialog(false);
            setNote(res.emailError ? `Saved, but the email didn't send: ${res.emailError}. Copy the link instead.` : "Times offered.");
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </Card>
  );
}

// Merge a duplicate record of the same person into this one, or link two
// records for different jobs as the same person.
export function MergeDuplicateCard({ candidate }) {
  const [ask, confirmDialog] = useConfirm();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || query.trim().length < 2) return undefined;
    const t = setTimeout(() => {
      getCandidates({ search: query.trim(), pageSize: 8 })
        .then((d) => setResults((d.items || []).filter((c) => c.id !== candidate.id)))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [open, query, candidate.id]);

  async function pick(other) {
    const sameJob = (other.jobId ?? null) === (candidate.jobId ?? null);
    const ok = await ask(
      sameJob
        ? {
            title: `Merge ${other.fullName} into this record?`,
            body: `Their notes, activity, interviews, emails and documents (${other.jobTitle}) move here, and the duplicate is deleted. This can't be undone.`,
            confirmLabel: "Merge records",
            danger: true,
          }
        : {
            title: `Link ${other.fullName} as the same person?`,
            body: `They're on a different job (${other.jobTitle}). Both pipeline entries are kept.`,
            confirmLabel: "Link records",
          }
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await mergeCandidate(candidate.id, other.id);
      setOpen(false);
      router.refresh();
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      {confirmDialog}
    <Card title="Duplicates" action={!open && <Button size="sm" onClick={() => setOpen(true)}>Find</Button>}>
      {!open ? (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>Same person on file twice? Merge the records or link them.</p>
      ) : (
        <div className="space-y-2">
          <TextInput autoFocus placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search for the duplicate" />
          <ul className="space-y-1">
            {query.trim().length >= 2 && results.length === 0 && <li className="text-[13px]" style={{ color: INK_FAINT }}>No matches.</li>}
            {results.map((c) => (
              <li key={c.id}>
                <button type="button" disabled={busy} onClick={() => pick(c)} className="w-full text-left rounded-[8px] px-2 py-1.5 text-[14px] hover:bg-[var(--mist)]">
                  <span className="font-semibold" style={{ color: INK }}>{c.fullName}</span>
                  <span className="block text-[12px]" style={{ color: INK_MUTED }}>
                    {c.jobTitle}
                    {(c.jobId ?? null) === (candidate.jobId ?? null) ? " · same job - merge" : " · different job - link"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Card>
    </>
  );
}

// Paste rough call notes or a transcript; get a summary, key points and a
// follow-up (app/api/candidates/[id]/call-notes).
export function CallNotesCard({ candidate, onSaved }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState("call");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function run(save) {
    setBusy(save ? "save" : "summarise");
    setError("");
    try {
      const res = await summariseCallNotes(candidate.id, { notes, kind, save });
      setResult(res.result);
      if (save) {
        setDone("Saved to notes and the timeline.");
        onSaved?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function addFollowUp() {
    if (!result?.followUp) return;
    setBusy("follow");
    try {
      const due = new Date(Date.now() + result.followUp.inDays * 86400000);
      due.setHours(9, 0, 0, 0);
      await setCandidateNextAction(candidate.id, { label: result.followUp.label, dueAt: due.toISOString() });
      setDone("Follow-up set.");
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Call notes (AI)" action={!open && <Button size="sm" onClick={() => setOpen(true)}>Summarise a call</Button>}>
      {!open ? (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>Paste rough notes or a transcript - get a clean summary, next steps and a follow-up.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 text-[13px]">
            {["call", "meeting"].map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className="px-2.5 py-1 rounded-full font-semibold" style={kind === k ? { background: "var(--forest)", color: "white" } : { border: "1px solid var(--border)", color: INK_MUTED }}>
                {k === "call" ? "Call" : "Meeting"}
              </button>
            ))}
          </div>
          <textarea
            rows={6}
            maxLength={20000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label="Call notes"
            placeholder="e.g. spoke to her re the Acme role - keen, 1 month notice, wants 55k+, 2nd stage at another firm next week, call back Thu"
            className="w-full text-[14px] px-3 py-2 rounded-[8px] bg-white"
            style={{ border: "1px solid var(--border)", color: INK }}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={busy || notes.trim().length < 20} onClick={() => run(false)}>
              {busy === "summarise" ? "Summarising…" : "Summarise"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setResult(null); setDone(""); }}>Close</Button>
          </div>
          {result && (
            <div className="rounded-[10px] p-3 text-[14px] space-y-2" style={{ background: "var(--mist)", color: INK }}>
              <p>{result.summary}</p>
              {result.keyPoints.length > 0 && (
                <ul className="list-disc pl-5 text-[13px]" style={{ color: INK_MUTED }}>
                  {result.keyPoints.map((p) => <li key={p}>{p}</li>)}
                </ul>
              )}
              {result.nextSteps.length > 0 && (
                <>
                  <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: INK_FAINT }}>Next steps</p>
                  <ul className="list-disc pl-5 text-[13px]" style={{ color: INK_MUTED }}>
                    {result.nextSteps.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                </>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="primary" disabled={Boolean(busy)} onClick={() => run(true)}>{busy === "save" ? "Saving…" : "Save to notes"}</Button>
                {result.followUp && (
                  <Button size="sm" disabled={Boolean(busy)} onClick={addFollowUp}>
                    Follow-up: {result.followUp.label} ({result.followUp.inDays === 0 ? "today" : `in ${result.followUp.inDays}d`})
                  </Button>
                )}
              </div>
              <p className="text-[12px]" style={{ color: INK_FAINT }}>Written by AI from your notes - check it before relying on it.</p>
            </div>
          )}
          {done && <p className="text-[13px]" style={{ color: "var(--forest)" }}>{done}</p>}
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Card>
  );
}
