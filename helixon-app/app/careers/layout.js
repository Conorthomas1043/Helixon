// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Careers | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Careers",
  description: "Join Helixon and help build candidate-screening software that recruiters rely on. See our open roles.",
};

export default function Layout({ children }) {
  return children;
}
