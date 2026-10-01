"use client";

// /dashboard/settings/invoicing - what goes on every invoice
// (app/api/invoicing-settings): the agency's name, address and registration
// numbers, bank details, number prefix, VAT rate and default payment terms.

import { useCallback, useEffect, useState } from "react";
import { getInvoicingSettings, saveInvoicingSettings } from "@/lib/dashboard-api";
import { Page, PageHeader, Card, Button, ErrorState, ErrorText, Field, LoadingCard, TextArea, TextInput, INK_MUTED } from "@/components/dashboard/ui";

const FIELDS = ["companyName", "address", "email", "companyNumber", "vatNumber", "bankDetails", "prefix", "vatRate", "paymentTermsDays"];

export default function InvoicingSettingsPage() {
  const [status, setStatus] = useState("loading");
  const [canManage, setCanManage] = useState(false);
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getInvoicingSettings()
      .then((d) => {
        if (cancelled) return;
        setF(Object.fromEntries(FIELDS.map((k) => [k, d[k] ?? ""])));
        setCanManage(d.canManage);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveInvoicingSettings({ ...f, vatRate: Number(f.vatRate), paymentTermsDays: Number(f.paymentTermsDays) });
      setNotice("Saved. New invoices will use these details.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Page width={860}>
      <PageHeader
        back={{ href: "/dashboard/settings", label: "Settings" }}
        eyebrow="Revenue"
        title="Invoice settings"
        subtitle="Your details on every invoice raised from a placement. A client's own payment terms (on their Clients page) win over the default here."
      />
      {status === "loading" && <LoadingCard rows={6} />}
      {status === "error" && <ErrorState title="Unable to load invoice settings" onRetry={retry} />}
      {status === "ready" && (
        <form onSubmit={save} className="space-y-6">
          {!canManage && (
            <p className="text-[13px]" style={{ color: INK_MUTED }}>
              Only the workspace owner or an admin can change these.
            </p>
          )}
          <fieldset disabled={!canManage || saving} className="space-y-6">
            <Card title="Your company">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Company name">
                  <TextInput maxLength={200} value={f.companyName} onChange={set("companyName")} />
                </Field>
                <Field label="Accounts email">
                  <TextInput type="email" maxLength={254} value={f.email} onChange={set("email")} />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <TextArea rows={3} maxLength={500} value={f.address} onChange={set("address")} />
                </Field>
                <Field label="Company number">
                  <TextInput maxLength={40} value={f.companyNumber} onChange={set("companyNumber")} />
                </Field>
                <Field label="VAT number">
                  <TextInput maxLength={40} value={f.vatNumber} onChange={set("vatNumber")} />
                </Field>
              </div>
            </Card>
            <Card title="Billing">
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Number prefix" hint={`Next looks like ${f.prefix || "INV"}-0001`}>
                  <TextInput maxLength={10} value={f.prefix} onChange={(e) => setF((v) => ({ ...v, prefix: e.target.value.replace(/[^A-Za-z0-9-]/g, "") }))} />
                </Field>
                <Field label="VAT rate %" hint="0 if you aren't VAT registered">
                  <TextInput type="number" min="0" max="100" step="0.5" value={f.vatRate} onChange={set("vatRate")} />
                </Field>
                <Field label="Payment terms (days)">
                  <TextInput type="number" min="0" max="365" step="1" value={f.paymentTermsDays} onChange={set("paymentTermsDays")} />
                </Field>
                <Field label="Bank details" className="sm:col-span-3" hint="Printed at the bottom of every invoice.">
                  <TextArea rows={3} maxLength={500} value={f.bankDetails} onChange={set("bankDetails")} placeholder={"Account name\nSort code 00-00-00\nAccount 12345678"} />
                </Field>
              </div>
            </Card>
          </fieldset>
          <ErrorText>{error}</ErrorText>
          {notice && (
            <p className="text-[12px]" role="status" style={{ color: "var(--forest)" }}>
              {notice}
            </p>
          )}
          {canManage && (
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </form>
      )}
    </Page>
  );
}
