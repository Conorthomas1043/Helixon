// The frame for Helixon's public, account-free pages (scorecards, client
// shortlist reviews, references, applications): a centred white card with
// the Helixon mark - or the agency's name when the page is theirs.

export default function PublicCard({ children, agencyName, width = 560 }) {
  return (
    <main className="min-h-screen flex items-start sm:items-center justify-center px-4 py-10" style={{ background: "var(--mist)" }}>
      <div
        className="w-full rounded-[20px] p-6 sm:p-8"
        style={{ maxWidth: width, background: "white", border: "1px solid var(--border)", boxShadow: "0 20px 50px -20px rgba(11,26,20,0.25)" }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
            <svg width="15" height="15" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            {agencyName || "Helixon"}
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

export function RatingPicker({ value, onChange, label, max = 5 }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className="w-9 h-9 rounded-full text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={value === n ? { background: "var(--forest)", color: "white" } : { border: "1px solid var(--border)", color: "var(--ink)", background: "white" }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
