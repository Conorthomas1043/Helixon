// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Log in | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Log in",
  description: "Log in to your Helixon account to screen candidates and manage your pipeline.",
  robots: { index: false },
};

export default function Layout({ children }) {
  return children;
}
