#!/usr/bin/env node
// scripts/enrich-leads.mjs
//
// Fills in the gaps in the "Helixon Leads - Leads.csv" export: Phone,
// Website, ATS Detected, and re-checks Flag / Label / City / Accounts Type
// against live Companies House data.
//
// Usage:
//   [COMPANIES_HOUSE_API_KEY=...] [GOOGLE_PLACES_API_KEY=...]  (both optional) \
//     node scripts/enrich-leads.mjs "Helixon Leads - Leads.csv" [out.csv] [--limit N] [--refresh] [--no-search] [--threads N] [--search-delay MS]
//
// --threads (default 8) is how many companies are worked on at once;
// --search-delay (default 2500) is the gap between DuckDuckGo searches.
// A fast run: --threads 24 --search-delay 1000 (it backs off by itself if
// DuckDuckGo starts refusing).
//
// Output defaults to "<input>-enriched.csv". Results are cached in
// "<output>.cache.json", so an interrupted run picks up where it left off;
// --refresh ignores the cache.
//
// Where each value comes from (nothing is guessed - a value is only written
// when it was verified against the company):
//   1. Companies House API (free key: developer.company-information.service.gov.uk)
//      -> status, SIC codes, last accounts type, registered office.
//      Flag/Label are recomputed from those. Without the key the existing
//      Flag/Label/City/Accounts Type are left as they are.
//   2. Google Places API (Text Search) -> phone + website. A place is only
//      accepted when its name matches the company name AND its address
//      shares the registered-office postcode district or town.
//   3. If Places gives no website, likely domains built from the company name
//      are tried; one is accepted only if the page shows the company's
//      registered number or its full name (UK companies must publish their
//      number on their site, so this is a strong check).
//      Failing that, the company is searched on DuckDuckGo (no key needed)
//      and the top non-directory results get the same check.
//   4. The website (homepage + careers/jobs pages it links to) is scanned for
//      known ATS / recruitment CRM fingerprints, and for a phone number when
//      Places had none (tel: links first, then UK-format numbers in text).
// Rows that still have no verified phone get "NOT FOUND - search manually".
//
// Network: Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 is
// set, so set that too if you're behind a proxy.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ---------- CSV ----------

export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f !== ""));
}

export function toCsv(rows, eol = "\n") {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join(eol) + eol;
}

// ---------- helpers ----------

const UA = "Mozilla/5.0 (compatible; HelixonLeadEnricher/1.0)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { redirect: "follow", ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const SUFFIXES = new Set(["LTD", "LIMITED", "PLC", "LLP", "CIC", "UK", "THE", "AND", "CO", "COMPANY", "GROUP"]);

export function nameTokens(name) {
  return String(name)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !SUFFIXES.has(t));
}

// Share of the company's significant name tokens found in the candidate name.
export function nameScore(company, candidate) {
  const a = nameTokens(company);
  const b = new Set(nameTokens(candidate));
  if (!a.length) return 0;
  return a.filter((t) => b.has(t)).length / a.length;
}

const postcodeDistrict = (s) => {
  const m = String(s || "").toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/);
  return m ? m[1] : null;
};

