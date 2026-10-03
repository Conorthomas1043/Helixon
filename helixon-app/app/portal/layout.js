// Private-link pages: never indexed.
export const metadata = { title: "Your details", robots: { index: false, follow: false } };

export default function Layout({ children }) {
  return children;
}
