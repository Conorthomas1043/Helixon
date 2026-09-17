import Link from "next/link";

/**
 * Shared brand mark, used by MarketingNav and MarketingFooter. Previously
 * duplicated as inline SVG in app/page.js, app/about, app/pricing, etc.
 */
export default function Logo({ size = "nav", showTagline = false, href = "/" }) {
  const box = size === "footer" ? "w-7 h-7 rounded-[8px]" : "w-8 h-8 rounded-[9px]";
  const icon = size === "footer" ? 15 : 18;

  return (
    <Link href={href} className="flex items-center gap-3 group" aria-label="Helixon home">
      <div
        className={`${box} flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105`}
        style={{ background: "var(--forest)" }}
      >
        <svg width={icon} height={icon} viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
          <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
          <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
        </svg>
      </div>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          Helixon
        </span>
        {showTagline && (
          <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "var(--ink-faint)" }}>
            Built for recruitment agencies
          </span>
        )}
      </span>
    </Link>
  );
}