// UK number -> "0XXXX XXXXXX"-style national format, or null if not plausible.
export function normaliseUkPhone(raw) {
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+44")) d = "0" + d.slice(3).replace(/^0/, "");
  else if (d.startsWith("0044")) d = "0" + d.slice(4).replace(/^0/, "");
  d = d.replace(/\D/g, "");
  if (!/^0[1-35789]\d{8,9}$/.test(d)) return null;
  if (d.length === 10 && !d.startsWith("0800") && !d.startsWith("01")) return null;
  if (/^01\d1/.test(d) || /^011/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`; // 0141, 0121, 0113...
  if (/^02/.test(d)) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  if (/^07/.test(d)) return `${d.slice(0, 5)} ${d.slice(5)}`;
  if (/^0(3|8)/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}

export function extractPhones(html) {
  const found = [];
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    const p = normaliseUkPhone(decodeURIComponent(m[1]));
    if (p) found.push(p);
  }
  if (!found.length) {
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    for (const m of text.matchAll(/(?:\+44\s?\(?0?\)?\s?|\b0)\d[\d\s-]{8,12}\d/g)) {
      const p = normaliseUkPhone(m[0]);
      if (p) found.push(p);
    }
  }
  return [...new Set(found)];
}

// ---------- Companies House ----------

const RECRUITMENT_SIC = new Set(["78100", "78109", "78200", "78300"]);
const SMALL_ACCOUNTS = new Set([
  "micro-entity", "total-exemption-full", "total-exemption-small",
  "unaudited-abridged", "audit-exemption-subsidiary", "small", "dormant",
]);

let lastChCall = 0;
async function companiesHouse(number, key) {
  const wait = 520 - (Date.now() - lastChCall); // 600 requests / 5 min limit
  if (wait > 0) await sleep(wait);
  lastChCall = Date.now();
  const res = await fetchWithTimeout(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(number)}`, {
    headers: { Authorization: "Basic " + Buffer.from(key + ":").toString("base64") },
  });
  if (res.status === 404) return { notFound: true };
  if (res.status === 429) { await sleep(60000); return companiesHouse(number, key); }
  if (!res.ok) throw new Error(`Companies House ${res.status} for ${number}`);
  return res.json();
}

export function classify(ch) {
  if (ch.notFound) return { flag: "RED", label: "Company number not found at Companies House" };
  const status = ch.company_status || "unknown";
  if (status !== "active") return { flag: "RED", label: `Not trading - Companies House status: ${status}` };
  const sic = ch.sic_codes || [];
  const isRecruitment = sic.some((c) => RECRUITMENT_SIC.has(c));
  const accounts = ch.accounts?.last_accounts?.type || "unknown";
  if (!isRecruitment) return { flag: "AMBER", label: "Not confirmed as a recruitment SIC code - check manually" };
  if (accounts === "dormant") return { flag: "AMBER", label: "Confirmed recruitment agency but files dormant accounts" };
  if (SMALL_ACCOUNTS.has(accounts)) return { flag: "GREEN", label: "Strong lead - small, confirmed recruitment agency" };
  return { flag: "AMBER", label: "Confirmed recruitment agency but size unclear or not small" };
}

// ---------- Google Places ----------

async function placesLookup(company, city, office, key) {
  const res = await fetchWithTimeout("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.businessStatus",
    },
    body: JSON.stringify({ textQuery: `${company} ${city}`.trim(), regionCode: "GB" }),
  });
  if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { places = [] } = await res.json();
  const district = postcodeDistrict(office?.postal_code);
  const town = (office?.locality || city || "").toUpperCase();
  for (const p of places) {
    const name = p.displayName?.text || "";
    const addr = (p.formattedAddress || "").toUpperCase();
    const addrOk = (district && postcodeDistrict(addr) === district) || (town && addr.includes(town));
    if (nameScore(company, name) >= 0.75 && addrOk && p.businessStatus !== "CLOSED_PERMANENTLY") {
      return {
        name,
        phone: normaliseUkPhone(p.nationalPhoneNumber || p.internationalPhoneNumber || "") || null,
        website: p.websiteUri || null,
      };
    }
  }
  return null;
}

// ---------- Website ----------

async function getPage(url) {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": UA, Accept: "text/html" } }, 12000);
    if (!res.ok || !(res.headers.get("content-type") || "").includes("html")) return null;
    return { url: res.url, html: (await res.text()).slice(0, 2_000_000) };
  } catch {
    return null;
  }
}

function pageMentionsCompany(html, company, number) {
  const text = html.toUpperCase().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const bareNumber = number.replace(/^0+/, "");
  if (new RegExp(`\\b0*${bareNumber}\\b`).test(text)) return true;
  const core = nameTokens(company).join(" ");
  return core.length > 6 && text.replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").includes(core);
}

