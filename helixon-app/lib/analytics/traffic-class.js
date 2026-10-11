// What kind of client sent a request, from its user agent - so Traffic can
// show people separately from search engines, uptime checks and other bots
// (stored as request_logs.traffic_class; migration 20261001100000 backfills
// older rows with the same patterns, in SQL).
//
//   monitor   uptime and synthetic checks (Sentry, UptimeRobot, Pingdom...)
//   crawler   search engines, link previews and AI crawlers
//   bot       other automated clients: scripts, scanners, headless browsers
//   human     everything else
//
// A user agent is whatever the client says it is, so this sorts honest
// traffic. Security decisions never rely on it.

export const TRAFFIC_CLASSES = { human: "People", crawler: "Search & previews", monitor: "Uptime monitors", bot: "Other bots" };

// Kept as plain strings so the migration can use exactly the same patterns
// - so no \\b, which Postgres reads differently.
export const MONITOR_PATTERN =
  "sentryuptimebot|uptimerobot|pingdom|statuscake|site24x7|better ?uptime|betterstack|checkly|datadog(?:synthetics| synthetic)|newrelicpinger|freshping|hetrixtools|uptime-kuma|vercel-(?:screenshot|healthcheck)";
export const CRAWLER_PATTERN =
  "googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|bingbot|bingpreview|duckduckbot|baiduspider|yandex(?:bot|images)|applebot|slurp|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|seznambot|facebookexternalhit|facebookcatalog|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|skypeuripreview|pinterestbot|redditbot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|ccbot|perplexitybot|bytespider|amazonbot|dataprovider|chrome privacy preserving prefetch proxy";
export const BOT_PATTERN =
  "(^|[^a-z])bot([^a-z]|$)|[a-z0-9]bot/|bot[;)]|crawl|spider|scan|curl/|wget|python|go-http-client|java/|okhttp|apache-httpclient|httpclient|axios|node-fetch|undici|headless|phantomjs|libwww|zgrab|nmap|masscan|nikto|sqlmap|scrapy|postmanruntime|insomnia|httpie|aiohttp|guzzlehttp|ruby|perl";

const MONITOR = new RegExp(MONITOR_PATTERN, "i");
const CRAWLER = new RegExp(CRAWLER_PATTERN, "i");
const BOT = new RegExp(BOT_PATTERN, "i");

export function classifyUserAgent(ua) {
  const s = String(ua || "").trim();
  if (!s) return "bot";
  if (MONITOR.test(s)) return "monitor";
  if (CRAWLER.test(s)) return "crawler";
  if (BOT.test(s)) return "bot";
  return "human";
}

// The admin's own use of the admin area - left out of "People" so watching
// Traffic doesn't count as traffic.
export function isAdminPath(path) {
  const p = String(path || "");
  return p === "/admin" || p.startsWith("/admin/") || p.startsWith("/api/admin/");
}
