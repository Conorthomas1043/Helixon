import { describe, expect, it } from "vitest";
import { addDays, cleanPlacement, computeFee, contractMargin, invoiceTotals, nextInvoiceNumber, stageForStatus, weekStarting } from "./placements";

describe("placement arithmetic", () => {
  it("computes fees, rebates and margins", () => {
    expect(computeFee(55000, 18)).toBe(9900);
    expect(computeFee(null, 18)).toBeNull();
    expect(addDays("2026-10-05", 90)).toBe("2027-01-03");
    expect(contractMargin(450, 550)).toEqual({ margin: 100, percent: 18.18 });
  });

  it("fills in the fee and rebate end", () => {
    const out = cleanPlacement({ salary: "£55,000", feePercent: 18, startDate: "2026-10-05", rebateDays: 90 });
    expect(out).toMatchObject({ salary: 55000, fee_percent: 18, fee_amount: 9900, start_date: "2026-10-05", rebate_until: "2027-01-03" });
  });

  it("recomputes from the current row on update, but keeps a typed fee", () => {
    expect(cleanPlacement({ feePercent: 20 }, { salary: 50000 }).fee_amount).toBe(10000);
    expect(cleanPlacement({ feePercent: 20, feeAmount: 8000 }, { salary: 50000 }).fee_amount).toBe(8000);
  });

  it("rejects bad input", () => {
    expect(cleanPlacement({ feePercent: 120 }).error).toBeTruthy();
    expect(cleanPlacement({ startDate: "05/10/2026" }).error).toBeTruthy();
    expect(cleanPlacement({ status: "maybe" }).error).toBeTruthy();
  });

  it("maps status to stage", () => {
    expect(stageForStatus("accepted")).toBe("Offer");
    expect(stageForStatus("started")).toBe("Placed");
    expect(stageForStatus("declined")).toBeNull();
  });
});

describe("invoices and timesheets", () => {
  it("totals lines with VAT", () => {
    expect(invoiceTotals([{ description: "Fee", quantity: 1, unitPrice: 9900 }], 20)).toMatchObject({ subtotal: 9900, vatAmount: 1980, total: 11880 });
    expect(invoiceTotals([{ quantity: 37.5, unitPrice: 55 }], 0)).toMatchObject({ subtotal: 2062.5, total: 2062.5 });
  });

  it("numbers invoices", () => {
    expect(nextInvoiceNumber([], "HX")).toBe("HX-0001");
    expect(nextInvoiceNumber(["HX-0009", "HX-0012", "OLD-3"], "HX")).toBe("HX-0013");
  });

  it("finds the Monday", () => {
    expect(weekStarting("2026-10-01")).toBe("2026-09-28");
    expect(weekStarting("2026-09-28")).toBe("2026-09-28");
  });
});