async function guessWebsite(company, number) {
  const tokens = nameTokens(company);
  if (!tokens.length) return null;
  const stems = new Set([tokens.join(""), tokens.join("-")]);
  const noGeneric = tokens.filter((t) => !["RECRUITMENT", "AGENCY", "SERVICES", "SOLUTIONS", "LONDON"].includes(t));
  if (noGeneric.length) stems.add(noGeneric.join("") + "recruitment");
  for (const stem of stems) {
    for (const tld of [".co.uk", ".com", ".uk"]) {
      const page = await getPage(`https://www.${stem.toLowerCase()}${tld}/`);
      if (page && pageMentionsCompany(page.html, company, number)) return page;
    }
  }
  return null;
}

// Sites that list every company, so a hit there says nothing about the
// company's own website.
const DIRECTORY_HOSTS = /(company-information\.service\.gov\.uk|gov\.uk|linkedin|facebook|instagram|twitter|x\.com|youtube|glassdoor|indeed|reed\.co|totaljobs|cv-library|endole|companycheck|opencorporates|bizstats|rocketreach|zoominfo|dnb\.com|companieslist|find-open|yell\.com|thegazette|duedil|checkcompany|companyhub|craft\.co|crunchbase|wikipedia|agencycentral|globaldatabase|cylex|192\.com|bing\.com|duckduckgo)/i;

// Searches go out one at a time, --search-delay ms apart, however many
// threads are running; the threads overlap on the slow part (fetching and
// scanning websites). If DuckDuckGo starts blocking, the gap doubles.
export const searchConfig = { delay: 2500 };
let searchSlot = Promise.resolve();
function nextSearchSlot() {
  const slot = searchSlot.then(() => sleep(searchConfig.delay));
  searchSlot = slot;
  return slot;
}

async function ddgSearch(q) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await nextSearchSlot();
    let res, html = "";
    try {
      res = await fetchWithTimeout("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), { headers: { "User-Agent": UA } });
      html = await res.text();
    } catch { /* network blip - retry */ }
    const blocked = !res || res.status === 202 || res.status === 403 || res.status === 429 || /anomaly|captcha/i.test(html);
    if (res?.ok && !blocked) return html;
    searchConfig.delay = Math.min(searchConfig.delay * 2, 30000);
    console.warn(`  DuckDuckGo is throttling - backing off (search gap now ${searchConfig.delay}ms)`);
    await sleep(30000 * (attempt + 1));
  }
  // Not cached, so this row is retried on the next run.
  throw new Error("DuckDuckGo kept blocking searches");
}

async function searchWebsite(company, city, number) {
  const q = `"${company.replace(/\b(LIMITED|LTD)\b\.?/gi, "").trim()}" ${city}`;
  const html = await ddgSearch(q);
  const origins = [];
  for (const m of html.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)) {
    let href = m[1].replace(/&amp;/g, "&");
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    try {
      const u = new URL(href, "https://duckduckgo.com");
      if (!DIRECTORY_HOSTS.test(u.hostname) && !origins.includes(u.origin)) origins.push(u.origin);
    } catch { /* bad link */ }
  }
  for (const origin of origins.slice(0, 5)) {
    const page = await getPage(origin + "/");
    if (page && pageMentionsCompany(page.html, company, number)) return page;
    // The registered number is often only on the contact / terms page.
    if (page) {
      for (const sub of ["/contact", "/contact-us", "/terms", "/privacy-policy"]) {
        const p = await getPage(origin + sub);
        if (p && pageMentionsCompany(p.html, company, number)) return page;
      }
    }
  }
  return null;
}

