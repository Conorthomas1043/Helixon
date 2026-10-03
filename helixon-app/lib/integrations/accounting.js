// Pushing invoices to Xero / QuickBooks and reading back whether they've
// been paid. Payloads: accounting-payloads.js. Connections: store.js.

import { accessToken } from "@/lib/integrations/store";
import {
  qbString,
  quickbooksInvoicePayload,
  quickbooksInvoiceState,
  sameName,
  xeroInvoicePayload,
  xeroInvoiceState,
} from "@/lib/integrations/accounting-payloads";

export const ACCOUNTING_PROVIDERS = ["xero", "quickbooks"];

const XERO_API = "https://api.xero.com/api.xro/2.0";

function qbBase(realmId) {
  const host = process.env.QUICKBOOKS_ENVIRONMENT === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
  return `${host}/v3/company/${encodeURIComponent(realmId)}`;
}

async function call(url, { token, method = "GET", body, headers = {} }) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      data?.Elements?.[0]?.ValidationErrors?.map((e) => e.Message).join("; ") || // Xero
      data?.Fault?.Error?.map((e) => e.Detail || e.Message).join("; ") || // QuickBooks
      data?.Message ||
      data?.message ||
      `HTTP ${res.status}`;
    throw new Error(String(detail).slice(0, 500));
  }
  return data;
}

// --- Account details at connect time ---------------------------------------

// The first Xero organisation the user authorised: { id, name }.
export async function xeroTenant(token) {
  const res = await fetch("https://api.xero.com/connections", { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const list = await res.json().catch(() => []);
  const org = Array.isArray(list) ? list.find((c) => c.tenantType === "ORGANISATION") || list[0] : null;
  if (!org) throw new Error("No Xero organisation was authorised.");
  return { id: org.tenantId, name: org.tenantName };
}

export async function quickbooksCompany(token, realmId) {
  try {
    const data = await call(`${qbBase(realmId)}/companyinfo/${encodeURIComponent(realmId)}?minorversion=75`, { token });
    return { id: realmId, name: data?.CompanyInfo?.CompanyName || null };
  } catch {
    return { id: realmId, name: null };
  }
}

// --- Xero --------------------------------------------------------------------

async function xeroContact(token, tenant, billTo) {
  const name = String(billTo?.name || "Client").slice(0, 255);
  const headers = { "Xero-tenant-id": tenant };
  const found = await call(`${XERO_API}/Contacts?searchTerm=${encodeURIComponent(name)}`, { token, headers });
  const match = (found?.Contacts ?? []).find((c) => sameName(c.Name, name));
  if (match) return match.ContactID;
  const created = await call(`${XERO_API}/Contacts`, {
    token,
    headers,
    method: "POST",
    body: { Contacts: [{ Name: name, ...(billTo?.email ? { EmailAddress: String(billTo.email) } : {}) }] },
  });
  return created?.Contacts?.[0]?.ContactID;
}

async function xeroPush(conn, invoice) {
  const token = await accessToken(conn);
  const contactId = await xeroContact(token, conn.account_id, invoice.bill_to);
  if (!contactId) throw new Error("Xero didn't create the contact.");
  const data = await call(`${XERO_API}/Invoices`, { token, headers: { "Xero-tenant-id": conn.account_id }, method: "POST", body: xeroInvoicePayload(invoice, contactId) });
  const id = data?.Invoices?.[0]?.InvoiceID;
  if (!id) throw new Error("Xero didn't return the invoice.");
  return id;
}

async function xeroState(conn, externalId) {
  const token = await accessToken(conn);
  const data = await call(`${XERO_API}/Invoices/${encodeURIComponent(externalId)}`, { token, headers: { "Xero-tenant-id": conn.account_id } });
  return xeroInvoiceState(data?.Invoices?.[0]);
}

// --- QuickBooks ----------------------------------------------------------------

async function quickbooksCustomer(token, realmId, billTo) {
  const name = String(billTo?.name || "Client").slice(0, 100);
  const query = `select * from Customer where DisplayName = ${qbString(name)}`;
  const found = await call(`${qbBase(realmId)}/query?query=${encodeURIComponent(query)}&minorversion=75`, { token });
  const match = (found?.QueryResponse?.Customer ?? [])[0];
  if (match) return match.Id;
  const created = await call(`${qbBase(realmId)}/customer?minorversion=75`, {
    token,
    method: "POST",
    body: { DisplayName: name, ...(billTo?.email ? { PrimaryEmailAddr: { Address: String(billTo.email) } } : {}) },
  });
  return created?.Customer?.Id;
}

async function quickbooksPush(conn, invoice) {
  const token = await accessToken(conn);
  const customerId = await quickbooksCustomer(token, conn.account_id, invoice.bill_to);
  if (!customerId) throw new Error("QuickBooks didn't create the customer.");
  const data = await call(`${qbBase(conn.account_id)}/invoice?minorversion=75`, { token, method: "POST", body: quickbooksInvoicePayload(invoice, customerId) });
  const id = data?.Invoice?.Id;
  if (!id) throw new Error("QuickBooks didn't return the invoice.");
  return id;
}

async function quickbooksState(conn, externalId) {
  const token = await accessToken(conn);
  const data = await call(`${qbBase(conn.account_id)}/invoice/${encodeURIComponent(externalId)}?minorversion=75`, { token });
  return quickbooksInvoiceState(data?.Invoice);
}

// --- Shared ----------------------------------------------------------------------

// Creates the invoice in the connected package; resolves its id there.
export function pushInvoice(conn, invoice) {
  return conn.provider === "xero" ? xeroPush(conn, invoice) : quickbooksPush(conn, invoice);
}

// { paid, paidOn, voided } for an invoice already pushed.
export function invoiceState(conn, externalId) {
  return conn.provider === "xero" ? xeroState(conn, externalId) : quickbooksState(conn, externalId);
}
