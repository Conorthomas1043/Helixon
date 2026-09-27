export function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    let s = String(val ?? "");
    // A cell starting with =, +, -, @, tab or CR is interpreted as a formula
    // by Excel/Sheets when the CSV is opened - prefix it with a leading
    // apostrophe so it's forced to render as text instead of executing.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// lib/csv.js
// Small, dependency-free CSV reader for the employee cold-call list import.
// Handles quoted fields (with embedded commas, newlines and "" escapes),
// CRLF/LF line endings, a UTF-8 BOM, and semicolon- or tab-separated
// exports (Excel in some locales saves "CSV" with semicolons).

export function parseCsv(text) {
  const input = String(text || "").replace(/^﻿/, "");
  const delimiter = detectDelimiter(input);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows
    .map((r) => r.map((cell) => cell.trim()))
    .filter((r) => r.some((cell) => cell !== ""));
}

// Picks whichever of , ; or tab appears most on the first line, outside quotes.
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ",";
}

// Header names people actually use in lead spreadsheets, per field.
const FIELD_ALIASES = {
  contact_name: ["name", "contact", "contact name", "full name", "fullname", "person", "lead", "lead name", "client name"],
  first_name: ["first name", "firstname", "first", "forename", "given name"],
  last_name: ["last name", "lastname", "last", "surname", "family name"],
  company: ["company", "company name", "business", "business name", "organisation", "organization", "org", "agency", "firm", "account"],
  phone: ["phone", "phone number", "number", "telephone", "tel", "mobile", "mobile number", "cell", "contact number", "direct dial", "landline"],
  email: ["email", "email address", "e-mail", "mail"],
  notes: ["notes", "note", "comments", "comment", "info", "details", "description"],
};

function normaliseHeader(h) {
  return String(h || "").toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
}

// Maps header cells to field names. Returns { mapping, hasHeader } where
// mapping is { field: columnIndex }. If the first row doesn't look like a
// header at all, falls back to name, company, phone column order.
export function mapColumns(headerRow) {
  const mapping = {};
  (headerRow || []).forEach((cell, index) => {
    const h = normaliseHeader(cell);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (mapping[field] === undefined && aliases.includes(h)) {
        mapping[field] = index;
        return;
      }
    }
  });
  // Looser second pass: "Mobile (UK)", "Work Phone", "Company Name Ltd" …
  (headerRow || []).forEach((cell, index) => {
    if (Object.values(mapping).includes(index)) return;
    const h = normaliseHeader(cell);
    if (mapping.phone === undefined && /(phone|mobile|tel|number)/.test(h)) mapping.phone = index;
    else if (mapping.email === undefined && /mail/.test(h)) mapping.email = index;
    else if (mapping.company === undefined && /(company|business|organi[sz]ation)/.test(h)) mapping.company = index;
  });

  const hasHeader = Object.keys(mapping).length > 0;
  if (!hasHeader) return { mapping: { contact_name: 0, company: 1, phone: 2 }, hasHeader: false };
  return { mapping, hasHeader };
}

// Keeps a leading +, drops everything else that isn't a digit. Used only for
// de-duplication - the number is stored as typed so it still reads naturally.
export function phoneKey(phone) {
  const s = String(phone || "").trim();
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  // Treat 07… and +447… / 447… as the same UK number.
  if (digits.startsWith("44") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

const MAX_LEN = { contact_name: 120, company: 120, phone: 40, email: 160, notes: 500 };

// Turns CSV text into contact rows ready for the call list.
// Returns { contacts, skipped, mapping, hasHeader, duplicates }.
export function contactsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { contacts: [], skipped: 0, duplicates: 0, mapping: {}, hasHeader: false };

  const { mapping, hasHeader } = mapColumns(rows[0]);
  const body = hasHeader ? rows.slice(1) : rows;
  const cell = (row, field) => (mapping[field] === undefined ? "" : row[mapping[field]] || "");

  const seen = new Set();
  const contacts = [];
  let skipped = 0;
  let duplicates = 0;

  for (const row of body) {
    let name = cell(row, "contact_name");
    if (!name) name = [cell(row, "first_name"), cell(row, "last_name")].filter(Boolean).join(" ");
    const contact = {
      contact_name: name,
      company: cell(row, "company"),
      phone: cell(row, "phone"),
      email: cell(row, "email"),
      notes: cell(row, "notes"),
    };
    for (const [key, max] of Object.entries(MAX_LEN)) contact[key] = contact[key].slice(0, max);

    // Nothing to call → nothing to import.
    if (!phoneKey(contact.phone)) {
      skipped++;
      continue;
    }
    const key = phoneKey(contact.phone);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    contacts.push(contact);
  }

  return { contacts, skipped, duplicates, mapping, hasHeader };
}
