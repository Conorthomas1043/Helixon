import AppNav from "@/components/AppNav";
import SettingsNav from "@/components/account/SettingsNav";
import PageTransition from "@/components/account/PageTransition";

export const metadata = {
  title: "Account settings - Helixon",
};

// Server component: it renders client components (AppNav, SettingsNav,
// PageTransition) but doesn't need interactivity itself, so it stays out
// of the client bundle.
export default function AccountLayout({ children }) {
  return (
    <main className="min-h-screen scroll-smooth" style={{ background: "var(--mist)" }}>
      <AppNav active="account" />

      <section className="max-w-[880px] mx-auto px-6 pt-14 pb-8">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-5" style={{ background: "var(--mint)", color: "var(--forest)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" />
          </svg>
          Acme Recruiting
        </span>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Account settings
        </h1>
        <p className="text-sm mt-3 max-w-md" style={{ color: "#5a7a6a" }}>
          Manage your profile, security, and notification preferences.
        </p>
      </section>

      <div className="max-w-[880px] mx-auto px-6 pb-20">
        <div className="flex flex-col sm:flex-row gap-8">
          <SettingsNav />
          <div className="flex-1 min-w-0">
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
      </div>
    </main>
  );
}