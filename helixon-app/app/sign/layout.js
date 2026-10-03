// Private-link pages: never indexed.
export const metadata = { title: "Sign a document", robots: { index: false, follow: false } };

export default function Layout({ children }) {
  return children;
}
