// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Blog | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Blog",
  description: "Screening tips, recruitment insight and product news from the Helixon team.",
};

export default function Layout({ children }) {
  return children;
}
