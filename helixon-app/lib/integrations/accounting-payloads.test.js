import { describe, expect, it } from "vitest";
import { qbString, quickbooksInvoicePayload, quickbooksInvoiceState, sameName, xeroDate, xeroInvoicePayload, xeroInvoiceState } from "./accounting-payloads";

const invoice = {
  number: "INV-0042",
  currency: "GBP",
  issued_on: "2026-10-01",
  due_on: "2026-10-31",
  vat_rate: 20,
  bill_to: { name: "Acme Ltd", email: "ap@acme.test", reference: "PO-9" },
  lines: [{ description: "Placement fee - Jane Doe", quantity: 1, unitPrice: 12000 }],
};

describe("accounting payloads", () => {
  it("builds a Xero draft invoice with VAT", () => {
    const p = xeroInvoicePayload(invoice, "contact-1", {}).Invoices[0];
    expect(p).toMatchObject({ Type: "ACCREC", Contact: { ContactID: "contact-1" }, InvoiceNumber: "INV-0042", Reference: "PO-9", Date: "2026-10-01", DueDate: "2026-10-31", CurrencyCode: "GBP", Status: "DRAFT", LineAmountTypes: "Exclusive" });
    expect(p.LineItems).toEqual([{ Description: "Placement fee - Jane Doe", Quantity: 1, UnitAmount: 12000, AccountCode: "200", TaxType: "OUTPUT2" }]);
  });

  it("honours Xero settings and no-VAT invoices", () => {
    const p = xeroInvoicePayload({ ...invoice, vat_rate: 0 }, "c", { XERO_INVOICE_STATUS: "AUTHORISED", XERO_SALES_ACCOUNT_CODE: "4000" }).Invoices[0];
    expect(p.Status).toBe("AUTHORISED");
    expect(p.LineItems[0]).toMatchObject({ AccountCode: "4000", TaxType: "NONE" });
    expect(xeroInvoicePayload(invoice, "c", { XERO_INVOICE_STATUS: "PAID" }).Invoices[0].Status).toBe("DRAFT");
  });

  it("falls back to one fee line when an invoice has none", () => {
    const p = xeroInvoicePayload({ ...invoice, lines: [], subtotal: 5000 }, "c", {}).Invoices[0];
    expect(p.LineItems).toHaveLength(1);
    expect(p.LineItems[0]).toMatchObject({ Description: "Recruitment fee", Quantity: 1, UnitAmount: 5000 });
  });

  it("reads Xero payment state and dates", () => {
    expect(xeroDate("/Date(1518685950940+0000)/")).toBe("2018-02-15");
    expect(xeroDate("2026-10-05T00:00:00")).toBe("2026-10-05");
    expect(xeroDate(null)).toBeNull();
    expect(xeroInvoiceState({ Status: "PAID", FullyPaidOnDate: "/Date(1518685950940+0000)/" })).toEqual({ paid: true, paidOn: "2018-02-15", voided: false });
    expect(xeroInvoiceState({ Status: "AUTHORISED" })).toEqual({ paid: false, paidOn: null, voided: false });
    expect(xeroInvoiceState({ Status: "VOIDED" }).voided).toBe(true);
  });

  it("builds a QuickBooks invoice", () => {
    const p = quickbooksInvoicePayload(invoice, 58, { QUICKBOOKS_TAX_CODE_VAT: "7" });
    expect(p.CustomerRef).toEqual({ value: "58" });
    expect(p.DocNumber).toBe("INV-0042");
    expect(p.BillEmail).toEqual({ Address: "ap@acme.test" });
    expect(p.Line[0]).toEqual({
      Amount: 12000,
      DetailType: "SalesItemLineDetail",
      Description: "Placement fee - Jane Doe",
      SalesItemLineDetail: { ItemRef: { value: "1" }, Qty: 1, UnitPrice: 12000, TaxCodeRef: { value: "7" } },
    });
    expect(quickbooksInvoicePayload({ ...invoice, number: "X".repeat(30) }, 1, {}).DocNumber).toHaveLength(21);
    expect(quickbooksInvoicePayload(invoice, 1, {}).Line[0].SalesItemLineDetail.TaxCodeRef).toBeUndefined();
  });

  it("reads QuickBooks payment state", () => {
    expect(quickbooksInvoiceState({ TotalAmt: 100, Balance: 0 }, "2026-10-03")).toEqual({ paid: true, paidOn: "2026-10-03", voided: false });
    expect(quickbooksInvoiceState({ TotalAmt: 100, Balance: 40 }).paid).toBe(false);
    expect(quickbooksInvoiceState({ TotalAmt: 0, Balance: 0 }).paid).toBe(false);
  });

  it("escapes QuickBooks query strings and matches names loosely", () => {
    expect(qbString("O'Brien \\ Co")).toBe("'O\\'Brien \\\\ Co'");
    expect(sameName(" Acme  Ltd", "acme ltd")).toBe(true);
    expect(sameName("", "")).toBe(false);
    expect(sameName("Acme", "Acme Ltd")).toBe(false);
  });
});
