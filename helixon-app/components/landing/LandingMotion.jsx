"use client";
// Motion for the homepage's animated sections (HeroDemo, ScrollStory).
//
// LazyMotion with `m` components keeps Motion's features out of the first
// bundle: they load as a separate chunk once the page is up. `strict` makes
// a stray `motion.div` an error instead of quietly pulling the full bundle
// back in. reducedMotion="user" turns transform and layout animations off
// when the visitor's system asks for less motion.
import { LazyMotion, MotionConfig } from "motion/react";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

export default function LandingMotion({ children }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
