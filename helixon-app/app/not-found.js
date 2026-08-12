export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--mist)" }}>
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-6" style={{ background: "var(--mint)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Page not found
        </h1>
        <p className="text-xs mb-8 leading-relaxed" style={{ color: "#5a7a6a" }}>
          We scored a lot of CVs, but not whatever page you were looking for. It may have moved, or the link's out of date.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <a href="/" className="text-xs font-semibold px-5 py-3 rounded-[10px] text-white transition-colors" style={{ background: "var(--forest)" }}>
            Go to the app
          </a>
          <a href="/landing" className="text-xs font-semibold px-5 py-3 rounded-[10px] transition-colors" style={{ border: "1px solid var(--border)", color: "#13201b" }}>
            Back to homepage
          </a>
        </div>
      </div>
    </main>
  );
}