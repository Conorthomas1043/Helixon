// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Product updates | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Product updates",
  description: "What's new in Helixon: recent releases, improvements and fixes.",
};

export default function Layout({ children }) {
  return children;
}