// Fingerprints are matched against the raw HTML (script src, iframe src,
// job-board links) of the homepage and any careers/jobs pages it links to.
export const ATS_SIGNATURES = [
  ["Bullhorn", /bullhorn(staffing)?\.com|bullhornreach|bhsites|bullhorn-oscp/i],
  ["Vincere", /vincere\.io|vinceredev/i],
  ["JobAdder", /jobadder\.com/i],
  ["Firefish", /firefishsoftware\.com|firefish-software/i],
  ["Mercury xRM", /mercury-xrm|mercuryxrm|mercury\.co\.uk\/jobs/i],
  ["Eploy", /eploy\.(co\.uk|net)/i],
  ["Broadbean", /broadbean|adcourier/i],
  ["Idibu", /idibu\.com/i],
  ["Recruit CRM", /recruitcrm\.io/i],
  ["Loxo", /loxo\.co/i],
  ["Manatal", /manatal\.com|careers-page\.com/i],
  ["Zoho Recruit", /zohorecruit|recruit\.zoho/i],
  ["Workable", /workable\.com/i],
  ["Greenhouse", /greenhouse\.io/i],
  ["Lever", /lever\.co\b|jobs\.lever/i],
  ["Teamtailor", /teamtailor\.com/i],
  ["Recruitee", /recruitee\.com/i],
  ["SmartRecruiters", /smartrecruiters\.com/i],
  ["iCIMS", /icims\.com/i],
  ["Workday", /myworkdayjobs\.com/i],
  ["JobDiva", /jobdiva\.com/i],
  ["Ceipal", /ceipal\.com/i],
  ["Tracker", /tracker-rms\.com|trackerrms/i],
  ["RecruitNow", /recruitnow/i],
  ["Access Recruitment", /theaccessgroup\.com\/.*recruit|accessrecruitment/i],
  ["Volcanic", /volcanic\.(co\.uk|net)|volcanic-cdn/i],
  ["Occupop", /occupop\.com/i],
  ["Pinpoint", /pinpointhq\.com/i],
  ["BambooHR", /bamboohr\.com\/(jobs|careers)/i],
  ["Breezy HR", /breezy\.hr/i],
  ["JazzHR", /applytojob\.com|jazzhr/i],
  ["Personio", /jobs\.personio/i],
  ["Hireful / Talos360", /talos360|hireful/i],
  ["Cube19 / Bullhorn Analytics", /cube19/i],
  ["Colleague", /colleaguesoftware|colleague\.co\.uk/i],
  ["Itris", /itris\.co\.uk|itris9/i],
  ["Advance / Konnect", /konnect\.co\.uk|advancerecruitment/i],
  ["Madgex", /madgex/i],
  ["Jobsoid", /jobsoid\.com/i],
  ["Freshteam", /freshteam\.com/i],
];

export function detectAts(htmls) {
  const found = new Set();
  for (const html of htmls) for (const [name, re] of ATS_SIGNATURES) if (re.test(html)) found.add(name);
  return [...found];
}

async function scanWebsite(home) {
  const htmls = [home.html];
  const base = new URL(home.url);
  const links = new Set();
  for (const m of home.html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (/career|job|vacanc|candidate|apply|contact/i.test(u.pathname)) {
        if (u.hostname === base.hostname) links.add(u.href);
        else htmls.push(u.href); // off-site job board link: its hostname alone is a fingerprint
      }
    } catch { /* bad href */ }
  }
  for (const link of [...links].slice(0, 4)) {
    const p = await getPage(link);
    if (p) htmls.push(p.html);
  }
  return { ats: detectAts(htmls), phones: htmls.flatMap((h) => (h.startsWith("http") ? [] : extractPhones(h))) };
}

// ---------- main ----------

