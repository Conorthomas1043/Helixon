const BASE = "https://www.helixon.co.uk";

const PUBLIC_PATHS = [
  "",
  "/pricing",
  "/how-it-works",
  "/about",
  "/blog",
  "/faq",
  "/contact",
  "/demo",
  "/careers",
  "/updates",
  "/login",
  "/privacy",
  "/terms",
  "/dpa",
  "/complaints",
  "/cookie-policy",
];

export default function sitemap() {
  return PUBLIC_PATHS.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: path === "" || path === "/pricing" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/pricing" ? 0.9 : 0.5,
  }));
}
