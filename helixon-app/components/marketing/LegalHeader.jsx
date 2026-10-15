import Link from "next/link";

// The header every legal page shares (terms, privacy, cookies, DPA,
// complaints): a "Helixon / Legal" trail, the title, a one-paragraph intro
// and a line of facts (dates, version, contact, print). Long documents with
// a contents column (privacy, DPA) use the wide measure; short ones the
// narrow reading measure, matching their body below.
export const LEGAL_WIDTH = { wide: "max-w-[1100px]", narrow: "max-w-[720px]" };

export default function LegalHeader({ title, intro, meta, width = "narrow" }) {
  return (
    <header className="border-b bg-white border-[var(--border)]">
      <div className={`${LEGAL_WIDTH[width]} mx-auto px-6 pt-14 pb-10`}>
        <p className="text-12 font-medium mb-3 text-[var(--ink-faint)]">
          <Link href="/" className="hover:underline">
            Helixon
          </Link>
          <span className="mx-1.5">/</span>Legal
        </p>
        <h1 className="text-3xl sm:text-40 font-semibold tracking-tight leading-tight mb-4 text-[var(--ink)] font-display">{title}</h1>
        <p className="text-15 leading-relaxed max-w-2xl text-[var(--ink-soft)]">{intro}</p>
        {meta && <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-12 text-[var(--ink-soft)]">{meta}</div>}
      </div>
    </header>
  );
}
