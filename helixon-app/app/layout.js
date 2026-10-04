import { Fraunces, Geist_Mono, Inter, Outfit } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import SiteAnnouncement from "@/components/SiteAnnouncement";
import "./globals.css";

// Every font the site uses, self-hosted through next/font. They used to come
// from a Google Fonts stylesheet: a render-blocking request to a third-party
// origin on every page, which held back first paint, and it pulled in
// Fraunces (three legal pages only) everywhere. next/font serves them from
// our own domain with size-matched fallbacks, so text doesn't jump when the
// web font arrives. globals.css maps these onto --font-display/-body/-mono.
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  // Numbers and the Clerk widgets only; not worth a preload on every page.
  preload: false,
});
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  // Display face for the legal pages only.
  preload: false,
});

const TITLE = "Helixon - AI CV screening for recruitment agencies";
const DESCRIPTION =
  "Upload a CV and a job spec, get a match score, the evidence behind it, and what's missing - in under a minute. Built for recruiters who screen at volume.";

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

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      // Application paths, mirroring the Clerk dashboard (Configure >
      // Paths). Set here as well so the app doesn't depend on the dashboard
      // values staying in sync - these win when they differ.
      signInUrl="/login"
      signUpUrl="/signup"
      afterSignOutUrl="/login"
      appearance={{
        variables: {
          colorPrimary: "#0b6e4f",
          colorText: "#13201b",
          colorTextSecondary: "#4a6658",
          colorBackground: "#ffffff",
          borderRadius: "12px",
          fontFamily: "var(--font-geist-mono), monospace",
        },
      }}
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
      <html lang="en" className={`${outfit.variable} ${inter.variable} ${geistMono.variable} ${fraunces.variable} h-full`}>
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
