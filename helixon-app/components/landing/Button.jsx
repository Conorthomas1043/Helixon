"use client";
import { forwardRef } from "react";
import { Button as KitButton } from "@/components/ui";

// The marketing site's call-to-action button: the UI kit's Button
// (components/ui) at the marketing sizes, under the names these pages use.
// `as="a"` with an href renders a link, the same as the kit's `href`.

const VARIANTS = {
  primary: "primary",
  outline: "secondary",
  ghost: "ghost",
  primaryOnDark: "inverse",
  onForest: "inverse",
};

const SIZES = { sm: "md", md: "xl", block: "lg" };

const Button = forwardRef(function Button({ as, variant = "primary", size = "md", className = "", ...props }, ref) {
  return (
    <KitButton
      ref={ref}
      variant={VARIANTS[variant] || "primary"}
      size={SIZES[size] || "xl"}
      className={`${size === "block" ? "w-full" : ""} ${className}`.trim()}
      {...props}
    />
  );
});

export default Button;
