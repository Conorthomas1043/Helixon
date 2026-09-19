// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Terms of service | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Terms of service",
  description: "The terms that apply when you use Helixon to screen candidates.",
};

export default function Layout({ children }) {
  return children;
}
