"use client";

import { usePathname } from "next/navigation";

// Keying on pathname remounts this wrapper on every settings-page
// navigation, replaying the fade. Kept deliberately subtle — no slide,
// no scale — in line with the product's restrained motion language.
export default function PageTransition({ children }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-[fadeIn_0.25s_ease-out]">
      {children}
    </div>
  );
}