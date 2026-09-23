#!/usr/bin/env node
// scripts/fill-missing-data.js
//
// Fills in missing PHONE NUMBERS and WEBSITES in a lead / company sheet.
// Takes a CSV file or a Google Sheets link, never overwrites a value that's
// already there, and writes a new CSV with a "Filled By" column saying where
// each filled value came from so it can be spot-checked before use.
//
// Usage:
//   node scripts/fill-missing-data.js <sheet-url | sheet-id | file.csv> [options]
//
//   node scripts/fill-missing-data.js "https://docs.google.com/spreadsheets/d/<id>/htmlview"
//   node scripts/fill-missing-data.js leads.csv --out leads-filled.csv --limit 20
//
// Options:
//   --out <file>     Output CSV (default: <input>-filled.csv, or sheet-filled.csv)
//   --gid <n>        Tab of a Google Sheet to read (default: first tab)
//   --limit <n>      Only process the first n rows that are missing something
//   --no-scrape      Don't visit company websites to look for phone numbers
//   --no-osm         Don't use the OpenStreetMap fallback lookup
//   --dry-run        Print what would be filled, don't write a file
//
// Where the data comes from, in order (first hit wins, per field):
//   1. Email domain   - a business email in the row (jane@acme.co.uk) gives
//                       the website (acme.co.uk). Free, offline, reliable.
//                       Gmail/Outlook/etc. addresses are ignored.
//   2. Google Places  - only if GOOGLE_PLACES_API_KEY is set. Best source for
//                       both phone and website. Results are only used when the
//                       business name matches the row's company name.
//   3. Website scrape - fetches the company's homepage and contact page and
//                       takes the phone number from tel: links (or text right
//                       next to "Tel"/"Phone"/"Call").
//   4. OpenStreetMap  - free Nominatim lookup, rate limited to 1 req/sec.
//                       Coverage is patchy but it costs nothing.
//
// Columns are detected by header name (Company/Business/Name, Phone/Tel/
// Mobile, Website/URL/Domain, Email, City/Address/Postcode/Country...). If the
// sheet has no Phone or Website column, one is added. The Google Sheet must
// be shared as "Anyone with the link can view" for the download to work.
//
// Needs Node 18+ (built-in fetch). No npm dependencies.

const fs = require("fs");
const path = require("path");

const USER_AGENT = "HelixonDataFill/1.0 (+https://helixon.app)";
const FETCH_TIMEOUT_MS = 12000;

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk",
  "live.com", "live.co.uk", "msn.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com", "proton.me",
  "gmx.com", "gmx.co.uk", "mail.com", "zoho.com", "btinternet.com",
  "sky.com", "virginmedia.com", "talktalk.net", "ntlworld.com", "fastmail.com",
]);

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function toCsv(rows) {
  const escape = (val) => {
    let s = String(val ?? "");
    // Same formula-injection guard as lib/csv.js - but a phone number like
    // +44 ... is legitimate data, so only guard the non-phone cases.
    if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^\+?[\d\s().-]+$/.test(s))) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(escape).join(",")).join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Column detection
// ---------------------------------------------------------------------------

function findColumn(headers, patterns, exclude = []) {
  const norm = headers.map((h) => h.toLowerCase().trim());
  for (const p of patterns) {
    const idx = norm.findIndex((h) => p.test(h) && !exclude.some((x) => x.test(h)));
    if (idx !== -1) return idx;
  }
  return -1;
}

function detectColumns(headers) {
  const name = findColumn(headers, [
    /^(company|business|organi[sz]ation|agency|firm|account|practice)( name)?$/,
    /company|business|organi[sz]ation|agency|firm|account name|employer/,
    /^name$/,
    /name/,
  ], [/contact|first|last|owner|person|file/]);
  const phone = findColumn(headers, [/phone|tel\b|telephone|mobile|landline|contact number|^number$/], [/type|status|called/]);
  const website = findColumn(headers, [/website|web site|url|domain|^web$|^site$|homepage/], [/linkedin|facebook|twitter|instagram|email/]);
  const email = findColumn(headers, [/e-?mail/]);
  const location = headers
    .map((h, i) => [h.toLowerCase(), i])
    .filter(([h]) => /address|city|town|location|postcode|post code|zip|county|state|region|country|area/.test(h))
    .map(([, i]) => i);
  return { name, phone, website, email, location };
}

// ---------------------------------------------------------------------------
// Normalising / matching
// ---------------------------------------------------------------------------

function isBlank(v) {
  return !v || /^(n\/?a|none|null|unknown|-+|tbc|\?)$/i.test(String(v).trim());
}

function normaliseWebsite(url) {
  if (!url) return "";
  let s = String(url).trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes(".")) return "";
    return `https://${host}${u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}

function websiteFromEmail(email) {
  const m = String(email || "").trim().toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!m || FREE_EMAIL_DOMAINS.has(m[1])) return "";
  return `https://${m[1].replace(/^(mail|email|mx)\./, "")}`;
}

