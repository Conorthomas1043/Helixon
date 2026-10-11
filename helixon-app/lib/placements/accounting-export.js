// Invoices and contractor pay as CSV for the accounts package - Xero's and
// QuickBooks Online's invoice import layouts, and a payroll sheet of
// approved timesheets. Pure, so the layouts are tested.

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Xero and QuickBooks UK both import DD/MM/YYYY.
export function ukDate(d) {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  return y && m && day ? `${day}/${m}/${y}` : "";
}

// An invoice's lines as { description, quantity, unitPrice } - one
// "Recruitment fee" line for an invoice saved without any.
export function invoiceLines(inv) {
  const list = Array.isArray(inv.lines) && inv.lines.length ? inv.lines : [{ description: "Recruitment fee", quantity: 1, unitPrice: inv.subtotal }];
  return list.map((l) => ({
    description: String(l.description || "Item").slice(0, 300),
    quantity: Number(l.quantity) || 0,
    unitPrice: round2(l.unitPrice ?? l.unit_price ?? l.amount ?? 0),
  }));
}

// Xero: Business → Invoices → Import. One row per invoice line.
export function xeroInvoiceRows(invoices, { accountCode = "200" } = {}) {
  return invoices.flatMap((inv) => {
    const vat = Number(inv.vat_rate || 0);
    return invoiceLines(inv).map((l) => ({
      "*ContactName": inv.bill_to?.name || "Client",
      EmailAddress: inv.bill_to?.email || "",
      POAddressLine1: inv.bill_to?.address ? String(inv.bill_to.address).split("\n")[0] : "",
      "*InvoiceNumber": inv.number,
      Reference: inv.bill_to?.reference || "",
      "*InvoiceDate": ukDate(inv.issued_on),
      "*DueDate": ukDate(inv.due_on || inv.issued_on),
      "*Description": l.description,
      "*Quantity": l.quantity,
      "*UnitAmount": l.unitPrice,
      "*AccountCode": accountCode,
      "*TaxType": vat > 0 ? "20% (VAT on Income)" : "No VAT",
      Currency: inv.currency || "GBP",
    }));
  });
}

// QuickBooks Online: Sales → Import invoices. One row per line.
export function quickbooksInvoiceRows(invoices) {
  return invoices.flatMap((inv) => {
    const vat = Number(inv.vat_rate || 0);
    return invoiceLines(inv).map((l) => ({
      InvoiceNo: inv.number,
      Customer: inv.bill_to?.name || "Client",
      InvoiceDate: ukDate(inv.issued_on),
      DueDate: ukDate(inv.due_on || inv.issued_on),
      ItemDescription: l.description,
      ItemQuantity: l.quantity,
      ItemRate: l.unitPrice,
      ItemAmount: round2(l.quantity * l.unitPrice),
      ItemTaxCode: vat > 0 ? "20.0% S" : "No VAT",
      Currency: inv.currency || "GBP",
    }));
  });
}

// Contractor pay from timesheets (approved or invoiced), with what's billed
// and the margin. Each timesheet: { week_starting, quantity, status,
// placements: { candidate_name, client_name, rate_unit, pay_rate, charge_rate, currency } }
export function payrollRows(timesheets) {
  return timesheets
    .filter((t) => t.status === "approved" || t.status === "invoiced")
    .map((t) => {
      const p = t.placements || {};
      const units = Number(t.quantity) || 0;
      const pay = round2(units * Number(p.pay_rate || 0));
      const bill = round2(units * Number(p.charge_rate || 0));
      return {
        Contractor: p.candidate_name || "",
        Client: p.client_name || "",
        "Week starting": ukDate(t.week_starting),
        Units: units,
        Per: p.rate_unit || "hour",
        "Pay rate": round2(p.pay_rate),
        "Gross pay": pay,
        "Charge rate": round2(p.charge_rate),
        Billed: bill,
        Margin: round2(bill - pay),
        Currency: p.currency || "GBP",
        Status: t.status === "invoiced" ? "Invoiced" : "Approved",
      };
    })
    .sort((a, b) => a.Contractor.localeCompare(b.Contractor));
}
