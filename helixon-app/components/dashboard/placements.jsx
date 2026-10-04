"use client";

// Offers and placements, shared by the candidate profile's Placement card
// and /dashboard/placements: the record/edit dialog, one placement with its
// invoices, and a contractor's timesheets (lib/placements.js for the sums).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  createPlacement,
  deleteTimesheet,
  getPlacement,
  getRecruiters,
  raiseInvoice,
  reviewTimesheet,
  saveTimesheet,
  updatePlacement,
} from "@/lib/dashboard-api";
import { PLACEMENT_STATUSES, INVOICE_STATUSES, computeFee, contractMargin, weekStarting } from "@/lib/placements";
import { Button, Dialog, ErrorText, Field, Pill, Select, TextArea, TextInput, formatMoney, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

const STATUS_OPTIONS = Object.entries(PLACEMENT_STATUSES).map(([value, label]) => ({ value, label }));
const STATUS_COLORS = {
  offered: ["var(--forest)", "var(--mist)"],
  accepted: ["#1f6f43", "#e5f4ea"],
  started: ["#1f6f43", "#e5f4ea"],
  completed: [INK_MUTED, "var(--mist)"],
  declined: ["var(--score-low)", "#fbeaea"],
  fell_through: ["var(--score-low)", "#fbeaea"],
};
const INVOICE_COLORS = { sent: ["var(--forest)", "var(--mist)"], paid: ["#1f6f43", "#e5f4ea"], void: [INK_FAINT, "var(--mist)"], draft: [INK_MUTED, "var(--mist)"] };

export function PlacementStatusPill({ status }) {
  const [color, background] = STATUS_COLORS[status] || [INK_MUTED, "var(--mist)"];
  return (
    <Pill color={color} background={background}>
      {PLACEMENT_STATUSES[status] || status}
    </Pill>
  );
}

export function InvoiceStatusPill({ invoice }) {
  const overdue = invoice.status === "sent" && invoice.due_on && invoice.due_on < new Date().toISOString().slice(0, 10);
  const [color, background] = overdue ? ["var(--score-low)", "#fbeaea"] : INVOICE_COLORS[invoice.status] || [INK_MUTED, "var(--mist)"];
  return (
    <Pill color={color} background={background}>
      {overdue ? "Overdue" : INVOICE_STATUSES[invoice.status] || invoice.status}
    </Pill>
  );
}

function formatDate(d) {
  if (!d) return null;
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const blankForm = (p) => ({
  kind: p?.kind || "permanent",
  status: p?.status || "offered",
  offerDate: p?.offerDate || new Date().toISOString().slice(0, 10),
  startDate: p?.startDate || "",
  endDate: p?.endDate || "",
  salary: p?.salary ?? "",
  feePercent: p?.feePercent ?? "",
  feeAmount: p?.feeAmount ?? "",
  rebateDays: p?.rebateDays ?? "",
  rateUnit: p?.rateUnit || "hour",
  payRate: p?.payRate ?? "",
  chargeRate: p?.chargeRate ?? "",
  currency: p?.currency || "GBP",
  notes: p?.notes || "",
  splits: p?.splits?.length ? p.splits.map((s) => ({ recruiterId: s.recruiterId, percent: String(s.percent) })) : [],
});

// Sharing a placement's fee and credit between recruiters (lib/placements.js
// cleanSplits). Empty = all to the candidate's recruiter.
function SplitEditor({ splits, onChange }) {
  const [team, setTeam] = useState([]);
  useEffect(() => {
    getRecruiters().then(setTeam).catch(() => {});
  }, []);
  const total = splits.reduce((n, s) => n + (Number(s.percent) || 0), 0);
  const update = (i, patch) => onChange(splits.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  if (splits.length === 0) {
    return (
      <button
        type="button"
        className="text-[12px] font-semibold"
        style={{ color: "var(--forest)" }}
        onClick={() => onChange([{ recruiterId: "", percent: "50" }, { recruiterId: "", percent: "50" }])}
      >
        + Split the fee with a colleague
      </button>
    );
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
        Fee split
      </legend>
      {splits.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select
            aria-label={`Person ${i + 1}`}
            value={s.recruiterId}
            onChange={(e) => update(i, { recruiterId: e.target.value })}
            options={[{ value: "", label: "Choose…" }, ...team.map((m) => ({ value: m.id, label: m.name }))]}
          />
          <TextInput aria-label={`Share for person ${i + 1}`} type="number" min="1" max="100" step="1" value={s.percent} onChange={(e) => update(i, { percent: e.target.value })} style={{ maxWidth: 90 }} />
          <span className="text-[12px]" style={{ color: INK_MUTED }}>%</span>
          {splits.length > 2 && (
            <button type="button" aria-label={`Remove person ${i + 1}`} className="text-[12px]" style={{ color: INK_FAINT }} onClick={() => onChange(splits.filter((_, j) => j !== i))}>
              Remove
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3 text-[12px]">
        {splits.length < 5 && (
          <button type="button" className="font-semibold" style={{ color: "var(--forest)" }} onClick={() => onChange([...splits, { recruiterId: "", percent: "" }])}>
            + Add person
          </button>
        )}
        <button type="button" style={{ color: INK_FAINT }} onClick={() => onChange([])}>
          No split
        </button>
        <span className="ml-auto tabular-nums" style={{ color: Math.abs(total - 100) < 0.01 ? INK_MUTED : "var(--score-low)" }}>
          Total {total}%
        </span>
      </div>
    </fieldset>
  );
}

// Record an offer for `candidate` ({ id, name }), or edit `placement`.
export function PlacementDialog({ candidate, placement, onClose, onSaved }) {
  const [f, setF] = useState(() => blankForm(placement));
  const [feeTyped, setFeeTyped] = useState(placement?.feeAmount != null && computeFee(placement.salary, placement.feePercent) !== placement.feeAmount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  const contract = f.kind === "contract";
  const moneyHidden = Boolean(placement?.financialsHidden);
  const suggestedFee = computeFee(f.salary === "" ? null : f.salary, f.feePercent === "" ? null : f.feePercent);
  const margin = contractMargin(f.payRate === "" ? null : f.payRate, f.chargeRate === "" ? null : f.chargeRate);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { kind: f.kind, status: f.status, currency: f.currency, offerDate: f.offerDate, startDate: f.startDate, notes: f.notes };
    // Only sent when there is one, or to clear one that was there.
    if (f.splits.length || placement?.splits?.length) body.splits = f.splits.map((s) => ({ recruiterId: s.recruiterId, percent: Number(s.percent) }));
    if (contract) Object.assign(body, { rateUnit: f.rateUnit, payRate: f.payRate, chargeRate: f.chargeRate, endDate: f.endDate });
    else {
      Object.assign(body, { salary: f.salary, feePercent: f.feePercent, rebateDays: f.rebateDays });
      if (feeTyped) body.feeAmount = f.feeAmount;
    }
    // Members who can't see money (lib/permissions.js) get blanks back -
    // never send those blanks, or saving would wipe the real figures.
    if (moneyHidden) for (const k of ["salary", "feePercent", "feeAmount", "payRate", "chargeRate", "splits"]) delete body[k];
    // On a new offer, blanks are left out so the client's terms fill them.
    if (!placement) for (const k of Object.keys(body)) if (body[k] === "") delete body[k];
    if (body.splits?.some((s) => !s.recruiterId)) {
      setError("Choose who each share of the split goes to.");
      setBusy(false);
      return;
    }
    try {
      const saved = placement ? await updatePlacement(placement.id, body) : await createPlacement({ ...body, candidateId: candidate.id });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title={placement ? "Edit placement" : `Record an offer${candidate?.name ? ` for ${candidate.name}` : ""}`} onClose={onClose} busy={busy} width={620}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select
              value={f.kind}
              onChange={set("kind")}
              options={[
                { value: "permanent", label: "Permanent" },
                { value: "contract", label: "Contract / temp" },
              ]}
            />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={set("status")} options={STATUS_OPTIONS} />
          </Field>
          <Field label="Offer date">
            <TextInput type="date" value={f.offerDate} onChange={set("offerDate")} />
          </Field>
          <Field label="Start date">
            <TextInput type="date" value={f.startDate} onChange={set("startDate")} />
          </Field>
        </div>

        {moneyHidden ? (
          <p className="text-[12px]" style={{ color: INK_MUTED }}>Fees, salary and rates are only visible to the owner and admins.</p>
        ) : contract ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Rate per">
              <Select
                value={f.rateUnit}
                onChange={set("rateUnit")}
                options={[
                  { value: "hour", label: "Hour" },
                  { value: "day", label: "Day" },
                ]}
              />
            </Field>
            <Field label="Pay rate">
              <TextInput type="number" min="0" step="0.01" inputMode="decimal" value={f.payRate} onChange={set("payRate")} />
            </Field>
            <Field label="Charge rate">
              <TextInput type="number" min="0" step="0.01" inputMode="decimal" value={f.chargeRate} onChange={set("chargeRate")} />
            </Field>
            <Field label="End date">
              <TextInput type="date" value={f.endDate} onChange={set("endDate")} />
            </Field>
            {margin && (
              <p className="col-span-full text-[12px]" style={{ color: INK_MUTED }}>
                Margin {formatMoney(margin.margin, f.currency)} per {f.rateUnit}
                {margin.percent != null ? ` (${margin.percent}% of charge)` : ""}.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Salary">
              <TextInput type="number" min="0" step="1" inputMode="decimal" value={f.salary} onChange={set("salary")} />
            </Field>
            <Field label="Fee %" hint={placement ? null : "Blank = client's terms"}>
              <TextInput type="number" min="0" max="100" step="0.01" inputMode="decimal" value={f.feePercent} onChange={set("feePercent")} />
            </Field>
            <Field label="Fee">
              <TextInput
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={feeTyped ? f.feeAmount : suggestedFee ?? ""}
                placeholder="Salary × %"
                onChange={(e) => {
                  setFeeTyped(e.target.value !== "");
                  setF((prev) => ({ ...prev, feeAmount: e.target.value }));
                }}
              />
            </Field>
            <Field label="Rebate days" hint={placement ? null : "Blank = client's terms"}>
              <TextInput type="number" min="0" max="365" step="1" value={f.rebateDays} onChange={set("rebateDays")} />
            </Field>
          </div>
        )}

        {!moneyHidden && <SplitEditor splits={f.splits} onChange={(splits) => setF((prev) => ({ ...prev, splits }))} />}
        <Field label="Currency">
          <Select
            value={f.currency}
            onChange={set("currency")}
            options={["GBP", "EUR", "USD"].map((c) => ({ value: c, label: c }))}
            style={{ maxWidth: 120 }}
          />
        </Field>
        <Field label="Notes">
          <TextArea value={f.notes} onChange={set("notes")} maxLength={2000} placeholder="Benefits, notice period, counter-offer risk…" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : placement ? "Save" : "Record offer"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// A contractor's weeks: add/replace a week, approve or reject, invoice the
// approved ones.
function Timesheets({ placement, timesheets, onChanged }) {
  const [week, setWeek] = useState(() => weekStarting(new Date().toISOString()));
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const unit = placement.rateUnit === "day" ? "days" : "hours";
  const approved = timesheets.filter((t) => t.status === "approved");

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: INK_FAINT }}>
        Timesheets
      </p>
      {timesheets.length > 0 && (
        <ul className="space-y-1">
          {timesheets.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: INK }}>
              <span className="min-w-[110px]">w/c {formatDate(t.weekStarting)}</span>
              <span className="tabular-nums">
                {t.quantity} {unit}
              </span>
              <Pill color={t.status === "rejected" ? "var(--score-low)" : t.status === "submitted" ? INK_MUTED : "#1f6f43"}>{t.status}</Pill>
              {t.status === "submitted" && (
                <>
                  <button type="button" disabled={busy} className="font-semibold" style={{ color: "var(--forest)" }} onClick={() => run(() => reviewTimesheet(placement.id, t.id, "approved"))}>
                    Approve
                  </button>
                  <button type="button" disabled={busy} style={{ color: INK_MUTED }} onClick={() => run(() => reviewTimesheet(placement.id, t.id, "rejected"))}>
                    Reject
                  </button>
                </>
              )}
              {t.status !== "invoiced" && (
                <button type="button" disabled={busy} aria-label="Delete timesheet" style={{ color: INK_FAINT }} onClick={() => run(() => deleteTimesheet(placement.id, t.id))}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await saveTimesheet(placement.id, { weekStarting: week, quantity });
            setQuantity("");
          });
        }}
      >
        <TextInput type="date" aria-label="Week starting" value={week || ""} onChange={(e) => setWeek(e.target.value)} style={{ width: 150 }} />
        <TextInput type="number" min="0" max="168" step="0.25" aria-label={`${unit} worked`} placeholder={unit} value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: 90 }} required />
        <Button size="sm" type="submit" disabled={busy}>
          Add week
        </Button>
        {approved.length > 0 && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => raiseInvoice(placement.id, { timesheetIds: approved.map((t) => t.id) }))}>
            Invoice {approved.length} approved week{approved.length === 1 ? "" : "s"}
          </Button>
        )}
      </form>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

// One placement: the deal, its invoices, and (contract) its timesheets.
// `showCandidate` adds the candidate/client line for the Placements page.
export function PlacementItem({ placement: initial, showCandidate = false, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const p = detail?.placement || initial;
  const invoices = detail?.invoices || initial.invoices || [];

  useEffect(() => {
    let cancelled = false;
    getPlacement(initial.id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initial.id, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
    onChanged?.();
  }, [onChanged]);

  async function changeStatus(status) {
    setBusy(true);
    setError(null);
    try {
      await updatePlacement(p.id, { status });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function invoice() {
    setBusy(true);
    setError(null);
    try {
      await raiseInvoice(p.id);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const live = invoices.filter((i) => i.status !== "void");
  const today = new Date().toISOString().slice(0, 10);
  const inRebate = p.kind === "permanent" && p.rebateUntil && p.rebateUntil >= today && ["started", "accepted"].includes(p.status);
  const margin = p.kind === "contract" ? contractMargin(p.payRate, p.chargeRate) : null;

  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {showCandidate && (
            <p className="text-[13px] font-semibold" style={{ color: INK }}>
              {p.candidateId ? (
                <Link href={`/dashboard/candidates/${p.candidateId}`} className="hover:underline">
                  {p.candidateName}
                </Link>
              ) : (
                p.candidateName
              )}
              <span className="font-normal" style={{ color: INK_MUTED }}>
                {p.jobTitle ? ` · ${p.jobTitle}` : ""}
                {p.clientName ? ` · ${p.clientName}` : ""}
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <PlacementStatusPill status={p.status} />
            <span className="text-[12px]" style={{ color: INK_MUTED }}>
              {p.kind === "contract" ? "Contract" : "Permanent"}
              {p.startDate ? ` · starts ${formatDate(p.startDate)}` : ""}
              {p.endDate ? ` · ends ${formatDate(p.endDate)}` : ""}
            </span>
            {inRebate && <Pill color="#8a5a00" background="#fdf3dc">Rebate period to {formatDate(p.rebateUntil)}</Pill>}
          </div>
          <p className="text-[12px] mt-1" style={{ color: INK }}>
            {p.kind === "contract" ? (
              <>
                Pay {formatMoney(p.payRate, p.currency)} · charge {formatMoney(p.chargeRate, p.currency)} per {p.rateUnit || "hour"}
                {margin ? ` · margin ${formatMoney(margin.margin, p.currency)}` : ""}
              </>
            ) : (
              <>
                {p.salary != null ? `Salary ${formatMoney(p.salary, p.currency)}` : "No salary yet"}
                {p.feePercent != null ? ` · ${p.feePercent}%` : ""}
                {p.feeAmount != null ? ` · fee ${formatMoney(p.feeAmount, p.currency)}` : ""}
                {p.splits?.length > 1 ? ` · split ${p.splits.map((x) => `${x.percent}%`).join(" / ")}` : ""}
              </>
            )}
          </p>
          {p.notes && (
            <p className="text-[12px] mt-1 whitespace-pre-wrap" style={{ color: INK_MUTED }}>
              {p.notes}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Placement status" value={p.status} disabled={busy} onChange={(e) => changeStatus(e.target.value)} options={STATUS_OPTIONS} style={{ width: 150 }} />
          <Button size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {p.kind === "permanent" && live.length === 0 && ["accepted", "started", "completed"].includes(p.status) && (
            <Button size="sm" variant="primary" disabled={busy} onClick={invoice}>
              Raise invoice
            </Button>
          )}
        </div>
      </div>
      {invoices.length > 0 && (
        <ul className="mt-2 space-y-1">
          {invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 text-[12px]">
              <Link href={`/dashboard/invoices/${i.id}`} className="font-semibold hover:underline" style={{ color: "var(--forest)" }}>
                {i.number}
              </Link>
              <span className="tabular-nums" style={{ color: INK }}>
                {formatMoney(i.total, i.currency)}
              </span>
              <InvoiceStatusPill invoice={i} />
              {i.due_on && i.status === "sent" && <span style={{ color: INK_FAINT }}>due {formatDate(i.due_on)}</span>}
            </li>
          ))}
        </ul>
      )}
      {p.kind === "contract" && detail && <Timesheets placement={p} timesheets={detail.timesheets} onChanged={reload} />}
      <ErrorText>{error}</ErrorText>
      {editing && (
        <PlacementDialog
          placement={p}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
    </li>
  );
}