function cleanPhone(raw) {
  if (!raw) return "";
  let s = String(raw);
  try { s = decodeURIComponent(s); } catch { /* keep as-is */ }
  s = s.replace(/^tel:/i, "").replace(/[^\d+()\s.-]/g, " ").trim();
  s = s.replace(/\s+/g, " ");
  const digits = s.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return "";
  if (/^(\d)\1+$/.test(digits)) return ""; // 0000000000 placeholders
  return s;
}

const NAME_STOPWORDS = new Set([
  "ltd", "limited", "llc", "inc", "plc", "llp", "co", "company", "corp",
  "corporation", "group", "the", "and", "of", "uk", "services", "solutions",
]);

function nameTokens(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NAME_STOPWORDS.has(t));
}

// Share of the sheet's company-name words that appear in the candidate.
function nameMatches(sheetName, candidate) {
  const a = nameTokens(sheetName);
  if (!a.length) return false;
  const b = new Set(nameTokens(candidate));
  const hit = a.filter((t) => b.has(t)).length;
  return hit / a.length >= 0.6;
}

function extractPhoneFromHtml(html) {
  const tel = [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map((m) => cleanPhone(m[1])).find(Boolean);
  if (tel) return tel;
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  const near = text.match(/(?:tel(?:ephone)?|phone|call(?: us)?)\s*[:.]?\s*((?:\+|\(?0)[\d\s().-]{8,20}\d)/i);
  return near ? cleanPhone(near[1]) : "";
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { "User-Agent": USER_AGENT, ...(opts.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

async function lookupGooglePlaces(name, location, apiKey) {
  const res = await fetchWithTimeout("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri",
    },
    body: JSON.stringify({ textQuery: [name, location].filter(Boolean).join(", "), pageSize: 3 }),
  });
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const place = (data.places || []).find((p) => nameMatches(name, p.displayName?.text));
  if (!place) return {};
  return {
    phone: cleanPhone(place.internationalPhoneNumber || place.nationalPhoneNumber),
    website: normaliseWebsite(place.websiteUri),
  };
}

let lastOsmCall = 0;
async function lookupOsm(name, location) {
  const wait = lastOsmCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastOsmCall = Date.now();
  const q = encodeURIComponent([name, location].filter(Boolean).join(", "));
  const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?q=${q}&format=jsonv2&extratags=1&namedetails=1&limit=5`);
  if (!res.ok) throw new Error(`OpenStreetMap HTTP ${res.status}`);
  const results = await res.json();
  for (const r of results) {
    if (!nameMatches(name, r.namedetails?.name || r.name || r.display_name)) continue;
    const t = r.extratags || {};
    const phone = cleanPhone(t.phone || t["contact:phone"]);
    const website = normaliseWebsite(t.website || t["contact:website"] || t.url);
    if (phone || website) return { phone, website };
  }
  return {};
}

async function scrapePhone(website) {
  for (const suffix of ["", "/contact", "/contact-us", "/contact.html"]) {
    try {
      const res = await fetchWithTimeout(website.replace(/\/$/, "") + suffix, { redirect: "follow" });
      if (!res.ok || !/html/i.test(res.headers.get("content-type") || "")) continue;
      const phone = extractPhoneFromHtml(await res.text());
      if (phone) return phone;
    } catch {
      // Unreachable site / timeout - try the next page.
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function sheetIdFrom(input) {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{30,}$/.test(input) ? input : null;
}

async function loadInput(input, gid) {
  if (fs.existsSync(input)) return fs.readFileSync(input, "utf8");
  const id = sheetIdFrom(input);
  if (!id) throw new Error(`"${input}" is neither a file nor a Google Sheets link`);
  const gidParam = gid ?? input.match(/[#&?]gid=(\d+)/)?.[1];
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gidParam ? `&gid=${gidParam}` : ""}`;
  const res = await fetchWithTimeout(url, { redirect: "follow" });
  const body = await res.text();
  if (!res.ok || /^\s*<!DOCTYPE html/i.test(body)) {
    throw new Error(`Couldn't download the sheet (HTTP ${res.status}). Make sure it's shared as "Anyone with the link can view", or export it to CSV and pass the file instead.`);
  }
  return body;
}

function parseArgs(argv) {
  const opts = { scrape: true, osm: true, dryRun: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a === "--gid") opts.gid = argv[++i];
    else if (a === "--limit") opts.limit = Number(argv[++i]);
    else if (a === "--no-scrape") opts.scrape = false;
    else if (a === "--no-osm") opts.osm = false;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else rest.push(a);
  }
  opts.input = rest[0];
  return opts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function fillRow(row, cols, opts, cache) {
  const name = (row[cols.name] || "").trim();
  const location = cols.location.map((i) => row[i]).filter((v) => !isBlank(v)).join(", ");
  const sources = [];
  let phone = isBlank(row[cols.phone]) ? "" : row[cols.phone];
  let website = isBlank(row[cols.website]) ? "" : row[cols.website];
  const needPhone = !phone;
  const needWebsite = !website;

  const take = (found, source) => {
    if (!found) return;
    if (!phone && found.phone) { phone = found.phone; sources.push(`phone: ${source}`); }
    if (!website && found.website) { website = found.website; sources.push(`website: ${source}`); }
  };

  if (!website && cols.email !== -1) take({ website: websiteFromEmail(row[cols.email]) }, "email domain");

  const key = `${name.toLowerCase()}|${location.toLowerCase()}`;
  if (name && (!phone || !website)) {
    if (!cache.has(key)) {
      const found = {};
      if (process.env.GOOGLE_PLACES_API_KEY) {
        try {
          found.google = await lookupGooglePlaces(name, location, process.env.GOOGLE_PLACES_API_KEY);
        } catch (e) {
          console.warn(`  ! Google Places failed for "${name}": ${e.message}`);
        }
      }
      cache.set(key, found);
    }
    take(cache.get(key).google, "Google Places");
  }

  if (!phone && website && opts.scrape) take({ phone: await scrapePhone(normaliseWebsite(website)) }, "company website");

  if (name && opts.osm && (!phone || !website)) {
    const cached = cache.get(key);
    if (!("osm" in cached)) {
      try {
        cached.osm = await lookupOsm(name, location);
      } catch (e) {
        cached.osm = {};
        console.warn(`  ! OpenStreetMap failed for "${name}": ${e.message}`);
      }
    }
    take(cached.osm, "OpenStreetMap");
    if (!phone && website && opts.scrape && sources.includes("website: OpenStreetMap")) {
      take({ phone: await scrapePhone(website) }, "company website");
    }
  }

  return { phone: needPhone ? phone : "", website: needWebsite ? website : "", sources };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.input) {
    console.log("Usage: node scripts/fill-missing-data.js <sheet-url | sheet-id | file.csv> [--out file.csv] [--gid n] [--limit n] [--no-scrape] [--no-osm] [--dry-run]");
    process.exit(opts.help ? 0 : 1);
  }

  const rows = parseCsv(await loadInput(opts.input, opts.gid));
  if (rows.length < 2) throw new Error("The sheet has no data rows");
  const headers = rows[0];
  const width = Math.max(...rows.map((r) => r.length));
  for (const r of rows) while (r.length < width) r.push("");

  const cols = detectColumns(headers);
  if (cols.name === -1) throw new Error(`Couldn't find a company/business name column in: ${headers.join(", ")}`);
  for (const [field, label] of [["phone", "Phone"], ["website", "Website"]]) {
    if (cols[field] === -1) {
      cols[field] = headers.length;
      for (const r of rows) r.push("");
      headers[cols[field]] = label;
    }
  }
  const sourceCol = headers.length;
  for (const r of rows) r.push("");
  headers[sourceCol] = "Filled By";

  const show = (i) => (i === -1 ? "(none)" : `"${headers[i]}"`);
  console.log(`Columns - company: ${show(cols.name)}, phone: ${show(cols.phone)}, website: ${show(cols.website)}, email: ${show(cols.email)}, location: ${cols.location.map(show).join(" + ") || "(none)"}`);
  console.log(`Google Places: ${process.env.GOOGLE_PLACES_API_KEY ? "on" : "off (set GOOGLE_PLACES_API_KEY for much better coverage)"}, website scrape: ${opts.scrape ? "on" : "off"}, OpenStreetMap: ${opts.osm ? "on" : "off"}`);

  const todo = rows.slice(1).filter((r) => isBlank(r[cols.phone]) || isBlank(r[cols.website]));
  const batch = opts.limit ? todo.slice(0, opts.limit) : todo;
  console.log(`${rows.length - 1} rows, ${todo.length} missing a phone or website${opts.limit ? ` (processing ${batch.length})` : ""}\n`);

  const stats = { phone: 0, website: 0, phoneMissing: 0, websiteMissing: 0 };
  const cache = new Map();
  for (const [n, row] of batch.entries()) {
    const label = row[cols.name] || "(no name)";
    const missingPhone = isBlank(row[cols.phone]);
    const missingWebsite = isBlank(row[cols.website]);
    stats.phoneMissing += missingPhone;
    stats.websiteMissing += missingWebsite;
    const result = await fillRow(row, cols, opts, cache);
    if (result.phone) { row[cols.phone] = result.phone; stats.phone++; }
    if (result.website) { row[cols.website] = result.website; stats.website++; }
    row[sourceCol] = result.sources.join("; ");
    const filled = [result.phone && `phone ${result.phone}`, result.website && `website ${result.website}`].filter(Boolean);
    console.log(`[${n + 1}/${batch.length}] ${label}: ${filled.length ? filled.join(", ") : "nothing found"}`);
  }

  console.log(`\nFilled ${stats.phone}/${stats.phoneMissing} missing phone numbers and ${stats.website}/${stats.websiteMissing} missing websites.`);
  if (opts.dryRun) return;
  const out = opts.out || (fs.existsSync(opts.input) ? opts.input.replace(/(\.csv)?$/i, "-filled.csv") : "sheet-filled.csv");
  fs.writeFileSync(out, toCsv(rows));
  console.log(`Wrote ${path.resolve(out)} - check the "Filled By" column before relying on the new values.`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseCsv, toCsv, detectColumns, websiteFromEmail, normaliseWebsite,
  cleanPhone, nameMatches, extractPhoneFromHtml, sheetIdFrom, isBlank, fillRow,
};
