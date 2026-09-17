import Button from "@/components/landing/Button";

/**
 * The dark-forest "final CTA" band, previously copy-pasted per marketing
 * page. Content varies by page via props; chrome (background, radius,
 * spacing, button styling) stays identical everywhere.
 */
export default function CtaBand({
  heading,
  body,
  ctaLabel = "Get a demo",
  ctaHref = "/demo",
  showArrow = true,
}) {
  return (
    <section className="max-w-[1100px] mx-auto px-6 pb-24">
      <div className="rounded-[20px] px-8 py-14 text-center" style={{ background: "var(--forest)" }}>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 text-white" style={{ fontFamily: "var(--font-display)" }}>
          {heading}
        </h2>
        {body && (
          <p className="text-xs mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.75)" }}>
            {body}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Button as="a" href={ctaHref} variant="onForest" className="motion-safe-scale hover:scale-[1.02] min-h-[48px] w-full sm:w-auto">
            {ctaLabel}
            {showArrow && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
