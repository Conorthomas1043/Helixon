import Link from "next/link";

// Header and footer around an agency's public jobs pages.
export function JobsHeader({ agency }) {
  return (
    <header className="bg-white" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="mx-auto max-w-[900px] px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href={`/jobs/${agency.careers_slug}`} className="text-[17px] font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          {agency.name}
        </Link>
        {agency.careers_website && (
          <a href={/^https?:\/\//.test(agency.careers_website) ? agency.careers_website : `https://${agency.careers_website}`} className="text-[14px] underline" style={{ color: "var(--ink-soft)" }} rel="noopener noreferrer">
            Our website
          </a>
        )}
      </div>
    </header>
  );
}

export function JobsFooter({ agency }) {
  return (
    <footer className="mx-auto max-w-[900px] px-4 sm:px-6 py-10 text-[13px] flex flex-wrap gap-x-4 gap-y-2" style={{ color: "var(--ink-faint)" }}>
      <Link href={`/jobs/${agency.careers_slug}/privacy`} className="underline">How we use your data</Link>
      <span>Jobs powered by Helixon</span>
    </footer>
  );
}
