#!/usr/bin/env node
// scripts/enrich-leads.mjs
//
// Fills in the gaps in the "Helixon Leads - Leads.csv" export: Phone,
// Website, ATS Detected, and re-checks Flag / Label / City / Accounts Type
// against live Companies House data.
//
// Usage:
//   [COMPANIES_HOUSE_API_KEY=...] [GOOGLE_PLACES_API_KEY=...] [BRAVE_SEARCH_API_KEY=...]  (all optional) \
//     node scripts/enrich-leads.mjs "Helixon Leads - Leads.csv" [out.csv] [--limit N] [--refresh] [--no-search] [--threads N] [--search-delay MS]
//
// --threads (default 8) is how many companies are worked on at once;
// --search-delay (default 2500) is the gap between searches on each engine.
// A fast run: --threads 24 --search-delay 1000 (it backs off by itself if
// an engine starts refusing).
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
//      Failing that, the company is searched on DuckDuckGo / Bing / Brave /
//      Mojeek in rotation (no key needed), or Brave's Search API first if
//      BRAVE_SEARCH_API_KEY is set (free, and doesn't get blocked)
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
  // tel: links first (most reliable), then numbers written in the text.
  {
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

async function companiesHouseDirectors(number, key) {
  const wait = 520 - (Date.now() - lastChCall);
  if (wait > 0) await sleep(wait);
  lastChCall = Date.now();
  const res = await fetchWithTimeout(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(number)}/officers?items_per_page=50`, {
    headers: { Authorization: "Basic " + Buffer.from(key + ":").toString("base64") },
  });
  if (!res.ok) return [];
  const { items = [] } = await res.json();
  return items
    .filter((o) => !o.resigned_on)
    .map((o) => `${o.name} (${o.officer_role}${o.appointed_on ? `, since ${o.appointed_on.slice(0, 4)}` : ""})`);
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
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.businessStatus,places.rating,places.userRatingCount,places.googleMapsUri",
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
        address: p.formattedAddress || null,
        rating: p.rating ? `${p.rating} (${p.userRatingCount || 0} reviews)` : null,
        mapsUrl: p.googleMapsUri || null,
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

// Normalised for comparison: "A&B Recruitment Limited." -> "A AND B RECRUITMENT LTD"
const canon = (str) => ` ${String(str).toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9]+/g, " ").replace(/\bLIMITED\b/g, "LTD").trim()} `;

// A page belongs to the company only if it shows the registered number or the
// full registered name including "Ltd"/"Limited" (both legally required on a
// UK company's website). Matching on the name alone would accept any site
// that happens to say e.g. "best recruitment agency".
export function pageText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&#0?39;|&rsquo;|&lsquo;|&apos;/gi, "'")
    .replace(/&copy;|&#169;/gi, "©").replace(/&quot;/gi, '"').replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
}

// "company number" / "registered name" / null
export function matchReason(html, company, number) {
  const text = pageText(html);
  const bareNumber = number.replace(/^0+/, "");
  if (new RegExp(`(?:NO|NUMBER|REG|REGISTERED|COMPANY)[^0-9A-Z]{0,40}0*${bareNumber}\\b`, "i").test(text)) return "company number";
  if (new RegExp(`\\b0*${bareNumber}\\b`).test(text) && /registered|company (no|number)|reg\.? no/i.test(text)) return "company number";
  return canon(text).includes(canon(company)) ? "registered name" : null;
}

export const pageMentionsCompany = (html, company, number) => matchReason(html, company, number) !== null;

// The registered number/name is usually in the footer, or on the contact,
// terms or privacy page - check those before giving up on a site.
async function verifySite(origin, company, number) {
  const home = await getPage(origin + "/");
  if (!home) return null;
  let why = matchReason(home.html, company, number);
  if (why) return { ...home, evidence: `${why} on ${home.url}` };
  for (const sub of ["/contact", "/contact-us", "/about", "/about-us", "/terms", "/privacy-policy"]) {
    const p = await getPage(origin + sub);
    why = p && matchReason(p.html, company, number);
    if (why) return { ...home, evidence: `${why} on ${p.url}` };
  }
  return null;
}

async function guessWebsite(company, number) {
  const tokens = nameTokens(company);
  if (!tokens.length) return null;
  const stems = new Set([tokens.join(""), tokens.join("-")]);
  const noGeneric = tokens.filter((t) => !["RECRUITMENT", "AGENCY", "SERVICES", "SOLUTIONS", "LONDON"].includes(t));
  if (noGeneric.length) stems.add(noGeneric.join("") + "recruitment");
  for (const stem of stems) {
    for (const tld of [".co.uk", ".com", ".uk"]) {
      const page = await verifySite(`https://www.${stem.toLowerCase()}${tld}`, company, number);
      if (page) return page;
    }
  }
  return null;
}

