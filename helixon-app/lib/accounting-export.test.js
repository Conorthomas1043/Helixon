import { describe, expect, it } from "vitest";
import { payrollRows, quickbooksInvoiceRows, ukDate, xeroInvoiceRows } from "./accounting-export";

const invoice = {
  number: "INV-0007",
  issued_on: "2026-10-01",
  due_on: "2026-10-31",
  currency: "GBP",
  vat_rate: 20,
  subtotal: 9000,
  bill_to: { name: "Acme Ltd", email: "ap@acme.com", address: "1 High St\nLeeds" },
  lines: [{ description: "Placement fee - Ana, Dev", quantity: 1, unitPrice: 9000 }],
};

describe("accounting exports", () => {
  it("formats UK dates", () => {
    expect(ukDate("2026-10-01")).toBe("01/10/2026");
    expect(ukDate(null)).toBe("");
  });

  it("lays out Xero's invoice import", () => {
    expect(xeroInvoiceRows([invoice])).toEqual([
      {
        "*ContactName": "Acme Ltd",
        EmailAddress: "ap@acme.com",
        POAddressLine1: "1 High St",
        "*InvoiceNumber": "INV-0007",
        Reference: "",
        "*InvoiceDate": "01/10/2026",
        "*DueDate": "31/10/2026",
        "*Description": "Placement fee - Ana, Dev",
        "*Quantity": 1,
        "*UnitAmount": 9000,
        "*AccountCode": "200",
        "*TaxType": "20% (VAT on Income)",
        Currency: "GBP",
      },
    ]);
  });

  it("lays out QuickBooks' invoice import, with a line for an invoice that has none", () => {
    const rows = quickbooksInvoiceRows([{ ...invoice, lines: [], vat_rate: 0 }]);
    expect(rows).toEqual([
      { InvoiceNo: "INV-0007", Customer: "Acme Ltd", InvoiceDate: "01/10/2026", DueDate: "31/10/2026", ItemDescription: "Recruitment fee", ItemQuantity: 1, ItemRate: 9000, ItemAmount: 9000, ItemTaxCode: "No VAT", Currency: "GBP" },
    ]);
  });

  it("works out contractor pay from approved timesheets only", () => {
    const rows = payrollRows([
      { week_starting: "2026-09-28", quantity: 5, status: "approved", placements: { candidate_name: "Cat", client_name: "Acme", rate_unit: "day", pay_rate: 400, charge_rate: 500 } },
      { week_starting: "2026-09-28", quantity: 37.5, status: "submitted", placements: { candidate_name: "Dan" } },
    ]);
    expect(rows).toEqual([
      { Contractor: "Cat", Client: "Acme", "Week starting": "28/09/2026", Units: 5, Per: "day", "Pay rate": 400, "Gross pay": 2000, "Charge rate": 500, Billed: 2500, Margin: 500, Currency: "GBP", Status: "Approved" },
    ]);
  });
});
