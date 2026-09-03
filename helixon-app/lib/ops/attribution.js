export function classifyAcquisition(row = {}) {
  const source = String(row.utm_source || "").toLowerCase();
  const medium = String(row.utm_medium || "").toLowerCase();
  const referrer = String(row.referrer || row.referer || "").toLowerCase();
  const ua = String(row.user_agent || "").toLowerCase();

  if (/(googlebot|bingbot|duckduckbot|yandex|baiduspider|facebookexternalhit|twitterbot)/i.test(ua)) return "Crawler";
  if (/(cpc|ppc|paid|display|paid_social|paid-search)/.test(medium) || /(googleads|adwords|facebook_ads|linkedin_ads)/.test(source)) return "Paid";
  if (/(email|newsletter)/.test(medium)) return "Email";
  if (/(social|social-media|social_network)/.test(medium) || /(facebook|instagram|linkedin|x\.com|twitter|reddit|tiktok)/.test(source)) return "Social";
  if (/(organic)/.test(medium) || /(google\.|bing\.|duckduckgo\.)/.test(referrer)) return "Organic";
  if (referrer) return "Referral";
  if (source || medium) return "Campaign";
  return "Direct";
}

export function groupBy(rows, keyFn) {
  const out = new Map();
  for (const row of rows || []) {
    const key = keyFn(row);
    out.set(key, (out.get(key) || 0) + 1);
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]);
}