// Sites that list every company, so a hit there says nothing about the
// company's own website.
const DIRECTORY_HOSTS = /(company-information\.service\.gov\.uk|gov\.uk|linkedin|facebook|instagram|twitter|x\.com|youtube|glassdoor|indeed|reed\.co|totaljobs|cv-library|endole|companycheck|opencorporates|bizstats|rocketreach|zoominfo|dnb\.com|companieslist|find-open|yell\.com|thegazette|duedil|checkcompany|companyhub|craft\.co|crunchbase|wikipedia|agencycentral|globaldatabase|cylex|192\.com|bing\.com|duckduckgo)/i;

// Search engines are rotated. Each engine gets one search at a time,
// --search-delay ms apart; one that starts refusing is rested for 5 minutes
// while the others carry on. Threads overlap on the slow part (fetching and
// checking websites), not on the searches.
export const searchConfig = { delay: 2500 };
const ENGINES = [
  { name: "DuckDuckGo", url: (q) => "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q) },
  { name: "Bing", url: (q) => "https://www.bing.com/search?setlang=en-GB&cc=GB&q=" + encodeURIComponent(q) },
  { name: "Brave", url: (q) => "https://search.brave.com/search?source=web&q=" + encodeURIComponent(q) },
  { name: "Mojeek", url: (q) => "https://www.mojeek.com/search?q=" + encodeURIComponent(q) },
].map((e) => ({ ...e, slot: Promise.resolve(), restUntil: 0, busy: 0, strikes: 0 }));

// Brave's official Search API (free plan: 2,000 searches/month, 1 per second -
// api-dashboard.search.brave.com). Unlike scraping result pages, it doesn't
// get blocked, so when BRAVE_SEARCH_API_KEY is set it's used first.
export function addBraveApi(key) {
  ENGINES.unshift({
    name: "Brave Search API", delay: 1100, slot: Promise.resolve(), restUntil: 0, busy: 0, strikes: 0,
    url: (q) => "https://api.search.brave.com/res/v1/web/search?country=gb&count=10&q=" + encodeURIComponent(q),
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    // Turned into plain links so the same result parsing applies.
    toHtml: (body) => (JSON.parse(body).web?.results || []).map((r) => `<a href="${r.url}">`).join(""),
  });
}

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
  Accept: "text/html,application/xhtml+xml",
};
const ENGINE_HOSTS = /(duckduckgo|bing|microsoft|msn|brave|mojeek|google)\./i;

// Result links, unwrapped from each engine's redirect format.
export function resultLinks(html) {
  const out = [];
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    let href = m[1].replace(/&amp;/g, "&");
    try {
      let u = new URL(href, "https://example.invalid");
      if (ENGINE_HOSTS.test(u.hostname) || u.hostname === "example.invalid") {
        const wrapped = u.searchParams.get("uddg") || u.searchParams.get("url") || u.searchParams.get("u");
        if (!wrapped) continue;
        // Bing: u=a1<base64url of the target>
        href = /^a1/.test(wrapped) ? Buffer.from(wrapped.slice(2).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString() : wrapped;
        u = new URL(href);
        if (ENGINE_HOSTS.test(u.hostname)) continue;
      }
      if (/^https?:$/.test(u.protocol)) out.push(u);
    } catch { /* not a URL */ }
  }
  return out;
}

async function webSearch(q) {
  for (let attempt = 0; attempt < ENGINES.length * 3; attempt++) {
    const now = Date.now();
    const ready = ENGINES.filter((e) => e.restUntil <= now);
    if (!ready.length) {
      const until = Math.min(...ENGINES.map((e) => e.restUntil));
      await sleep(until - now + 100);
      continue;
    }
    // The API (if any) is always first; otherwise spread across the least busy.
    const engine = ready[0].toHtml ? ready[0] : ready.sort((x, y) => x.busy - y.busy)[0];
    engine.busy++;
    const slot = engine.slot.then(() => sleep(engine.delay ?? searchConfig.delay));
    engine.slot = slot;
    await slot;
    engine.busy--;
    if (engine.restUntil > Date.now()) continue; // got benched while we queued
    let res, html = "", err = null;
    try {
      res = await fetchWithTimeout(engine.url(q), { headers: engine.headers || BROWSER_HEADERS });
      html = await res.text();
      if (engine.toHtml && res.ok) html = engine.toHtml(html);
    } catch (e) { err = e; }
    // A page that has result links wasn't blocked, whatever words its scripts
    // contain; only a link-less page that looks like a challenge counts.
    const hasResults = resultLinks(html).length > 0;
    const challenge = !hasResults && /captcha|unusual traffic|are you a robot|anomaly-modal|challenge-form|verify you are human/i.test(html);
    const why = err ? `network error: ${err.cause?.code || err.message}`
      : !res.ok ? `HTTP ${res.status}` : res.status === 202 ? "HTTP 202 challenge" : challenge ? "bot check page" : null;
    if (!why) {
      engine.strikes = 0;
      return html;
    }
    if (engine.restUntil <= Date.now()) {
      engine.strikes++;
      const mins = Math.min(5 * 2 ** (engine.strikes - 1), 60);
      engine.restUntil = Date.now() + mins * 60_000;
      console.warn(`  ${engine.name} refused a search (${why}) - resting it for ${mins} min`);
    }
  }
  // Not cached, so this row is retried on the next run.
  throw new Error("every search engine is refusing searches right now");
}

