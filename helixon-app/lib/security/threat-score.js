const RULES = [
  { name: "path-traversal", score: 35, re: /(?:\.\.\/|\.\.\\|%2e%2e|%252e)/i },
  { name: "sql-injection-probe", score: 35, re: /(?:\bunion\b.{0,20}\bselect\b|\bor\b\s+['\"]?\d+['\"]?\s*=|information_schema|sleep\s*\(|benchmark\s*\()/i },
  { name: "xss-probe", score: 30, re: /(?:<script|javascript:|onerror\s*=|onload\s*=|%3cscript)/i },
  { name: "sensitive-path-probe", score: 20, re: /(?:\/\.git(?:\/|$)|\/\.env(?:\/|$)|\/wp-admin|\/phpmyadmin|\/server-status|\/actuator|\/swagger|\/openapi)/i },
  { name: "scanner-ua", score: 20, re: /(?:sqlmap|nikto|nmap|masscan|zgrab|nuclei|dirbuster|gobuster|burpsuite|wpscan|ffuf)/i },
];

export function scoreRequest(input = {}) {
  const path = String(input.path || "");
  const ua = String(input.user_agent || "");
  const method = String(input.method || "GET");
  let score = 0;
  const signals = [];

  for (const rule of RULES) {
    const target = rule.name === "scanner-ua" ? ua : path;
    if (rule.re.test(target)) {
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
