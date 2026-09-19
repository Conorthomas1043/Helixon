// Per-page <title>, description and canonical URL. The page component is a
// client component and can't export metadata itself, so it lives here. The
// title is shown as "Pricing | Helixon" (template set in app/layout.js).
export const metadata = {
  title: "Pricing",
  description: "Simple pricing for recruitment agencies: Individual at £249/month and Agency at £349/month. Unlimited candidate screening with no usage caps.",
};

export default function Layout({ children }) {
  return children;
}
