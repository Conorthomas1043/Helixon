// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Book a demo | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Book a demo",
  description: "See Helixon turn a pile of CVs into a ranked shortlist in minutes. Request a demo and we'll walk you through it.",
};

export default function Layout({ children }) {
  return children;
}
