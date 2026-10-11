const BASE = "https://www.helixon.co.uk";

const PUBLIC_PATHS = [
  "",
  "/pricing",
  "/how-it-works",
  "/about",
  // Not /blog: every post is still "Coming soon", so it's left out of the
  // nav, footer and sitemap until there's something to read.
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
