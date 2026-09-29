// lib/security/ip-intel.js
// Passive enumeration of one IP address for the admin IP dossier: what it
// is and who's behind it, from public registries only.
//   - reverse DNS (PTR) and whether each name resolves back to the IP
//   - the announcing network (ASN, prefix, AS name) via Team Cymru's DNS
//   - the registry record (RDAP, the successor to WHOIS): network name,
//     owner, range, country, abuse contact, registration date
//   - whether it's a Tor exit (the Tor Project's published list)
//   - whether a crawler it claims to be (Googlebot, bingbot...) checks out
//   - whether the network looks like a hosting provider (servers, not people)
// Nothing here connects to the IP itself - no port scans or probes; that
// would be scanning someone else's machine.
//
// Every lookup is independent and time-limited; one failing leaves the
// rest intact. Results are cached per IP by the caller (public.ip_intel).

import { promises as dns } from "node:dns";
import { BlockList, isIP } from "node:net";

const LOOKUP_TIMEOUT_MS = 4000;
const TOR_LIST_URL = "https://check.torproject.org/torbulkexitlist";
const TOR_CACHE_MS = 6 * 60 * 60 * 1000;

function withTimeout(promise, ms = LOOKUP_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("timed out")), ms);
    }),
  ]);
}

// ── Address helpers ─────────────────────────────────────────────────────

const SPECIAL = new BlockList();
[
  ["10.0.0.0", 8, "private"],
  ["172.16.0.0", 12, "private"],
  ["192.168.0.0", 16, "private"],
  ["100.64.0.0", 10, "carrier-grade NAT"],
  ["127.0.0.0", 8, "loopback"],
  ["169.254.0.0", 16, "link-local"],
  ["224.0.0.0", 4, "multicast"],
  ["240.0.0.0", 4, "reserved"],
].forEach(([address, prefix]) => SPECIAL.addSubnet(address, prefix, "ipv4"));
[
  ["fc00::", 7],
  ["fe80::", 10],
  ["::1", 128],
  ["ff00::", 8],
].forEach(([address, prefix]) => SPECIAL.addSubnet(address, prefix, "ipv6"));

/** "public" or "private/reserved" - private addresses have nothing to look up. */
export function ipScope(ip) {
  const family = isIP(ip);
  if (!family) return "invalid";
  return SPECIAL.check(ip, family === 4 ? "ipv4" : "ipv6") ? "private" : "public";
}

/** Full 8-group form of an IPv6 address ("2001:db8::1" -> "2001:0db8:0000:...:0001"). */
export function expandIPv6(ip) {
  let value = String(ip).toLowerCase();
  // Embedded IPv4 tail (::ffff:1.2.3.4) -> two hex groups.
  const v4 = value.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const [a, b, c, d] = v4[1].split(".").map(Number);
    value = value.replace(v4[1], `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`);
  }
  const [head, tail] = value.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const missing = value.includes("::") ? 8 - headParts.length - tailParts.length : 0;
  const groups = [...headParts, ...Array(missing).fill("0"), ...tailParts];
  return groups.map((g) => g.padStart(4, "0")).join(":");
}

/** The name to query in reverse-order DNS zones (Cymru, DNSBL style). */
export function reverseName(ip) {
  if (isIP(ip) === 4) return ip.split(".").reverse().join(".");
  return expandIPv6(ip).replace(/:/g, "").split("").reverse().join(".");
}

/** The /24 (IPv4) or /64 (IPv6) an address sits in - its "neighbourhood". */
export function neighbourhood(ip) {
  const family = isIP(ip);
  if (family === 4) return `${ip.split(".").slice(0, 3).join(".")}.0/24`;
  if (family === 6) return `${expandIPv6(ip).split(":").slice(0, 4).join(":")}::/64`;
  return null;
}

// ── Parsers (pure, tested) ──────────────────────────────────────────────

/** "13335 | 1.1.1.0/24 | AU | apnic | 2011-08-11" */
export function parseCymruOrigin(txt) {
  const parts = String(txt || "").split("|").map((p) => p.trim());
  if (parts.length < 3 || !parts[0]) return null;
  return {
    asn: Number(parts[0].split(/\s+/)[0]) || null,
    prefix: parts[1] || null,
    country: parts[2] || null,
    registry: parts[3] || null,
    allocated: parts[4] || null,
  };
}

/** "13335 | US | arin | 2010-07-14 | CLOUDFLARENET, US" -> "CLOUDFLARENET, US" */
export function parseCymruAsName(txt) {
  const parts = String(txt || "").split("|").map((p) => p.trim());
  return parts.length >= 5 ? parts.slice(4).join(" | ") || null : null;
}

