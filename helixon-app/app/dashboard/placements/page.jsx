"use client";

// /dashboard/placements - every offer and placement across the agency, and
// the invoices raised from them: fees banked, what's unpaid or overdue,
// who's still inside a rebate period, and contractors on assignment.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAccountingExport, getInvoices, getPlacements, updateInvoice } from "@/lib/dashboard-api";
import { downloadCsv } from "@/lib/csv";
import { PLACEMENT_STATUSES, contractMargin } from "@/lib/placements";
import { Page, PageHeader, Card, Button, EmptyState, ErrorState, LoadingCard, Select, ErrorText, formatMoney, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";
import { InvoiceStatusPill, PlacementItem } from "@/components/dashboard/placements";

function Stat({ label, value, hint, tone }) {
  return (
    <div className="rounded-[12px] px-4 py-3" style={{ background: "white", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: INK_FAINT }}>
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums mt-0.5" style={{ color: tone || INK }}>
        {value}
      </p>
      {hint && (
        <p className="text-[11px]" style={{ color: INK_MUTED }}>
          {hint}
        </p>
      )}
    </div>
  );
}

const sum = (list, f) => list.reduce((s, x) => s + (Number(f(x)) || 0), 0);

export default function PlacementsPage() {
  // ?tab=invoices and ?kind=contract (links from the Overview's alerts).
  // Nothing here renders before the data loads, so reading the URL up
  // front can't make the server and client renders differ.
  const query = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(() => (query?.get("tab") === "invoices" ? "invoices" : "placements"));
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState(() => (query?.get("kind") === "contract" ? "contract" : "all"));
  const [invoiceFilter, setInvoiceFilter] = useState("unpaid");
  const [invoiceError, setInvoiceError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Invoices are refused (403) for members when money is admin-only.
    Promise.all([getPlacements(), getInvoices().catch(() => [])])
      .then(([placements, invoices]) => {
        if (!cancelled) {
          setData({ placements, invoices, today: new Date().toISOString().slice(0, 10), financialsHidden: Boolean(placements?.financialsHidden) });
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const stats = useMemo(() => {
    if (!data) return null;
    const { placements, invoices, today } = data;
    const year = today.slice(0, 4);
    const live = invoices.filter((i) => i.status !== "void");
    const unpaid = live.filter((i) => i.status === "sent");
    const overdue = unpaid.filter((i) => i.due_on && i.due_on < today);
    const paidThisYear = live.filter((i) => i.status === "paid" && String(i.paid_on || "").startsWith(year));
    const perm = placements.filter((p) => p.kind === "permanent" && ["accepted", "started", "completed"].includes(p.status));
    const permThisYear = perm.filter((p) => String(p.startDate || p.offerDate || p.createdAt || "").startsWith(year));
    const rebate = perm.filter((p) => p.rebateUntil && p.rebateUntil >= today && p.status !== "completed");
    const contractors = placements.filter((p) => p.kind === "contract" && p.status === "started");
    const pendingOffers = placements.filter((p) => p.status === "offered");
    return {
      feesThisYear: sum(permThisYear, (p) => p.feeAmount),
      permCount: permThisYear.length,
      paidThisYear: sum(paidThisYear, (i) => i.total),
      unpaid: sum(unpaid, (i) => i.total),
      unpaidCount: unpaid.length,
      overdue: sum(overdue, (i) => i.total),
      overdueCount: overdue.length,
      rebateCount: rebate.length,
      rebateValue: sum(rebate, (p) => p.feeAmount),
      contractors: contractors.length,
      weeklyMargin: contractors.reduce((s, p) => s + (contractMargin(p.payRate, p.chargeRate)?.margin || 0) * (p.rateUnit === "day" ? 5 : 37.5), 0),
      pendingOffers: pendingOffers.length,
    };
  }, [data]);

  const placements = useMemo(
    () => (data?.placements || []).filter((p) => (status === "all" || p.status === status) && (kind === "all" || p.kind === kind)),
    [data, status, kind]
  );
  const invoices = useMemo(() => {
    const list = data?.invoices || [];
    const today = data?.today;
    if (invoiceFilter === "unpaid") return list.filter((i) => i.status === "sent");
    if (invoiceFilter === "overdue") return list.filter((i) => i.status === "sent" && i.due_on && i.due_on < today);
    if (invoiceFilter === "all") return list;
    return list.filter((i) => i.status === invoiceFilter);
  }, [data, invoiceFilter]);

  async function setInvoiceStatus(id, next) {
    setInvoiceError(null);
    if (next === "void" && !window.confirm("Void this invoice? Contract timesheets on it go back to approved so they can be invoiced again.")) return;
    try {
      await updateInvoice(id, { status: next });
      reload();
    } catch (err) {
      setInvoiceError(err.message);
    }
  }

  async function exportFor(format) {
    if (!format) return;
    setExporting(true);
    setExportNote("");
    try {
      const rows = await getAccountingExport(format);
      if (!rows.length) setExportNote(format === "payroll" ? "No approved timesheets to export yet." : "No sent or paid invoices to export yet.");
      else downloadCsv(`${format === "payroll" ? "payroll" : `invoices-${format}`}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    } catch (err) {
      setExportNote(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Revenue"
        title="Placements & invoices"
        subtitle="Offers, starts, fees and contractors - and the invoices raised from them. Record an offer from a candidate's profile."
        actions={
          <>
            {!data?.financialsHidden && (
              <Select
                aria-label="Export for your accounts"
                value=""
                onChange={(e) => exportFor(e.target.value)}
                options={[
                  { value: "", label: exporting ? "Exporting…" : "Export…" },
                  { value: "xero", label: "Invoices for Xero (CSV)" },
                  { value: "quickbooks", label: "Invoices for QuickBooks (CSV)" },
                  { value: "payroll", label: "Contractor payroll (CSV)" },
                ]}
                disabled={exporting}
                style={{ width: "auto" }}
              />
            )}
            <Button href="/dashboard/settings/invoicing" size="sm">
              Invoice settings
            </Button>
          </>
        }
      />
      {exportNote && <p className="text-[12px]" style={{ color: INK_MUTED }}>{exportNote}</p>}

      {error ? (
        <ErrorState body="Placements couldn't be loaded." onRetry={reload} />
      ) : !data ? (
        <LoadingCard rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Perm fees this year" value={formatMoney(stats.feesThisYear)} hint={`${stats.permCount} placement${stats.permCount === 1 ? "" : "s"}`} />
            <Stat label="Paid this year" value={formatMoney(stats.paidThisYear)} />
            <Stat label="Unpaid" value={formatMoney(stats.unpaid)} hint={`${stats.unpaidCount} invoice${stats.unpaidCount === 1 ? "" : "s"}`} />
            <Stat
              label="Overdue"
              value={formatMoney(stats.overdue)}
              hint={`${stats.overdueCount} invoice${stats.overdueCount === 1 ? "" : "s"}`}
              tone={stats.overdueCount ? "var(--score-low)" : undefined}
            />
            <Stat label="In rebate period" value={stats.rebateCount} hint={stats.rebateCount ? `${formatMoney(stats.rebateValue)} of fees at risk` : "None at risk"} />
            <Stat label="Contractors working" value={stats.contractors} hint={stats.contractors ? `~${formatMoney(stats.weeklyMargin)} margin a week` : null} />
            <Stat label="Offers pending" value={stats.pendingOffers} />
          </div>

          <div className="flex gap-2" role="tablist">
            {[
              ["placements", `Placements (${data.placements.length})`],
              ["invoices", `Invoices (${data.invoices.length})`],
            ].map(([key, label]) => (
              <Button key={key} variant={tab === key ? "primary" : "secondary"} size="sm" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
                {label}
              </Button>
            ))}
          </div>

          {tab === "placements" ? (
            <Card
              title="Placements"
              action={
                <div className="flex gap-2">
                  <Select
                    aria-label="Status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    options={[{ value: "all", label: "Any status" }, ...Object.entries(PLACEMENT_STATUSES).map(([value, label]) => ({ value, label }))]}
                  />
                  <Select
                    aria-label="Type"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    options={[
                      { value: "all", label: "Perm & contract" },
                      { value: "permanent", label: "Permanent" },
                      { value: "contract", label: "Contract" },
                    ]}
                  />
                </div>
              }
            >
              {placements.length === 0 ? (
                <EmptyState title="No placements here" body="Open a candidate and use “Record offer” in their Offer & placement card." />
              ) : (
                <ul className="divide-y -my-3.5" style={{ borderColor: "var(--border)" }}>
                  {placements.map((p) => (
                    <PlacementItem key={p.id} placement={p} showCandidate onChanged={reload} />
                  ))}
                </ul>
              )}
            </Card>
          ) : (
            <Card
              title="Invoices"
              action={
                <Select
                  aria-label="Show"
                  value={invoiceFilter}
                  onChange={(e) => setInvoiceFilter(e.target.value)}
                  options={[
                    { value: "unpaid", label: "Unpaid" },
                    { value: "overdue", label: "Overdue" },
                    { value: "paid", label: "Paid" },
                    { value: "void", label: "Void" },
                    { value: "all", label: "All" },
                  ]}
                />
              }
            >
              <ErrorText>{invoiceError}</ErrorText>
              {invoices.length === 0 ? (
                <p className="text-[13px]" style={{ color: INK_MUTED }}>
                  No invoices here.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-5 sm:-mx-6">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest" style={{ color: INK_FAINT }}>
                        <th className="px-5 sm:px-6 py-2 font-semibold">Number</th>
                        <th className="px-2 py-2 font-semibold">Client</th>
                        <th className="px-2 py-2 font-semibold">Issued</th>
                        <th className="px-2 py-2 font-semibold">Due</th>
                        <th className="px-2 py-2 font-semibold text-right">Total</th>
                        <th className="px-2 py-2 font-semibold">Status</th>
                        <th className="px-5 sm:px-6 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((i) => (
                        <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td className="px-5 sm:px-6 py-2.5">
                            <Link href={`/dashboard/invoices/${i.id}`} className="font-semibold hover:underline" style={{ color: "var(--forest)" }}>
                              {i.number}
                            </Link>
                          </td>
                          <td className="px-2 py-2.5" style={{ color: INK }}>
                            {i.client_id ? (
                              <Link href={`/dashboard/clients/${i.client_id}`} className="hover:underline">
                                {i.bill_to?.name || "Client"}
                              </Link>
                            ) : (
                              i.bill_to?.name || "-"
                            )}
                          </td>
                          <td className="px-2 py-2.5 tabular-nums" style={{ color: INK_MUTED }}>
                            {i.issued_on}
                          </td>
                          <td className="px-2 py-2.5 tabular-nums" style={{ color: INK_MUTED }}>
                            {i.due_on || "-"}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: INK }}>
                            {formatMoney(i.total, i.currency)}
                          </td>
                          <td className="px-2 py-2.5">
                            <InvoiceStatusPill invoice={i} />
                          </td>
                          <td className="px-5 sm:px-6 py-2.5 text-right whitespace-nowrap">
                            {i.status === "sent" && (
                              <Button size="sm" variant="primary" onClick={() => setInvoiceStatus(i.id, "paid")}>
                                Mark paid
                              </Button>
                            )}
                            {i.status === "paid" && (
                              <Button size="sm" variant="ghost" onClick={() => setInvoiceStatus(i.id, "sent")}>
                                Mark unpaid
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
