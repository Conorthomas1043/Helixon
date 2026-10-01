// Private-link pages: never indexed.
export const metadata = { title: "Interview scorecard", robots: { index: false, follow: false } };

export default function ScorecardLayout({ children }) {
  return children;
}