function vcardField(entity, field) {
  const card = entity?.vcardArray?.[1];
  if (!Array.isArray(card)) return null;
  const row = card.find((r) => Array.isArray(r) && r[0] === field);
  return row ? String(row[3] ?? "").trim() || null : null;
}

function findEntity(entities, role, depth = 0) {
  for (const entity of entities || []) {
    if ((entity.roles || []).includes(role)) return entity;
    if (depth < 3) {
      const nested = findEntity(entity.entities, role, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

/** The useful slice of an RDAP IP-network response. */
export function parseRdap(json, source = null) {
  if (!json || typeof json !== "object") return null;
  const cidrs = (json.cidr0_cidrs || [])
    .map((c) => (c.v4prefix || c.v6prefix ? `${c.v4prefix || c.v6prefix}/${c.length}` : null))
    .filter(Boolean);
  const owner = findEntity(json.entities, "registrant") || findEntity(json.entities, "administrative") || findEntity(json.entities, "technical");
  const abuse = findEntity(json.entities, "abuse");
  const event = (action) => (json.events || []).find((e) => e.eventAction === action)?.eventDate || null;
  return {
    name: json.name || null,
    handle: json.handle || null,
    type: json.type || null,
    country: json.country || null,
    range: json.startAddress && json.endAddress ? `${json.startAddress} - ${json.endAddress}` : null,
    cidrs,
    owner: vcardField(owner, "fn"),
    abuseEmail: vcardField(abuse, "email"),
    registered: event("registration"),
    lastChanged: event("last changed"),
    source,
  };
}

// Networks that are servers rather than people. A match here means
// "probably a bot, scraper, VPN or monitoring service" - a hint, not proof.
const HOSTING = [
  [/\bamazon|\baws\b/, "Amazon Web Services"],
  [/google[- ]cloud/, "Google Cloud"],
  [/\bgoogle\b|googleusercontent|googlebot/, "Google"],
  [/\bmicrosoft|\bazure\b/, "Microsoft Azure"],
  [/digitalocean/, "DigitalOcean"],
  [/\bovh/, "OVHcloud"],
  [/hetzner/, "Hetzner"],
  [/linode/, "Akamai / Linode"],
  [/akamai/, "Akamai"],
  [/vultr|choopa/, "Vultr"],
  [/\boracle\b/, "Oracle Cloud"],
  [/alibaba|aliyun/, "Alibaba Cloud"],
  [/tencent/, "Tencent Cloud"],
  [/contabo/, "Contabo"],
  [/leaseweb/, "Leaseweb"],
  [/scaleway/, "Scaleway"],
  [/\bm247\b/, "M247"],
  [/cloudflare/, "Cloudflare"],
  [/fastly/, "Fastly"],
  [/hostinger/, "Hostinger"],
  [/\bionos\b|1and1/, "IONOS"],
  [/datacamp|cdn77/, "DataCamp (CDN77)"],
  [/hivelocity/, "Hivelocity"],
  [/colocrossing/, "ColoCrossing"],
  [/psychz/, "Psychz Networks"],
];

export function hostingProvider(...names) {
  // Google Fiber is a home broadband ISP, not Google's servers.
  const haystack = names.filter(Boolean).join(" ").toLowerCase().replace(/google[- ]fiber\S*/g, " ");
  const hit = HOSTING.find(([pattern]) => pattern.test(haystack));
  return hit ? hit[1] : null;
}

// Crawlers that can be verified by reverse DNS (their operators publish
// the domains their crawler hosts resolve to).
const CRAWLERS = [
  // Not googleusercontent.com: every Google Cloud customer's VM resolves
  // there, so accepting it would "verify" anyone renting a VM.
  { name: "Googlebot", ua: /googlebot|google-inspectiontool|googleother|adsbot-google/i, domains: ["googlebot.com", "google.com"] },
  { name: "Bingbot", ua: /bingbot|adidxbot|msnbot/i, domains: ["search.msn.com"] },
  { name: "Applebot", ua: /applebot/i, domains: ["applebot.apple.com"] },
  { name: "YandexBot", ua: /yandex(bot|images|mobilebot)/i, domains: ["yandex.ru", "yandex.net", "yandex.com"] },
  { name: "Baiduspider", ua: /baiduspider/i, domains: ["baidu.com", "baidu.jp"] },
  { name: "Amazonbot", ua: /amazonbot/i, domains: ["crawl.amazonbot.amazon"] },
];

/**
 * { claimed, verified } for the crawler any of these user agents claims to
 * be, given the IP's forward-confirmed reverse DNS names. `verified: false`
 * with a claim is a spoofed crawler - a strong sign of a scraper.
 */
export function verifyCrawler(userAgents, confirmedHostnames) {
  const agents = (userAgents || []).join("\n");
  const crawler = CRAWLERS.find((c) => c.ua.test(agents));
  if (!crawler) return null;
  const verified = (confirmedHostnames || []).some((host) => crawler.domains.some((d) => host === d || host.endsWith(`.${d}`)));
  return { claimed: crawler.name, verified };
}

// ── Lookups ─────────────────────────────────────────────────────────────

async function reverseDns(ip) {
  const hostnames = await withTimeout(dns.reverse(ip)).catch(() => []);
  // Forward-confirm each name: does it resolve back to this IP?
  const family = isIP(ip);
  const normalise = (a) => (family === 6 ? expandIPv6(a) : a);
  const target = normalise(ip);
  const checked = await Promise.all(
    hostnames.slice(0, 5).map(async (host) => {
      const addresses = await withTimeout(family === 4 ? dns.resolve4(host) : dns.resolve6(host)).catch(() => []);
      return { host: host.toLowerCase(), confirmed: addresses.map(normalise).includes(target) };
    }),
  );
  return checked;
}

async function asnLookup(ip) {
  const zone = isIP(ip) === 4 ? "origin.asn.cymru.com" : "origin6.asn.cymru.com";
  const records = await withTimeout(dns.resolveTxt(`${reverseName(ip)}.${zone}`));
  const origin = parseCymruOrigin(records?.[0]?.join(""));
  if (!origin?.asn) return origin;
  const names = await withTimeout(dns.resolveTxt(`AS${origin.asn}.asn.cymru.com`)).catch(() => null);
  return { ...origin, name: parseCymruAsName(names?.[0]?.join("")) };
}

async function rdapLookup(ip) {
  const response = await withTimeout(fetch(`https://rdap.org/ip/${encodeURIComponent(ip)}`, { headers: { accept: "application/rdap+json" }, redirect: "follow" }), 6000);
  if (!response.ok) throw new Error(`RDAP returned HTTP ${response.status}`);
  return parseRdap(await response.json(), response.url || null);
}

let torCache = null;
async function torExits() {
  if (torCache && Date.now() - torCache.at < TOR_CACHE_MS) return torCache.set;
  const response = await withTimeout(fetch(TOR_LIST_URL), 6000);
  if (!response.ok) throw new Error(`Tor list returned HTTP ${response.status}`);
  const set = new Set((await response.text()).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
  torCache = { at: Date.now(), set };
  return set;
}

function settle(result) {
  return result.status === "fulfilled" ? { value: result.value ?? null } : { error: result.reason?.message || "Lookup failed" };
}

/**
 * Everything the public registries say about `ip`. `userAgents` (seen from
 * this IP in our logs) lets it check any crawler the IP claims to be.
 */
export async function enumerateIp(ip, { userAgents = [] } = {}) {
  const family = isIP(ip);
  const scope = ipScope(ip);
  const base = { ip, version: family ? `IPv${family}` : null, scope, neighbourhood: neighbourhood(ip), fetchedAt: new Date().toISOString() };
  if (scope !== "public") return { ...base, note: scope === "private" ? "Private or reserved address - there's nothing public to look up." : "Not a valid IP address." };

  const [rdnsResult, asnResult, rdapResult, torResult] = await Promise.allSettled([reverseDns(ip), asnLookup(ip), rdapLookup(ip), torExits()]);
  const rdns = settle(rdnsResult);
  const asn = settle(asnResult);
  const rdap = settle(rdapResult);
  const tor = settle(torResult);

  const hostnames = rdns.value || [];
  const confirmed = hostnames.filter((h) => h.confirmed).map((h) => h.host);
  return {
    ...base,
    reverseDns: rdns.error ? { error: rdns.error } : { hostnames },
    asn: asn.error ? { error: asn.error } : asn.value,
    rdap: rdap.error ? { error: rdap.error } : rdap.value,
    tor: tor.error ? { error: tor.error } : { exit: tor.value.has(ip) },
    crawler: verifyCrawler(userAgents, confirmed),
    hosting: hostingProvider(asn.value?.name, rdap.value?.name, rdap.value?.owner, ...hostnames.map((h) => h.host)),
  };
}
