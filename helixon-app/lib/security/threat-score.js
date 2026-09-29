const RULES = [
  { name: "path-traversal", score: 35, re: /(?:\.\.\/|\.\.\\|%2e%2e|%252e)/i },
  { name: "sql-injection-probe", score: 35, re: /(?:\bunion\b.{0,20}\bselect\b|\bor\b\s+['\"]?\d+['\"]?\s*=|information_schema|sleep\s*\(|benchmark\s*\()/i },
  { name: "xss-probe", score: 30, re: /(?:<script|javascript:|onerror\s*=|onload\s*=|%3cscript)/i },
  { name: "sensitive-path-probe", score: 20, re: /(?:\/\.git(?:\/|$)|\/\.env(?:\/|$)|\/wp-admin|\/phpmyadmin|\/server-status|\/actuator|\/swagger|\/openapi)/i },
  { name: "scanner-ua", score: 20, re: /(?:sqlmap|nikto|nmap|masscan|zgrab|nuclei|dirbuster|gobuster|burpsuite|wpscan|ffuf)/i },
];

function safeDecode(value) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

// `query` (the part after "?") is scored with the path, both as sent and
// percent-decoded: injection and XSS probes usually arrive as encoded
// query parameters (?id=1%27%20OR%201%3D1), which a path-only check never
// saw.
export function scoreRequest(input = {}) {
  const path = String(input.path || "");
  const query = String(input.query || "").replace(/^\?/, "");
  const target = query ? `${path}?${query}` : path;
  const url = `${target}\n${safeDecode(target)}`;
  const ua = String(input.user_agent || "");
  const method = String(input.method || "GET");
  let score = 0;
  const signals = [];

  for (const rule of RULES) {
    const subject = rule.name === "scanner-ua" ? ua : rule.name === "sensitive-path-probe" ? path : url;
    if (rule.re.test(subject)) {
      score += rule.score;
      signals.push(rule.name);
    }
  }

  if (input.blocked) {
    score += 15;
    signals.push("blocked-by-control");
  }

  if (/^(POST|PUT|PATCH|DELETE)$/i.test(method) && /(?:\/admin|\/auth|\/login|\/mfa)/i.test(path)) {
    score += 5;
    signals.push("sensitive-write");
  }

  return { score: Math.min(100, score), signals };
}
