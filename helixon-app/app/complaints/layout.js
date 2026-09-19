// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Complaints policy | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Complaints policy",
  description: "How to raise a complaint about Helixon and what you can expect from us in response.",
};

export default function Layout({ children }) {
  return children;
}
