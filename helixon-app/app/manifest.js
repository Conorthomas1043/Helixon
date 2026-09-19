// Web app manifest (served at /manifest.webmanifest). Lets browsers offer
// "install" / "add to home screen" and gives the icon and theme colour.
export default function manifest() {
  return {
    name: "Helixon",
    short_name: "Helixon",
    description: "Screen candidates in seconds. Built for recruitment agencies.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f8f6",
    theme_color: "#0b6e4f",
    icons: [
      { src: "/icon.png", sizes: "any", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
