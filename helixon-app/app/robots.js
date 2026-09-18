const BASE = "https://www.helixon.co.uk";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/employee",
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