async function searchWebsite(company, city, number) {
  const q = `"${company.replace(/\b(LIMITED|LTD)\b\.?/gi, "").trim()}" ${city}`;
  const html = await webSearch(q);
  const origins = [];
  for (const u of resultLinks(html)) {
    if (!DIRECTORY_HOSTS.test(u.hostname) && !origins.includes(u.origin)) origins.push(u.origin);
  }
  for (const origin of origins.slice(0, 5)) {
    const page = await verifySite(origin, company, number);
    if (page) return page;
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

const SECTORS = [
  ["Healthcare / Nursing", /\b(healthcare|nurs(e|ing)|medical|NHS|clinical|doctors?|locum|pharmac)/i],
  ["Social care / Care", /\b(social care|care (home|staff|worker|assistant)|domiciliary|support workers?|carers?\b)/i],
  ["Education", /\b(teach(er|ing)|education|schools?|SEN\b|teaching assistant)/i],
  ["IT / Tech", /\b(IT recruitment|software|developers?|tech(nology)? (jobs|recruitment)|cyber|data (engineer|scien)|devops)/i],
  ["Construction", /\b(construction|civil engineering|site manager|labourers?|trades(people|men)?|CSCS)/i],
  ["Engineering / Manufacturing", /\b(engineering|manufactur|mechanical|electrical engineer|production)/i],
  ["Industrial / Warehouse / Logistics", /\b(warehouse|logistics|industrial|forklift|pickers?|packers?)/i],
  ["Driving", /\b(HGV|LGV|drivers?|driving jobs|couriers?|delivery drivers?)/i],
  ["Hospitality / Catering", /\b(hospitality|catering|chefs?|hotel|kitchen porter|waiting staff|events staff)/i],
  ["Office / Admin", /\b(office support|administrat|receptionist|secretar|PA\b|clerical)/i],
  ["Finance / Accountancy", /\b(accountan|finance (jobs|recruitment)|bookkeep|payroll|audit)/i],
  ["Legal", /\b(legal (jobs|recruitment)|solicitors?|paralegal|lawyers?)/i],
  ["Sales / Marketing", /\b(sales (jobs|recruitment|executive)|marketing (jobs|recruitment)|business development)/i],
  ["Security", /\b(security (officers?|guards?|staff)|SIA\b|door supervisor)/i],
  ["Cleaning / Facilities", /\b(cleaning|cleaners?|facilities management|housekeep)/i],
  ["Executive search", /\b(executive search|headhunt|C-suite|board level)/i],
  ["International / Overseas", /\b(overseas|international recruitment|visa sponsorship|sponsorship licen[cs]e)/i],
];

const PLATFORMS = [
  ["WordPress", /wp-content|wp-includes/i], ["Wix", /wixstatic|_wixCssImports|wix\.com/i],
  ["Squarespace", /squarespace/i], ["Shopify", /cdn\.shopify/i], ["Webflow", /webflow/i],
  ["GoDaddy Builder", /img1\.wsimg\.com|godaddy/i], ["Weebly", /weebly/i], ["Joomla", /\/media\/jui\/|joomla/i],
  ["Drupal", /drupal/i], ["Framer", /framerusercontent/i], ["Duda", /dudaone|multiscreensite/i],
  ["HubSpot CMS", /hs-sites|hubspot/i], ["Next.js", /\/_next\/static/i], ["Hostinger Builder", /zyrosite|hostinger/i],
];

const SOCIAL = {
  linkedin: /https?:\/\/([a-z]+\.)?linkedin\.com\/(company|in|school)\/[^"'\s<>?#]+/i,
  facebook: /https?:\/\/(www\.|m\.)?facebook\.com\/(?!sharer|share|plugins|tr\b|dialog)[^"'\s<>?#]+/i,
  instagram: /https?:\/\/(www\.)?instagram\.com\/(?!p\/|share)[^"'\s<>?#]+/i,
  twitter: /https?:\/\/(www\.)?(twitter|x)\.com\/(?!share|intent|home)[^"'\s<>?#]+/i,
  tiktok: /https?:\/\/(www\.)?tiktok\.com\/@[^"'\s<>?#]+/i,
  youtube: /https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|user\/|@)[^"'\s<>?#]+/i,
};

// Cloudflare hides emails as data-cfemail="<hex>"; first byte is the XOR key.
const cfDecode = (hex) => {
  const k = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k);
  return out;
};

export function extractEmails(html) {
  const found = [];
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) found.push(decodeURIComponent(m[1]));
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) found.push(cfDecode(m[1]));
  for (const m of pageText(html).matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) found.push(m[0]);
  return [...new Set(found.map((e) => e.toLowerCase().replace(/\.$/, "")))]
    .filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && !/\.(png|jpe?g|gif|svg|webp)$|example\.|sentry|wixpress|domain\.com|yourdomain|email\.com$/.test(e));
}

const firstMatch = (htmls, re) => { for (const h of htmls) { const m = h.match(re); if (m) return m[0]; } return null; };
const meta = (html, name) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i"));
  return m ? pageText(m[1]).trim() : null;
};

async function scanWebsite(home) {
  const pages = [home];
  const offsite = [];
  const base = new URL(home.url);
  const links = new Map();
  for (const m of home.html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (/career|job|vacanc|candidate|apply|contact|about|sector|speciali|client|employer|team/i.test(u.pathname)) {
        if (u.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "")) links.set(u.origin + u.pathname, u.href);
        else offsite.push(u.href); // off-site job board link: its hostname alone is a fingerprint
      }
    } catch { /* bad href */ }
  }
  // Jobs/contact pages first - they carry the ATS and contact details.
  const ordered = [...links.values()].sort((x, y) => (/job|vacanc|career|contact/i.test(y) ? 1 : 0) - (/job|vacanc|career|contact/i.test(x) ? 1 : 0));
  for (const link of ordered.slice(0, 6)) {
    const p = await getPage(link);
    if (p) pages.push(p);
  }
  const htmls = pages.map((p) => p.html);
  const allText = htmls.map(pageText).join(" ");
  const info = {};
  for (const [k, re] of Object.entries(SOCIAL)) info[k] = firstMatch(htmls, re);
  const emails = extractEmails(htmls.join(" "));
  const domain = base.hostname.replace(/^www\./, "");
  info.email = [...emails.filter((e) => e.endsWith(domain)), ...emails.filter((e) => !e.endsWith(domain))].slice(0, 3).join("; ") || null;
  info.sectors = SECTORS.filter(([, re]) => re.test(allText)).map(([n]) => n).join("; ") || null;
  info.platform = PLATFORMS.filter(([, re]) => re.test(home.html)).map(([n]) => n).join("; ") || null;
  info.jobsPage = pages.find((p) => /job|vacanc|career/i.test(new URL(p.url).pathname))?.url
    || offsite.find((u) => /job|vacanc|career/i.test(u)) || null;
  info.postcodes = [...new Set([...allText.matchAll(/\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b/g)].map((m) => m[0].replace(/^(\S+?)(\d[A-Z]{2})$/, "$1 $2")))].slice(0, 3).join("; ") || null;
  info.title = (home.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] && pageText(home.html.match(/<title[^>]*>([^<]*)<\/title>/i)[1]).trim()) || null;
  info.description = meta(home.html, "description") || meta(home.html, "og:description");
  const years = [...allText.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d\d)/gi)].map((m) => +m[1]);
  info.copyrightYear = years.length ? String(Math.max(...years)) : null;
  info.pagesScanned = pages.length;
  return {
    ats: detectAts([...htmls, ...offsite]),
    phones: htmls.flatMap(extractPhones),
    info,
  };
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
      out.status = ch.company_status || null;
      out.sic = (ch.sic_codes || []).join("; ") || null;
      const ro = ch.registered_office_address || {};
      out.registeredOffice = [ro.address_line_1, ro.address_line_2, ro.locality, ro.postal_code].filter(Boolean).join(", ") || null;
      out.directors = (await companiesHouseDirectors(number, env.chKey)).join("; ") || null;
    }
  }

  let place = null;
  if (env.placesKey && !(ch && ch.notFound)) {
    place = await placesLookup(row.company, row.city, ch?.registered_office_address, env.placesKey);
  }

  let site = null;
  if (place) Object.assign(out, { placesAddress: place.address, rating: place.rating, mapsUrl: place.mapsUrl });
  if (place?.website) {
    site = await getPage(place.website);
    if (site) site.evidence = "Google Places (name + address match)";
  }
  if (!site) site = await guessWebsite(row.company, number);
  if (!site && !env.noSearch) site = await searchWebsite(row.company, row.city, number);

  out.website = site ? new URL(site.url).origin : place?.website || null;
  out.phone = place?.phone || null;
  if (site) {
    const scan = await scanWebsite(site);
    out.ats = scan.ats.length ? scan.ats.join("; ") : "None detected";
    if (!out.phone && scan.phones.length) out.phone = scan.phones[0];
    out.otherPhones = scan.phones.filter((p) => p !== out.phone).slice(0, 3).join("; ") || null;
    out.evidence = site.evidence || null;
    Object.assign(out, scan.info);
  } else {
    out.ats = out.website ? "Website unreachable" : "No website found";
  }
  out.v = CACHE_VERSION;
  return out;
}

