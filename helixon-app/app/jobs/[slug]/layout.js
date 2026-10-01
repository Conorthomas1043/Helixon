// An agency's public jobs pages. The page itself sets the title.
export default function AgencyJobsLayout({ children }) {
  return <div className="min-h-screen" style={{ background: "var(--mist)" }}>{children}</div>;
}
