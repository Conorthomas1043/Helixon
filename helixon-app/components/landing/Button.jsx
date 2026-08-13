"use client";
import { forwardRef } from "react";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-btn transition-colors duration-200 disabled:cursor-not-allowed disabled:bg-border disabled:text-ink/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2";

const VARIANTS = {
  primary: "bg-forest text-white shadow-sm hover:bg-forest-deep",
  primaryOnDark: "bg-white text-forest hover:bg-mist",
  outline: "border-[1.5px] border-border text-ink hover:bg-mint",
  ghost: "text-ink/60 hover:bg-mint hover:text-ink",
  onForest: "bg-white text-forest hover:bg-mist",
};

const SIZES = {
  sm: "text-xs px-4 py-2.5",
  md: "text-sm px-6 py-3.5",
  block: "text-sm py-3 w-full",
};

/**
 * Shared CTA button. Replaces the pattern of inline style={{background}}
 * plus onMouseEnter/onMouseLeave handlers repeated across the landing page —
 * hover state is now a single Tailwind class, colors come from the
 * :root tokens in globals.css via the @theme mapping instead of hardcoded
 * hex/CSS-var strings.
 *
 * Wrapped in forwardRef so callers can attach a ref (e.g. the nav "Try now"
 * button, which needs a ref for the trial modal's focus-return-on-close
 * behavior) — without this, ref={...} on <Button> would silently no-op.
 */
const Button = forwardRef(function Button(
  {
    as: Tag = "button",
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    className = "",
    children,
    ...props
  },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        children
      )}
    </Tag>
  );
});

export default Button;