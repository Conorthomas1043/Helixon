// What Helixon sends to Xero / QuickBooks for an invoice, and how their
// replies are read. Pure, so it's tested; the calls are in accounting.js.
//
// An invoice is pushed once (as a draft in Xero unless XERO_INVOICE_STATUS
// says otherwise); after that only its payment status is read back.

import { invoiceLines } from "@/lib/accounting-export";

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Xero UK tax types: OUTPUT2 is "20% (VAT on Income)", NONE is "No VAT".
export function xeroInvoicePayload(inv, contactId, env = process.env) {
  const vat = Number(inv.vat_rate || 0) > 0;
  return {
    Invoices: [
      {
        Type: "ACCREC",
        Contact: { ContactID: contactId },
        InvoiceNumber: String(inv.number || "").slice(0, 255),
        Reference: inv.bill_to?.reference ? String(inv.bill_to.reference).slice(0, 255) : undefined,
        Date: String(inv.issued_on || "").slice(0, 10) || undefined,
        DueDate: String(inv.due_on || inv.issued_on || "").slice(0, 10) || undefined,
        CurrencyCode: inv.currency || "GBP",
        LineAmountTypes: "Exclusive",
        Status: ["DRAFT", "SUBMITTED", "AUTHORISED"].includes(env.XERO_INVOICE_STATUS) ? env.XERO_INVOICE_STATUS : "DRAFT",
        LineItems: invoiceLines(inv).map((l) => ({
          Description: l.description,
          Quantity: l.quantity,
          UnitAmount: l.unitPrice,
          AccountCode: env.XERO_SALES_ACCOUNT_CODE || "200",
          TaxType: vat ? env.XERO_TAX_TYPE_VAT || "OUTPUT2" : env.XERO_TAX_TYPE_NONE || "NONE",
        })),
      },
    ],
  };
}

// "/Date(1518685950940+0000)/" -> "2018-02-15"
export function xeroDate(value) {
  const m = String(value || "").match(/\/Date\((\d+)/);
  if (m) return new Date(Number(m[1])).toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}/.test(String(value || "")) ? String(value).slice(0, 10) : null;
}

// { paid, paidOn, voided } from a Xero invoice.
export function xeroInvoiceState(invoice) {
  const status = invoice?.Status;
  return {
    paid: status === "PAID",
    paidOn: status === "PAID" ? xeroDate(invoice.FullyPaidOnDate) : null,
    voided: status === "VOIDED" || status === "DELETED",
  };
}

// QuickBooks needs an Item on every line: QUICKBOOKS_ITEM_ID (default "1",
// usually "Services"). Tax codes only when QUICKBOOKS_TAX_CODE_VAT /
// _NONE are set - otherwise the company's defaults apply.
export function quickbooksInvoicePayload(inv, customerId, env = process.env) {
  const vat = Number(inv.vat_rate || 0) > 0;
  const taxCode = vat ? env.QUICKBOOKS_TAX_CODE_VAT : env.QUICKBOOKS_TAX_CODE_NONE;
  return {
    CustomerRef: { value: String(customerId) },
    DocNumber: String(inv.number || "").slice(0, 21),
    TxnDate: String(inv.issued_on || "").slice(0, 10) || undefined,
    DueDate: String(inv.due_on || inv.issued_on || "").slice(0, 10) || undefined,
    GlobalTaxCalculation: "TaxExcluded",
    BillEmail: inv.bill_to?.email ? { Address: String(inv.bill_to.email) } : undefined,
    Line: invoiceLines(inv).map((l) => ({
      Amount: round2(l.quantity * l.unitPrice),
      DetailType: "SalesItemLineDetail",
      Description: l.description,
      SalesItemLineDetail: {
        ItemRef: { value: String(env.QUICKBOOKS_ITEM_ID || "1") },
        Qty: l.quantity,
        UnitPrice: l.unitPrice,
        ...(taxCode ? { TaxCodeRef: { value: String(taxCode) } } : {}),
      },
    })),
  };
}

export function quickbooksInvoiceState(invoice, today = new Date().toISOString().slice(0, 10)) {
  const total = Number(invoice?.TotalAmt || 0);
  const balance = Number(invoice?.Balance ?? total);
  const paid = total > 0 && balance === 0;
  return { paid, paidOn: paid ? today : null, voided: false };
}

// A QuickBooks query string literal: 'O\'Brien Ltd'
export function qbString(value) {
  return `'${String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

// The contact/customer whose name matches, ignoring case and spacing.
export function sameName(a, b) {
  const n = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return n(a) !== "" && n(a) === n(b);
}
