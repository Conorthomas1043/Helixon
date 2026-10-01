// An agency's invoice details, kept in agencies.settings.invoicing: what
// goes at the top and bottom of every invoice, the number prefix, VAT rate
// and payment terms.

import { cleanLine, cleanText } from "@/lib/sanitize";
import { DEFAULT_VAT_RATE } from "@/lib/placements";

export function normaliseInvoicing(settings) {
  const s = settings?.invoicing || {};
  return {
    companyName: s.companyName || "",
    address: s.address || "",
    vatNumber: s.vatNumber || "",
    companyNumber: s.companyNumber || "",
    email: s.email || "",
    bankDetails: s.bankDetails || "",
    prefix: s.prefix || "INV",
    vatRate: Number.isFinite(s.vatRate) ? s.vatRate : DEFAULT_VAT_RATE,
    paymentTermsDays: Number.isInteger(s.paymentTermsDays) ? s.paymentTermsDays : 30,
  };
}

export function cleanInvoicing(body = {}) {
  const vatRate = Number(body.vatRate);
  const terms = Number(body.paymentTermsDays);
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return { error: "VAT rate must be 0–100%." };
  if (!Number.isInteger(terms) || terms < 0 || terms > 365) return { error: "Payment terms must be 0–365 days." };
  return {
    companyName: cleanLine(body.companyName, 200),
    address: cleanText(body.address, { max: 500 }),
    vatNumber: cleanLine(body.vatNumber, 40),
    companyNumber: cleanLine(body.companyNumber, 40),
    email: cleanLine(body.email, 254),
    bankDetails: cleanText(body.bankDetails, { max: 500 }),
    prefix: cleanLine(body.prefix, 10).replace(/[^A-Za-z0-9-]/g, "") || "INV",
    vatRate,
    paymentTermsDays: terms,
  };
}
