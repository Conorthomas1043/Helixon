// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "About | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "About",
  description: "Helixon builds candidate-screening software for recruitment agencies. Meet the team and the thinking behind faster, fairer shortlists.",
};

export default function Layout({ children }) {
  return children;
}
