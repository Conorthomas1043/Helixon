"use client";

// Business-development pieces shared by a client's page and
// /dashboard/business-development: the deal dialog, a client's deals card,
// and a client's follow-up card (lib/opportunities.js).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createOpportunity, deleteOpportunity, getClients, getOpportunities, getRecruiters, setClientNextAction, updateOpportunity } from "@/lib/dashboard-api";
import { DEFAULT_PROBABILITY, OPPORTUNITY_STAGES, effectiveProbability } from "@/lib/opportunities";
import { Button, Card, Dialog, ErrorText, Field, Pill, Select, TextArea, TextInput, formatMoney, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";
import { formatDateOnly } from "@/lib/candidate-format";
import { reportQuietly } from "@/lib/report-error";

const STAGE_OPTIONS = Object.entries(OPPORTUNITY_STAGES).map(([value, label]) => ({ value, label }));

export function StagePill({ stage }) {
  const won = stage === "won";
  const lost = stage === "lost";
  return (
    <Pill color={won ? "var(--forest)" : lost ? "var(--score-low)" : INK_MUTED} background={won ? "var(--mint)" : lost ? "rgba(192,57,43,0.08)" : "var(--mist)"}>
      {OPPORTUNITY_STAGES[stage] || stage}
    </Pill>
  );
}

// Create (no `opportunity`) or edit one. `clientId` fixes the client;
// without it a client picker is shown.
export function OpportunityDialog({ opportunity = null, clientId = null, onClose, onSaved }) {
  const [clients, setClients] = useState(null);
  const [team, setTeam] = useState([]);
  const [f, setF] = useState({
    clientId: opportunity?.clientId || clientId || "",
    title: opportunity?.title || "",
    stage: opportunity?.stage || "lead",
    value: opportunity?.value ?? "",
    probability: opportunity?.probability ?? "",
    expectedClose: opportunity?.expectedClose || "",
    ownerId: opportunity?.ownerId || "",
    notes: opportunity?.notes || "",
    lostReason: opportunity?.lostReason || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clientId && !opportunity) getClients().then((c) => setClients(c || [])).catch(() => setClients([]));
    getRecruiters().then(setTeam).catch(reportQuietly);
  }, [clientId, opportunity]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fields = {
      title: f.title,
      stage: f.stage,
      value: f.value === "" ? null : f.value,
      probability: f.probability === "" ? null : Number(f.probability),
      expectedClose: f.expectedClose || null,
      ownerId: f.ownerId || null,
      notes: f.notes,
      lostReason: f.stage === "lost" ? f.lostReason : undefined,
    };
    try {
      const saved = opportunity ? await updateOpportunity(opportunity.id, fields) : await createOpportunity({ ...fields, clientId: f.clientId });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  // Already inside a dialog, so deleting asks in place (a second dialog on
  // top would share the Escape key) rather than with the native box.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      await deleteOpportunity(opportunity.id);
      onSaved(null);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title={opportunity ? "Edit deal" : "New deal"} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="space-y-4">
        {!clientId && !opportunity && (
          <Field label="Client or prospect" hint={clients && clients.length === 0 ? "Add the company on the Clients page first (status: Prospect)." : null}>
            <Select
              required
              value={f.clientId}
              onChange={(e) => set("clientId", e.target.value)}
              options={[{ value: "", label: clients ? "Choose…" : "Loading…" }, ...(clients || []).map((c) => ({ value: c.id, label: c.status === "prospect" ? `${c.name} (prospect)` : c.name }))]}
            />
          </Field>
        )}
        <Field label="Deal">
          <TextInput required maxLength={200} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Engineering team hires, 2027" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Stage">
            <Select value={f.stage} onChange={(e) => set("stage", e.target.value)} options={STAGE_OPTIONS} />
          </Field>
          <Field label="Owner">
            <Select value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)} options={[{ value: "", label: "Me" }, ...team.map((m) => ({ value: m.id, label: m.name }))]} />
          </Field>
          <Field label="Estimated fees (£)">
            <TextInput type="number" min={0} step="100" value={f.value} onChange={(e) => set("value", e.target.value)} />
          </Field>
          <Field label="Chance of winning (%)" hint={`Blank uses ${DEFAULT_PROBABILITY[f.stage]}% for this stage.`}>
            <TextInput type="number" min={0} max={100} value={f.probability} onChange={(e) => set("probability", e.target.value)} />
          </Field>
          <Field label="Expected close">
            <TextInput type="date" value={f.expectedClose} onChange={(e) => set("expectedClose", e.target.value)} />
          </Field>
        </div>
        {f.stage === "lost" && (
          <Field label="Why it was lost">
            <TextInput maxLength={500} value={f.lostReason} onChange={(e) => set("lostReason", e.target.value)} />
          </Field>
        )}
        <Field label="Notes">
          <TextArea maxLength={4000} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {opportunity && !confirmingDelete && (
            <Button variant="danger" className="ml-auto" onClick={() => setConfirmingDelete(true)} disabled={busy}>
              Delete
            </Button>
          )}
          {opportunity && confirmingDelete && (
            <span className="ml-auto flex items-center gap-2" role="group" aria-label="Confirm delete">
              <span className="text-[13px]" style={{ color: "var(--ink-soft)" }}>Delete this deal?</span>
              <Button size="sm" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                Keep
              </Button>
              <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
                Yes, delete
              </Button>
            </span>
          )}
        </div>
      </form>
    </Dialog>
  );
}

