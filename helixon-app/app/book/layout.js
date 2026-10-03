// Private-link pages: never indexed.
export const metadata = { title: "Book an interview", robots: { index: false, follow: false } };

export default function Layout({ children }) {
  return children;
}
