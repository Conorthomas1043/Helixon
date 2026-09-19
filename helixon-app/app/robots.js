const BASE = "https://www.helixon.co.uk";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        // Deliberately NOT listing /admin or /employee: robots.txt is public,
        // so naming them would advertise where they are. They're kept out of
        // search by an X-Robots-Tag: noindex header (next.config.mjs) and, for
        // /admin, by the hidden-route setup in proxy.ts.
        "/dashboard",
        "/account",
        "/billing",
        "/analyse",
        "/checkout",
        "/verify-email",
        "/update-password",
        "/monitoring",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
