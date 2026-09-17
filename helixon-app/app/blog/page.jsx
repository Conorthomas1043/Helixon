"use client";

import { useState } from "react";
import ChatWidget from "@/components/landing/ChatWidget";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

// ═══════════════════════════════════════════════════════════════════════════
// Blog / Resources - article grid with category filter. Same nav/footer/
// tokens as the rest of the marketing site.
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  "All",
  "Recruiting tips",
  "Product updates",
  "Industry",
];

const POSTS = [
  {
    title: "Why CV keyword-matching gets senior hires wrong",
    category: "Recruiting tips",
    date: "Jul 28, 2026",
    read: "6 min read",
    excerpt:
      "Keyword filters reward CVs written for the algorithm, not the role. Here's what to check instead when you're screening for a senior hire.",
  },
  {
    title: "Introducing bulk upload for Solo and Team plans",
    category: "Product updates",
    date: "Jul 14, 2026",
    read: "3 min read",
    excerpt:
      "Score an entire shortlist at once instead of one CV at a time - now live for Solo and Team accounts.",
  },
  {
    title: "The real cost of a slow screening process",
    category: "Industry",
    date: "Jun 30, 2026",
    read: "5 min read",
    excerpt:
      "Strong candidates don't wait. A look at how screening speed affects offer-acceptance rates across UK agencies.",
  },
  {
    title: "Five red flags worth asking about (not rejecting for)",
    category: "Recruiting tips",
    date: "Jun 18, 2026",
    read: "4 min read",
    excerpt:
      "Employment gaps and short tenures aren't automatic no's - they're conversation starters. Here's how to read them.",
  },
  {
    title: "How we score seniority when job titles don't match",
    category: "Product updates",
    date: "Jun 2, 2026",
    read: "4 min read",
    excerpt:
      "A candidate titled 'Team Lead' at one company might be doing 'Manager' work at another. Here's how Helixon accounts for that.",
  },
  {
    title: "What agency recruiters told us about their week",
    category: "Industry",
    date: "May 20, 2026",
    read: "7 min read",
    excerpt:
      "We surveyed 40 UK recruitment agencies about where their time actually goes. Screening topped the list.",
  },
];

export default function BlogPage() {
  const [active, setActive] = useState("All");

  const filtered =
    active === "All"
      ? POSTS
      : POSTS.filter((post) => post.category === active);

  return (
    <>
      <main
        className="min-h-screen"
        style={{ background: "var(--mist)" }}
      >
        <MarketingNav active="blog" />

        <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-10 text-center">
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6"
            style={{
              background: "var(--mint)",
              color: "var(--forest)",
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>

            Resources for recruiters
          </span>

          <h1
            className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5 max-w-xl mx-auto"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-display)",
            }}
          >
            The Helixon blog.
          </h1>

          <p
            className="text-sm leading-relaxed max-w-md mx-auto"
            style={{ color: "var(--ink-soft)" }}
          >
            Screening tips, product updates, and what we&apos;re learning from
            agencies using Helixon every day.
          </p>
        </section>

        <section className="max-w-[1100px] mx-auto px-6 pb-6">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActive(category)}
                className="text-xs font-semibold px-3.5 py-2 rounded-full transition-colors"
                style={{
                  background:
                    active === category ? "var(--forest)" : "white",
                  color:
                    active === category ? "white" : "var(--ink-soft)",
                  border:
                    active === category
                      ? "1px solid var(--forest)"
                      : "1px solid var(--border)",
                }}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="max-w-[1100px] mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((post) => (
              <a
                key={post.title}
                href="#"
                className="rounded-[16px] p-6 flex flex-col transition-transform hover:-translate-y-0.5"
                style={{
                  background: "white",
                  border: "1px solid var(--border)",
                  boxShadow:
                    "0 12px 24px -18px rgba(19,32,27,0.25)",
                }}
              >
                <span
                  className="inline-flex text-[9px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full mb-4 self-start"
                  style={{
                    background: "var(--mint)",
                    color: "var(--forest)",
                  }}
                >
                  {post.category}
                </span>

                <h2
                  className="text-sm font-semibold mb-2 leading-snug"
                  style={{
                    color: "var(--ink)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {post.title}
                </h2>

                <p
                  className="text-xs leading-relaxed mb-4 flex-1"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {post.excerpt}
                </p>

                <div
                  className="flex items-center gap-2 text-[10px]"
                  style={{ color: "var(--ink-faint)" }}
                >
                  <span>{post.date}</span>
                  <span>·</span>
                  <span>{post.read}</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="max-w-[1100px] mx-auto px-6 pb-24">
          <div
            className="rounded-[20px] px-8 py-14 text-center"
            style={{ background: "var(--forest)" }}
          >
            <h2
              className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Get new posts in your inbox.
            </h2>

            <p
              className="text-xs mb-8 max-w-md mx-auto"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              No spam - just the occasional screening tip or product update.
            </p>

            <form className="flex flex-col sm:flex-row gap-2.5 max-w-sm mx-auto">
              <input
                type="email"
                required
                placeholder="you@agency.com"
                aria-label="Email address"
                className="flex-1 text-sm px-4 py-3 rounded-[10px] focus:outline-none"
                style={{ border: "none" }}
              />

              <button
                type="submit"
                className="text-sm font-semibold px-5 py-3 rounded-[10px] transition-transform hover:scale-[1.02]"
                style={{
                  background: "white",
                  color: "var(--forest)",
                }}
              >
                Subscribe
              </button>
            </form>
          </div>
        </section>

        <MarketingFooter />
      </main>
      <ChatWidget />
    </>
  );
}
