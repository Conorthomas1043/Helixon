# Homepage: hero demo, scroll story and visual refresh

**Date:** 17 October 2026 · **Status:** built

## Goal

The homepage looked good but had no "wow". Make a recruiter feel it in the first seconds by **watching the product work**, tell the workflow as you **scroll**, and give the page a **light visual refresh**. Keep the brand colours and keep it professional.

## What changed

**Hero demo** (`components/landing/HeroDemo.jsx`). Eight CVs for one role land as an untidy pile. Each is scanned in turn, a signal-coloured pass that leaves its score behind. Then they re-sort into a ranked shortlist, with the top three marked and the reason behind each score. It plays once, then offers Replay.

**Scroll story** (`components/landing/ScrollStory.jsx`). Four steps: upload the pile, score every CV against the same spec, rank with reasons, then shortlist, share and place.
- **Wide screens:** the step text scrolls past on the left, beside a progress rail. A pinned panel on the right shows the active step's product view, and each view animates in.
- **Narrower screens:** each step's view sits under its text and plays as it scrolls into view.

It replaces the "screening by hand vs with Helixon" section and the tabbed workflow preview, which told the same story twice.

**Visual refresh.**
- A soft brand glow and a dot grid behind the hero.
- A drawn underline under "read one."
- Texture on the deep-green panels (the trust section and CTA band).
- Icon tiles and a hover lift on the feature cards.
- Balanced line breaks in headings.

All colours come from the tokens, so light and dark both work.

## Decisions

- **Motion library.** Motion 13.5.1 (Framer Motion), loaded through `LazyMotion` with `m` components (`components/motion/MotionProvider.jsx`, shared with the app since). Its features arrive as a separate chunk after the page, so they aren't in the first bundle. Chosen over hand-built animation for the layout re-sorts and the scroll story's polish, at the cost of one dependency.
- **Content never blanks in front of the visitor.** The server renders the finished state:
  - the ranked shortlist in the hero;
  - every story step stacked, each view finished.

  The hero never hides something the visitor already sees. A card on screen when the page hydrates (desktop) shuffles its finished list back into a pile and plays from there. Only a card still off screen (phones) starts hidden, and drops in when it scrolls into view.
- **Reduced motion.** Everything stays finished, there's no Replay, and the pinned story panel changes with a fade only (`MotionConfig reducedMotion="user"`).
- **Without JavaScript.** The finished hero and the stacked story, with no buttons that wouldn't work.
- **Only layout positions animate.** Animating size as well stretched the text while a CV card turned into a list row.
- **Coral stays a signal.** It appears only for live moments (the scan pass and the status dot), never as decoration, as the token file asks.

## Checks

- An axe scan in light and dark, at desktop and phone width (`e2e/public-screens.spec.js`).
- No sideways scrolling at 200% text.
- The finished states under reduced motion and without JavaScript.
- The full unit and e2e suites.
