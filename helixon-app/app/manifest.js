// Web app manifest (served at /manifest.webmanifest). Lets browsers offer
// "install" / "add to home screen" and gives the icon and theme colour.
// Installed, it opens on the dashboard (sign-in if needed), full screen,
// with shortcuts to the screens recruiters use on the move.
export default function manifest() {
  return {
    id: "/dashboard",
    name: "Helixon",
    short_name: "Helixon",
    description: "AI CV screening built for recruitment agencies.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f8f6",
    theme_color: "#0b6e4f",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Candidates", url: "/dashboard/candidates" },
      { name: "Pipeline", url: "/dashboard/pipeline" },
      { name: "Interviews", url: "/dashboard/interviews" },
      { name: "Screen a CV", url: "/analyse" },
    ],
  };
}
