// Offers, placements, invoices and timesheets - see migration
// 20261001060000. The arithmetic lives here so it's tested and the same
// everywhere (the API, the placement panel, the Placements page).

import { cleanLine, cleanText } from "@/lib/sanitize";

export const PLACEMENT_STATUSES = {
  offered: "Offer made",
  accepted: "Offer accepted",
  declined: "Offer declined",
  started: "Started",
  fell_through: "Fell through",
  completed: "Contract ended",
};

export const INVOICE_STATUSES = { draft: "Draft", sent: "Sent", paid: "Paid", void: "Void" };
export const DEFAULT_VAT_RATE = 20;
const DAY = 86400000;

const round2 = (n) => Math.round(n * 100) / 100;

export function computeFee(salary, feePercent) {
  if (salary == null || feePercent == null) return null;
  return round2((Number(salary) * Number(feePercent)) / 100);
}

// "YYYY-MM-DD" `days` after `date`.
export function addDays(date, days) {
  if (!date || days == null) return null;
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + Number(days) * DAY).toISOString().slice(0, 10);
}

export function contractMargin(payRate, chargeRate) {
  if (payRate == null || chargeRate == null) return null;
  const margin = round2(Number(chargeRate) - Number(payRate));
  return { margin, percent: Number(chargeRate) > 0 ? round2((margin / Number(chargeRate)) * 100) : null };
}

// Placement fields from a request body, as columns. Derived values (fee
// from salary x %, rebate end from start + days) are filled in when not
// given. `current` is the existing row on an update.
export function cleanPlacement(body = {}, current = {}) {
  const out = {};
  const num = (key, col, { min = 0, max = 1e9, integer = false } = {}) => {
    if (body[key] === undefined) return null;
    if (body[key] === null || body[key] === "") {
      out[col] = null;
      return null;
    }
    const n = Number(String(body[key]).replace(/[£$€,\s]/g, ""));
    if (!Number.isFinite(n) || n < min || n > max) return `${key} is out of range`;
    out[col] = integer ? Math.round(n) : round2(n);
    return null;
  };
  const date = (key, col) => {
    if (body[key] === undefined) return null;
    if (!body[key]) {
      out[col] = null;
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body[key]) || Number.isNaN(Date.parse(body[key]))) return `${key} isn't a date`;
    out[col] = body[key];
    return null;
  };
  if (body.kind !== undefined) {
    if (!["permanent", "contract"].includes(body.kind)) return { error: "Unknown placement type." };
    out.kind = body.kind;
  }
  if (body.status !== undefined) {
    if (!PLACEMENT_STATUSES[body.status]) return { error: "Unknown status." };
    out.status = body.status;
  }
  if (body.rateUnit !== undefined) {
    if (body.rateUnit && !["hour", "day"].includes(body.rateUnit)) return { error: "Rates are per hour or per day." };
    out.rate_unit = body.rateUnit || null;
  }
  if (body.currency !== undefined) {
    if (!/^[A-Z]{3}$/.test(body.currency || "")) return { error: "Unknown currency." };
    out.currency = body.currency;
  }
  const errors = [
    num("salary", "salary"),
    num("feePercent", "fee_percent", { max: 100 }),
    num("feeAmount", "fee_amount"),
    num("payRate", "pay_rate", { max: 1e6 }),
    num("chargeRate", "charge_rate", { max: 1e6 }),
    num("rebateDays", "rebate_days", { max: 365, integer: true }),
    date("offerDate", "offer_date"),
    date("startDate", "start_date"),
    date("endDate", "end_date"),
  ].filter(Boolean);
  if (errors.length) return { error: `Check the numbers and dates (${errors[0]}).` };
  if (body.notes !== undefined) out.notes = cleanText(body.notes, { max: 2000 }) || null;

  const merged = { ...current, ...out };
  // Fee from salary x % unless a fee was typed.
  if (body.feeAmount === undefined && ("salary" in out || "fee_percent" in out)) {
    out.fee_amount = computeFee(merged.salary, merged.fee_percent);
  }
  if ("start_date" in out || "rebate_days" in out) {
    out.rebate_until = merged.rebate_days ? addDays(merged.start_date, merged.rebate_days) : null;
  }
  return out;
}

export function toPlacement(row) {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    jobId: row.job_id,
    clientId: row.client_id,
    recruiterId: row.recruiter_id,
    candidateName: row.candidate_name,
    jobTitle: row.job_title,
    clientName: row.client_name,
    kind: row.kind,
    status: row.status,
    currency: row.currency,
    offerDate: row.offer_date,
    startDate: row.start_date,
    endDate: row.end_date,
    salary: row.salary == null ? null : Number(row.salary),
    feePercent: row.fee_percent == null ? null : Number(row.fee_percent),
    feeAmount: row.fee_amount == null ? null : Number(row.fee_amount),
    rateUnit: row.rate_unit,
    payRate: row.pay_rate == null ? null : Number(row.pay_rate),
    chargeRate: row.charge_rate == null ? null : Number(row.charge_rate),
    rebateDays: row.rebate_days,
    rebateUntil: row.rebate_until,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// The candidate's pipeline stage a placement status implies, if any.
export function stageForStatus(status) {
  if (status === "accepted" || status === "offered") return "Offer";
  if (status === "started" || status === "completed") return "Placed";
  return null;
}

// Invoice totals from lines [{ description, quantity, unitPrice }].
export function invoiceTotals(lines, vatRate = DEFAULT_VAT_RATE) {
  const clean = (lines || []).map((l) => {
    const quantity = round2(Number(l.quantity) || 0);
    const unitPrice = round2(Number(l.unitPrice) || 0);
    return { description: cleanLine(l.description, 300) || "Item", quantity, unitPrice, amount: round2(quantity * unitPrice) };
  });
  const subtotal = round2(clean.reduce((s, l) => s + l.amount, 0));
  const vat = round2((subtotal * Number(vatRate || 0)) / 100);
  return { lines: clean, subtotal, vatAmount: vat, total: round2(subtotal + vat) };
}

// The next invoice number after the agency's existing ones: PREFIX-0001.
export function nextInvoiceNumber(existing, prefix = "INV") {
  const p = String(prefix || "INV").replace(/[^A-Za-z0-9-]/g, "").slice(0, 10) || "INV";
  let max = 0;
  for (const n of existing || []) {
    const m = String(n).match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${p}-${String(max + 1).padStart(4, "0")}`;
}

// Monday of the week containing `date`, as YYYY-MM-DD.
export function weekStarting(date) {
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - day * DAY).toISOString().slice(0, 10);
}

export function isOverdueInvoice(inv, today = new Date().toISOString().slice(0, 10)) {
  return inv.status === "sent" && inv.due_on && inv.due_on < today;
}
