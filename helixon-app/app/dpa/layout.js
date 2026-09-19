// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Data Processing Agreement | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Data Processing Agreement",
  description: "Helixon's Data Processing Agreement, covering our obligations as a processor under UK GDPR and EU GDPR.",
};

export default function Layout({ children }) {
  return children;
}
