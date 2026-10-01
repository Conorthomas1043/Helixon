// Private-link pages: never indexed.
export const metadata = { title: "Reference request", robots: { index: false, follow: false } };

export default function ReferenceLayout({ children }) {
  return children;
}
