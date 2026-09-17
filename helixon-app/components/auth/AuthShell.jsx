import Link from "next/link";

/**
 * Shared chrome for /login and /signup: the ambient mesh background, the
 * dark-forest branding panel (dot grid + diagonal lines + drifting blur
 * orbs + logo), and the right-hand column that hosts the actual auth card.
 * Previously ~130 lines of this were copy-pasted identically between the
 * two pages - only the branding panel's middle/bottom content and its
 * width actually differ per page, so those are the only two slots exposed.
 *
 * The panelIn/driftA/driftB keyframes and reduced-motion override live in
 * app/globals.css (.auth-panel-in / .auth-drift-a / .auth-drift-b) instead
 * of a per-page inline <style> tag, so both pages share one definition.
 */
export default function AuthShell({
  brandPanelWidthClass = "lg:w-[46%]",
  brandMiddle,
  brandBottom,
  mobileTagline,
  mobileLogoClassName = "mb-2",
  children,
}) {
  return (
    <main className="min-h-screen flex relative overflow-hidden">
      {/* Ambient mesh background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #eef4f0 0%, #e7f0ea 45%, #dcebe0 100%)" }} />
        <div className="absolute w-[620px] h-[620px] rounded-full blur-3xl auth-drift-a" style={{ background: "var(--mint)", opacity: 0.5, top: "-14%", left: "32%" }} />
        <div className="absolute w-[440px] h-[440px] rounded-full blur-3xl auth-drift-b" style={{ background: "var(--forest)", opacity: 0.1, bottom: "-10%", left: "58%" }} />
        <div className="absolute w-[340px] h-[340px] rounded-full blur-3xl auth-drift-a" style={{ background: "var(--signal)", opacity: 0.12, bottom: "12%", left: "72%", animationDirection: "reverse" }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.05] mix-blend-overlay">
          <filter id="auth-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /></filter>
          <rect width="100%" height="100%" filter="url(#auth-grain)" />
        </svg>
      </div>

      {/* Left panel - branding */}
      <div className={`hidden lg:flex ${brandPanelWidthClass} flex-col justify-between p-12 relative overflow-hidden`} style={{ background: "linear-gradient(160deg, #0b3a2a 0%, var(--forest) 55%, #0e4531 100%)" }}>
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: "30px 30px" }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `repeating-linear-gradient(115deg, white 0px, white 1px, transparent 1px, transparent 64px)` }} />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl auth-drift-a" style={{ background: "var(--mint)" }} />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-10 blur-3xl auth-drift-b" style={{ background: "var(--signal)" }} />

        <Link href="/" className="relative z-10 flex items-center gap-3" aria-label="Helixon home">
          <div className="w-9 h-9 bg-white rounded-[10px] flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="var(--forest)" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="var(--forest)" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span className="text-white text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Helixon</span>
        </Link>

        {brandMiddle}
        {brandBottom}
      </div>

      {/* Right panel - hosts the auth card */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative z-10">
        <Link href="/" className={`flex lg:hidden items-center gap-2.5 ${mobileLogoClassName}`} aria-label="Helixon home">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
            <span className="text-white text-sm font-bold">H</span>
          </div>
          <span className="text-base font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>Helixon</span>
        </Link>
        {mobileTagline && (
          <p className="flex lg:hidden text-[12px] mb-6 text-center max-w-xs" style={{ color: "var(--ink-soft)" }}>
            {mobileTagline}
          </p>
        )}

        {children}
      </div>
    </main>
  );
}
