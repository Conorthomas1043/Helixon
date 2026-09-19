// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Cookie policy | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Cookie policy",
  description: "Which cookies Helixon uses, why we use them, and how to control them.",
};

export default function Layout({ children }) {
  return children;
}
