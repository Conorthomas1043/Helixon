"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import Logo from "@/components/marketing/Logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      ["How it works", "/how-it-works"],
      ["Pricing", "/pricing"],
      ["Features", "/#features"],
      ["FAQ", "/faq"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Careers", "/careers"],
      ["Blog", "/blog"],
      ["Product updates", "/updates"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy Policy", "/privacy"],
      ["Terms of Service", "/terms"],
      ["Cookie Policy", "/cookie-policy"],
      ["Data Processing Agreement", "/dpa"],
      ["Complaints", "/complaints"],
    ],
  },
];

export default function MarketingFooter() {
  const { isLoaded, isSignedIn } = useUser();
  const signedIn = isLoaded && isSignedIn;

  return (
    <footer className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1100px] mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2 sm:col-span-1">
          <div className="mb-3">
            <Logo size="footer" />
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--ink-faint)" }}>
            Candidate screening built for recruitment agencies. GDPR-ready, EU-hosted.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>
              {col.title}
            </p>
            {/* 13px text with a 36px-tall hit area: the links were ~13px tall,
                too small to tap reliably on a phone. */}
            <ul className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="inline-flex items-center min-h-[36px] hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
            © {new Date().getFullYear()} Helixon. Screen candidates in seconds.
          </span>
          <Link href={signedIn ? "/dashboard" : "/login"} className="inline-flex items-center min-h-[36px] text-xs hover:underline" style={{ color: "var(--ink-faint)" }}>
            {signedIn ? "Dashboard" : "Login"}
          </Link>
        </div>
      </div>
    </footer>
  );
}
