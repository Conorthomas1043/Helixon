// Private feedback links: never in search results.
export const metadata = { title: "Feedback", robots: { index: false, follow: false } };

export default function FeedbackLayout({ children }) {
  return children;
}
