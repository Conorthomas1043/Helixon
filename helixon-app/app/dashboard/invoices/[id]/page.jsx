"use client";

// /dashboard/invoices/[id] - one invoice laid out to print or save as PDF
// and send to the client, with the agency's details from Invoice settings.

import { use, useCallback, useEffect, useRef, useState } from "react";
import { getInvoice, updateInvoice } from "@/lib/dashboard-api";
import { printSection } from "@/lib/print";
import { Page, PageHeader, Button, ErrorState, ErrorText, LoadingCard, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";
import { InvoiceStatusPill } from "@/components/dashboard/placements";

function money(value, currency) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" }).format(Number(value) || 0);
}

function longDate(d) {
  if (!d) return "";
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function Lines({ text }) {
  return String(text || "")
    .split("\n")
    .filter(Boolean)
    .map((line, i) => <div key={i}>{line}</div>);
}

export default function InvoicePage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const docRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getInvoice(id)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
      })
      .catch((err) => {
        if (!cancelled) setStatus(err.message === "Not found" ? "not-found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const setInvoiceStatus = useCallback(
    async (next) => {
      setError(null);
      if (next === "void" && !window.confirm("Void this invoice? It stays on record, marked void.")) return;
      try {
        await updateInvoice(id, { status: next });
        setReloadKey((k) => k + 1);
      } catch (err) {
        setError(err.message);
      }
    },
    [id]
  );

  if (status === "loading") {
    return (
      <Page width={900}>
        <LoadingCard rows={8} />
      </Page>
    );
  }
  if (status !== "ready") {
    return (
      <Page width={900}>
        <ErrorState title={status === "not-found" ? "Invoice not found" : "Couldn't load the invoice"} onRetry={status === "error" ? () => setReloadKey((k) => k + 1) : undefined} />
      </Page>
    );
  }

  const { invoice: inv, from } = data;
  const missingDetails = !from.address || !from.bankDetails;

  return (
    <Page width={900}>
      <PageHeader
        back={{ href: "/dashboard/placements", label: "Placements & invoices" }}
        title={`Invoice ${inv.number}`}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <InvoiceStatusPill invoice={inv} /> {inv.paid_on ? `Paid ${longDate(inv.paid_on)}` : inv.due_on ? `Due ${longDate(inv.due_on)}` : ""}
          </span>
        }
        actions={
          <>
            {inv.status === "sent" && (
              <Button variant="primary" onClick={() => setInvoiceStatus("paid")}>
                Mark paid
              </Button>
            )}
            {inv.status === "paid" && <Button onClick={() => setInvoiceStatus("sent")}>Mark unpaid</Button>}
            {inv.status !== "void" && (
              <Button variant="danger" onClick={() => setInvoiceStatus("void")}>
                Void
              </Button>
            )}
            <Button onClick={() => printSection(docRef.current)}>Print / save PDF</Button>
          </>
        }
      />
      <ErrorText>{error}</ErrorText>
      {missingDetails && (
        <p className="text-[12px]" style={{ color: INK_MUTED }}>
          Your address or bank details aren&apos;t on this invoice yet - add them in{" "}
          <a href="/dashboard/settings/invoicing" className="underline">
            Invoice settings
          </a>
          .
        </p>
      )}

      <div ref={docRef} className="bg-white rounded-[14px] p-8 sm:p-12" style={{ border: "1px solid var(--border)", color: INK }}>
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div className="text-[13px] leading-relaxed">
            <p className="text-lg font-semibold mb-1">{from.companyName}</p>
            <Lines text={from.address} />
            {from.email && <div>{from.email}</div>}
            {from.companyNumber && <div>Company no. {from.companyNumber}</div>}
            {from.vatNumber && <div>VAT no. {from.vatNumber}</div>}
          </div>
          <div className="sm:text-right">
            <p className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {inv.status === "void" ? "VOID" : "Invoice"}
            </p>
            <dl className="text-[13px] mt-2 space-y-0.5">
              <div>
                <dt className="inline" style={{ color: INK_MUTED }}>Number </dt>
                <dd className="inline font-semibold">{inv.number}</dd>
              </div>
              <div>
                <dt className="inline" style={{ color: INK_MUTED }}>Date </dt>
                <dd className="inline">{longDate(inv.issued_on)}</dd>
              </div>
              {inv.due_on && (
                <div>
                  <dt className="inline" style={{ color: INK_MUTED }}>Due </dt>
                  <dd className="inline">{longDate(inv.due_on)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="mt-8 text-[13px] leading-relaxed">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
            Bill to
          </p>
          <p className="font-semibold">{inv.bill_to?.name}</p>
          {inv.bill_to?.contact && <div>FAO {inv.bill_to.contact}</div>}
          <Lines text={inv.bill_to?.address} />
          {inv.bill_to?.email && <div>{inv.bill_to.email}</div>}
        </div>

        <table className="w-full text-[13px] mt-8">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest" style={{ color: INK_FAINT, borderBottom: "1px solid var(--border)" }}>
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 font-semibold text-right w-20">Qty</th>
              <th className="py-2 font-semibold text-right w-28">Rate</th>
              <th className="py-2 font-semibold text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(inv.lines || []).map((l, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2.5 pr-3">{l.description}</td>
                <td className="py-2.5 text-right tabular-nums">{l.quantity}</td>
                <td className="py-2.5 text-right tabular-nums">{money(l.unitPrice, inv.currency)}</td>
                <td className="py-2.5 text-right tabular-nums">{money(l.amount, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 w-full max-w-[260px] text-[13px] space-y-1">
          <div className="flex justify-between">
            <dt style={{ color: INK_MUTED }}>Subtotal</dt>
            <dd className="tabular-nums">{money(inv.subtotal, inv.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: INK_MUTED }}>VAT ({Number(inv.vat_rate)}%)</dt>
            <dd className="tabular-nums">{money(inv.vat_amount, inv.currency)}</dd>
          </div>
          <div className="flex justify-between font-semibold text-base pt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <dt>Total</dt>
            <dd className="tabular-nums">{money(inv.total, inv.currency)}</dd>
          </div>
        </dl>

        {(from.bankDetails || inv.notes) && (
          <div className="mt-10 text-[12px] leading-relaxed space-y-3" style={{ color: INK_MUTED }}>
            {from.bankDetails && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
                  Payment details
                </p>
                <Lines text={from.bankDetails} />
                <div>Please quote {inv.number} as the reference.</div>
              </div>
            )}
            {inv.notes && <Lines text={inv.notes} />}
          </div>
        )}
      </div>
    </Page>
  );
}