async function enrich(row, env) {
  const out = {};
  const number = row.number.padStart(8, "0");

  let ch = null;
  if (env.chKey) {
    ch = await companiesHouse(number, env.chKey);
    Object.assign(out, classify(ch));
    if (!ch.notFound) {
      out.accounts = ch.accounts?.last_accounts?.type || "unknown";
      out.city = ch.registered_office_address?.locality || null;
    }
  }

  let place = null;
  if (env.placesKey && !(ch && ch.notFound)) {
    place = await placesLookup(row.company, row.city, ch?.registered_office_address, env.placesKey);
  }

  let site = null;
  if (place?.website) site = await getPage(place.website);
  if (!site) site = await guessWebsite(row.company, number);
  if (!site && !env.noSearch) site = await searchWebsite(row.company, row.city, number);

  out.website = site ? new URL(site.url).origin : place?.website || null;
  out.phone = place?.phone || null;
  if (site) {
    const scan = await scanWebsite(site);
    out.ats = scan.ats.length ? scan.ats.join("; ") : "None detected";
    if (!out.phone && scan.phones.length) out.phone = scan.phones[0];
  } else {
    out.ats = out.website ? "Website unreachable" : "No website found";
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
  const numFlag = (name, dflt) => {
    const i = args.indexOf(name);
    return i >= 0 ? Number(args[i + 1]) : dflt;
  };
  const threads = numFlag("--threads", 8);
  searchConfig.delay = numFlag("--search-delay", 2500);
  const valueFlags = ["--limit", "--threads", "--search-delay"];
  const positional = args.filter((a, i) => !a.startsWith("--") && !valueFlags.includes(args[i - 1]));
  const [input, outArg] = positional;
  if (!input) {
    console.error('Usage: node scripts/enrich-leads.mjs "Helixon Leads - Leads.csv" [out.csv] [--limit N] [--refresh] [--no-search] [--threads N] [--search-delay MS]');
    process.exit(1);
  }
  const env = { noSearch: flags.has("--no-search"), chKey: process.env.COMPANIES_HOUSE_API_KEY, placesKey: process.env.GOOGLE_PLACES_API_KEY };
  if (!env.chKey) console.warn("COMPANIES_HOUSE_API_KEY not set - Flag/Label/City/Accounts Type will not be re-checked.");
  if (!env.placesKey) console.warn("GOOGLE_PLACES_API_KEY not set - phone/website will come from verified domain guesses and DuckDuckGo search.");

  const output = outArg || input.replace(/\.csv$/i, "") + "-enriched.csv";
  const cachePath = output + ".cache.json";
  const cache = !flags.has("--refresh") && fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};

  const raw = fs.readFileSync(input, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const [header, ...rows] = parseCsv(raw);
  // The export's headers carry stray spaces ("Phone ", " ATS Detected") - match trimmed, write back untouched.
  const col = (name) => {
    const i = header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    if (i < 0) throw new Error(`Column "${name}" not found in ${input}`);
    return i;
  };
  const C = {
    company: col("Company"), phone: col("Phone"), website: col("Website"), city: col("City"),
    number: col("Company Number"), accounts: col("Accounts Type"), ats: col("ATS Detected"),
    flag: col("Flag"), label: col("Label"),
  };

  const todo = rows.slice(0, limit);
  let done = 0;
  const saveCache = () => fs.writeFileSync(cachePath, JSON.stringify(cache, null, 1));
  const worker = async () => {
    while (todo.length) {
      const r = todo.shift();
      const number = r[C.number].trim();
      if (!cache[number]) {
        try {
          cache[number] = await enrich({ company: r[C.company].trim(), city: r[C.city].trim(), number }, env);
        } catch (e) {
          console.error(`  ! ${r[C.company]}: ${e.message}`);
        }
        if (++done % 10 === 0) saveCache();
      }
      const e = cache[number];
      console.log(`${r[C.company]} -> ${e ? `${e.phone || "no phone"} | ${e.website || "no site"} | ${e.ats}` : "error, will retry next run"}`);
    }
  };
  await Promise.all(Array.from({ length: threads }, worker));
  saveCache();

  let phones = 0, sites = 0;
  for (const r of rows) {
    const e = cache[r[C.number].trim()];
    if (!e) continue;
    r[C.phone] = e.phone || "NOT FOUND - search manually";
    r[C.website] = e.website || "";
    r[C.ats] = e.ats;
    if (e.flag) { r[C.flag] = e.flag; r[C.label] = e.label; }
    if (e.accounts) r[C.accounts] = e.accounts;
    if (e.city) r[C.city] = e.city;
    if (e.phone) phones++;
    if (e.website) sites++;
  }
  fs.writeFileSync(output, toCsv([header, ...rows], eol));
  console.log(`\nWrote ${output}: ${rows.length} rows, ${phones} phones, ${sites} websites.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
