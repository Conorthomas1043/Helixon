import { Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  // Only the Clerk widgets use this font; preloading it on every page (home
  // included) logged a "preloaded but not used" warning.
  preload: false,
});

const TITLE = "Helixon - screen candidates in seconds";
const DESCRIPTION =
  "Upload a CV and a job spec, get a match score, the evidence behind it, and what's missing - in under 30 seconds. Built for recruiters who screen at volume.";

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
          colorTextSecondary: "#5a7a6a",
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
      <html lang="en" className={`${geistMono.variable} h-full`}>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>

        <body className="min-h-full flex flex-col antialiased">
          {children}
          <SpeedInsights />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