// One client's deals.
export function ClientDealsCard({ clientId }) {
  const [deals, setDeals] = useState(null);
  const [dialog, setDialog] = useState(null); // null | "new" | deal
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOpportunities({ clientId })
      .then((d) => { if (!cancelled) setDeals(d.unavailable ? [] : d.opportunities); })
      .catch(() => { if (!cancelled) setDeals([]); });
    return () => { cancelled = true; };
  }, [clientId, reloadKey]);

  const reload = useCallback(() => {
    setDialog(null);
    setReloadKey((k) => k + 1);
  }, []);
  const close = useCallback(() => setDialog(null), []);

  return (
    <Card title="Deals" action={<Button size="sm" onClick={() => setDialog("new")}>+ Add</Button>}>
      {deals === null ? (
        <p className="text-[14px]" style={{ color: INK_FAINT }}>Loading…</p>
      ) : deals.length === 0 ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>
          No deals yet. Track new business with this client - from first contact to signed terms.
        </p>
      ) : (
        <ul className="space-y-3">
          {deals.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => setDialog(d)} className="w-full text-left text-[14px]">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold truncate" style={{ color: INK }}>{d.title}</span>
                  <StagePill stage={d.stage} />
                </span>
                <span className="block text-[13px]" style={{ color: INK_MUTED }}>
                  {d.value != null ? formatMoney(d.value) : "No value"}
                  {d.stage !== "won" && d.stage !== "lost" ? ` · ${effectiveProbability(d)}%` : ""}
                  {d.expectedClose ? ` · close ${formatDateOnly(d.expectedClose)}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {dialog && <OpportunityDialog clientId={clientId} opportunity={dialog === "new" ? null : dialog} onClose={close} onSaved={reload} />}
    </Card>
  );
}

// A client's next follow-up: set one, or mark it done.
export function ClientFollowUpCard({ clientId, nextAction, onChange }) {
  const [label, setLabel] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(body) {
    setBusy(true);
    setError("");
    try {
      const next = await setClientNextAction(clientId, body);
      onChange(next);
      setLabel("");
      setDueAt("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const overdue = nextAction?.dueAt && new Date(nextAction.dueAt) < new Date();
  return (
    <Card title="Next follow-up">
      {nextAction ? (
        <div className="text-[14px]">
          <p className="font-semibold" style={{ color: INK }}>{nextAction.label}</p>
          {nextAction.dueAt && (
            <p style={{ color: overdue ? "var(--score-low)" : INK_MUTED }}>
              {overdue ? "Overdue · " : "Due "}
              {new Date(nextAction.dueAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          <Button size="sm" className="mt-3" variant="outline" disabled={busy} onClick={() => save({ completed: true })}>
            Mark done
          </Button>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            save({ label, dueAt: dueAt ? new Date(dueAt).toISOString() : null });
          }}
        >
          <TextInput required maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Call to discuss Q1 hiring" aria-label="Follow-up" />
          <TextInput type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} aria-label="Due" />
          <Button type="submit" size="sm" variant="primary" disabled={busy || !label.trim()}>
            Set follow-up
          </Button>
        </form>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

export function DealLink({ deal }) {
  return (
    <Link href={`/dashboard/clients/${deal.clientId}`} className="underline" style={{ color: INK_MUTED }}>
      {deal.clientName || "Client"}
    </Link>
  );
}
