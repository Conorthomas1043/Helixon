// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Create your account | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Create your account",
  description: "Finish setting up your Helixon account.",
  robots: { index: false },
};

export default function Layout({ children }) {
  return children;
}
