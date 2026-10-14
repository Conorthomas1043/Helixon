import { Geist_Mono, Inter, Outfit } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import SiteAnnouncement from "@/components/SiteAnnouncement";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { CLERK_PROVIDER_APPEARANCE } from "@/lib/ui/clerk-appearance";
import "./globals.css";

// Every font the site uses, self-hosted through next/font rather than a Google
// Fonts stylesheet, which would be a render-blocking request to a third-party
// origin on every page. next/font serves them from our own domain with
// size-matched fallbacks, so text doesn't jump when the web font arrives.
// globals.css maps these onto --font-display/-body/-mono.
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  // Numbers and the Clerk widgets only; not worth a preload on every page.
  preload: false,
});


const TITLE = "Helixon - AI CV screening for recruitment agencies";
const DESCRIPTION =
  "AI CV screening and a recruitment CRM for agencies: score every CV against the job with the evidence behind it, then run shortlists, interviews, placements and invoices in one place.";

export const metadata = {
  metadataBase: new URL("https://www.helixon.co.uk"),
  // Pages set a short title ("Pricing"); the template makes it "Pricing | Helixon".
  // The homepage (and anything without its own title) uses the default.
  title: { default: TITLE, template: "%s | Helixon" },
  description: DESCRIPTION,
  // "./" = this page's own URL, so every page gets a self-referencing canonical
  // tag (resolved against metadataBase, so always the www address).
  alternates: { canonical: "./" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Helixon",
    type: "website",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default async function RootLayout({ children }) {
  // Every page renders per request (it already did: ClerkProvider reads the
  // request), so Next can put the CSP nonce from proxy.ts on its scripts.
  // A prerendered page's scripts would have no nonce and be blocked.
  await connection();
  // Leaves room for the workspace tab strip on the first render when this
  // browser has tabs (lib/hooks/useWorkspaceTabs.js), so the page doesn't jump.
  const hasWorkspaceTabs = (await cookies()).get("helixon_ws_tabs")?.value === "1";
  return (
    <ClerkProvider
      // Reads this request's CSP nonce (set by proxy.ts) and puts it on
      // Clerk's own <script> tags; without it the strict policy blocks them
      // and sign-in never loads.
      dynamic
      // Application paths, mirroring the Clerk dashboard (Configure >
      // Paths). Set here as well so the app doesn't depend on the dashboard
      // values staying in sync - these win when they differ.
      signInUrl="/login"
      signUpUrl="/signup"
      afterSignOutUrl="/login"
      appearance={CLERK_PROVIDER_APPEARANCE}
      localization={{
        signIn: {
          start: {
            // Default Clerk copy is "Don't have an account? Sign up",
            // which reads as "create a free account" - this app's signup
            // is checkout-gated (app/login's signUpUrl goes to /pricing,
            // not a signup form), so the link text says that plainly
            // instead of surprising people. `localization` is a
            // ClerkProvider-level option, not a per-component prop - it
            // does nothing if passed to <SignIn/> directly.
            actionText: "New to Helixon?",
            actionLink: "See plans & sign up",
          },
        },
      }}
    >
      <html lang="en-GB" className={`${outfit.variable} ${inter.variable} ${geistMono.variable} h-full`} data-ws-tabs={hasWorkspaceTabs ? "" : undefined}>
        <body className="min-h-full flex flex-col antialiased">
          {/* Admin-set banner (/admin/site); renders nothing unless one is on. */}
          <SiteAnnouncement />
          {children}
          {/* Site-wide, not just the marketing homepage - see
              CookieConsentBanner.jsx for why. */}
          <CookieConsentBanner />
          <SpeedInsights />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
