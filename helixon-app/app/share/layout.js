// Private-link pages: never indexed.
export const metadata = { title: "Shortlist", robots: { index: false, follow: false } };

export default function ShareLayout({ children }) {
  return children;
}
