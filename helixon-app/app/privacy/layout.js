// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Privacy policy | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Privacy policy",
  description: "How Helixon collects, uses and protects personal data. UK GDPR-ready and EU-hosted.",
};

export default function Layout({ children }) {
  return children;
}