// Bump when matching/extraction changes so old cached results are redone.
const CACHE_VERSION = 3;

// Extra columns appended after the export's own columns.
const EXTRA_COLUMNS = [
  ["email", "Email"], ["otherPhones", "Other Phones"], ["linkedin", "LinkedIn"], ["facebook", "Facebook"],
  ["instagram", "Instagram"], ["twitter", "X / Twitter"], ["tiktok", "TikTok"], ["youtube", "YouTube"],
  ["sectors", "Sectors"], ["jobsPage", "Jobs Page"], ["platform", "Website Platform"],
  ["copyrightYear", "Site Copyright Year"], ["title", "Site Title"], ["description", "Site Description"],
  ["postcodes", "Postcodes on Site"], ["placesAddress", "Google Address"], ["rating", "Google Rating"], ["mapsUrl", "Google Maps"],
  ["status", "Company Status"], ["sic", "SIC Codes"], ["registeredOffice", "Registered Office"], ["directors", "Directors"],
  ["evidence", "Website Match Evidence"],
];

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
  if (process.env.BRAVE_SEARCH_API_KEY) addBraveApi(process.env.BRAVE_SEARCH_API_KEY);
  const env = { noSearch: flags.has("--no-search"), chKey: process.env.COMPANIES_HOUSE_API_KEY, placesKey: process.env.GOOGLE_PLACES_API_KEY };
  if (!env.chKey) console.warn("COMPANIES_HOUSE_API_KEY not set - Flag/Label/City/Accounts Type will not be re-checked.");
  if (!env.placesKey) console.warn("GOOGLE_PLACES_API_KEY not set - phone/website will come from verified domain guesses and web search.");

  const output = outArg || input.replace(/\.csv$/i, "") + "-enriched.csv";
  const cachePath = output + ".cache.json";
  const cache = !flags.has("--refresh") && fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};
  for (const k of Object.keys(cache)) if (cache[k]?.v !== CACHE_VERSION) delete cache[k];

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
  process.on("SIGINT", () => {
    saveCache();
    console.log(`\nStopped - progress saved to ${cachePath}. Run the same command again to carry on.`);
    process.exit(130);
  });
  await Promise.all(Array.from({ length: threads }, worker));
  saveCache();

  for (const [, title] of EXTRA_COLUMNS) if (!header.some((h) => h.trim() === title)) header.push(title);
  const extraIdx = EXTRA_COLUMNS.map(([, title]) => header.findIndex((h) => h.trim() === title));
  let phones = 0, sites = 0;
  for (const r of rows) {
    while (r.length < header.length) r.push("");
    const e = cache[r[C.number].trim()];
    if (!e) continue;
    r[C.phone] = e.phone || "NOT FOUND - search manually";
    r[C.website] = e.website || "";
    r[C.ats] = e.ats;
    if (e.flag) { r[C.flag] = e.flag; r[C.label] = e.label; }
    if (e.accounts) r[C.accounts] = e.accounts;
    if (e.city) r[C.city] = e.city;
    EXTRA_COLUMNS.forEach(([key], i) => { r[extraIdx[i]] = e[key] ?? ""; });
    if (e.phone) phones++;
    if (e.website) sites++;
  }
  fs.writeFileSync(output, toCsv([header, ...rows], eol));
  console.log(`\nWrote ${output}: ${rows.length} rows, ${phones} phones, ${sites} websites.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
