# Helixon: website psychology & UX audit

Scope: the public marketing site and conversion flows (home, `/pricing`, `/demo`, `/how-it-works`, `/faq`, checkout success), plus site-wide performance that affects first impressions. The signed-in dashboard was not audited in depth.

## Summary

The site already has a solid base: one clear audience (agency recruiters), outcome-led headlines, a product preview in the hero instead of stock imagery, good reduced-motion handling, and a deliberate "no invented numbers" policy.

The biggest problems were **trust leaks**. Pages contradicted each other, and some claims didn't match what the product does. A recruiter checking a vendor that handles candidate data will notice "EU servers" on one page and "Switzerland" on another. Next came **friction at the two conversion points**: a false "you must be signed in" warning on `/pricing`, and a bare demo form that gave no reason to trust it.

## Fixed in this branch

### 1. Credibility: claims now match the product and each other

| Where | Was | Now | Why |
|---|---|---|---|
| Home features + upload tab | "PDF, Word, scanned and photographed CVs" / "scanned or typed" | "PDF and Word CVs, tables and columns included" / "PDF or Word (.docx)" | Upload accepts only `.pdf`/`.docx` (`CV_ACCEPT`), and image-only scans fail text extraction. A visitor who uploads a phone photo after reading this stops trusting every other claim. |
| How it works | "scanned exports" | removed | Same reason. |
| How it works badge, FAQ | "Under 30 seconds" / "Around 30 seconds" | "Under a minute per CV" | The homepage and site metadata say under a minute, and the code notes an analysis runs several model calls in sequence. |
| How it works, FAQ | "EU servers" | "Switzerland, which the UK and EU recognise as adequate" | Switzerland isn't in the EU. The homepage, DPA and privacy policy all say Swiss. |
| `/pricing` badge | "Most popular" | "Recommended for agencies" | No data backs "most popular" (UK CAP code requires substantiation), and the homepage already uses "Recommended for agencies". |
| `/pricing` footnote | "You must be signed in before starting checkout" | "No account needed first: you'll set one up straight after checkout" | This was false. `/api/checkout` is built for guest checkout. The old line sent buyers to a login page where they had no account. |

### 2. Pricing page: less risk, fewer dead ends
- **Positive framing:** "No three-analysis trial. No fake limits." became "Unlimited screening on both plans. Monthly billing, no contract, cancel anytime." The old line led with a dig at competitors; the new one says what the buyer gets.
- **Risk-reversal microcopy under each button:** "Billed monthly · Cancel anytime". People feel the risk most at the moment they click to pay.
- **A path for undecided visitors:** a "Not sure which plan fits? Get a demo" panel. Before, the only choices were to pay or leave.
- **Objections answered on the page:** a "Before you choose" block covers contract, unlimited use, whether an account is needed, and where data is kept. Every answer matches the homepage FAQ and the checkout code.
- **Readability:** feature lists went from 12px to 14px. Card descriptions have a fixed height so the two "Choose" buttons line up.

### 3. Demo page (the site's main conversion goal)
- **"What happens next" panel:** reply within one business day, a run-through on your own CVs, no obligation. A bare form makes visitors fear a hard sell; spelling out the steps removes that uncertainty. Each promise was already made elsewhere on the site.
- **Benefit-led headline:** "Get a demo" became "See Helixon on your own CVs". The reply-time promise is now in the subtitle, so phone users see it without scrolling.
- **Trust chips:** Swiss-hosted · GDPR-ready · Never used to train AI.
- **Privacy line under the submit button**, linking to the privacy policy.
- **Errors appear under the field they belong to**, with `aria-invalid` and `aria-describedby`, and focus moves to the first invalid field. Before, there was one generic message box, and `aria-describedby` pointed at an element that didn't exist.
- **Autofocus only on mouse/trackpad devices.** On phones it used to pop the keyboard up before the visitor had read the page.
- **Focus moves to the confirmation after submitting**, and there's a next step ("See an example analysis") instead of a dead end.
- Uses the shared `Logo` component instead of a copy-pasted SVG. The nav stays deliberately minimal with no exit links.

### 4. Homepage
- **Hero reassurance:** "See it on your own CVs, no obligation. Plans from £249 a month." This tells people what the main CTA leads to, which is the usual hesitation before clicking "Get a demo".
- **The "Not sure yet?" pricing tile** had an empty slot where the price should be. It now reads "Demo · on your own CVs" with an extra benefit line.
- **Readable loading state on the buy buttons:** white on `--ink-mute` was 1.83:1 contrast. The button now keeps its colours and dims slightly.
- **Shared checkout logic:** home and `/pricing` each had their own checkout code and had drifted. `/pricing` crashed on a non-JSON error response. Both now use `lib/start-checkout.js`.

### 5. FAQ page
- "Do I need a card to try it? Yes…" became "Is there a free trial?" Same honest answer, but it now offers the low-risk options (a demo on your own CVs, monthly billing, cancel anytime).
- The accordion now matches the homepage one for accessibility: `type="button"`, `aria-controls`, labelled regions, and `inert` on closed answers so screen readers skip hidden text. Max height went from 200px to 400px because long answers were being cut off on phones.
- **FAQPage structured data** (JSON-LD) lets search results show answers directly. The content moved to `lib/faq-content.js` so the server route can read it.

### 6. Performance: self-hosted fonts
- Every page loaded a **render-blocking Google Fonts stylesheet from another domain**, covering four families. Fraunces was in it even though only three legal pages use it.
- Fonts now load through `next/font`: served from our own domain, Outfit and Inter preloaded, Geist Mono and Fraunces loaded on demand, and size-matched fallback fonts so text doesn't jump when the web font arrives (less layout shift).
- `--font-display`, `--font-body` and `--font-mono` now point at the next/font variables. The legal pages and admin UI font stacks were updated to match.

### 7. Checkout success
- The "We couldn't confirm that payment" screen now links to Contact. Someone who might have been charged needs a person to talk to, not just a link back to pricing.

## Recommended next steps (need data or a business decision)

These would likely do more for conversion than anything above. Each needs facts the code doesn't have, so none were invented.

1. **Social proof (highest impact).** There are no testimonials, customer logos, case studies or usage figures anywhere on the site. For a B2B tool at £249–£349/month, this is the biggest missing trust signal. Add one or two real, attributed quotes, ideally with a measured result ("cut screening time from X to Y"), near the hero and next to pricing.
2. **Agency plan seat count.** "Team access" doesn't say how many people are included. That leaves buyers guessing and makes the £100 step up hard to judge. State it plainly, e.g. "Up to N recruiters".
3. **Risk reversal at payment.** There's no free trial (by choice). A first-month money-back guarantee, or a "cancel within 14 days for a full refund" line, would cut the risk of paying without a trial.
4. **Annual billing option.** A discounted annual price beside the monthly one anchors the monthly price as flexible and improves cash flow.
5. **Self-serve "try one CV" sample.** The example analysis is static. Letting a visitor score one sample CV against one sample role, before giving an email, is the strongest way to show the product works. It would need limits on cost and abuse.
6. **Funnel measurement.** `checkout_started` and `demo_request_submitted` exist. Add `demo_form_started` (first field focus) and pricing-page views so form abandonment and pricing drop-off can be measured. Test changes with A/B tests rather than guessing.
7. **Homepage length.** There are 12 sections, and pricing is about tenth. Test a shorter page, or a version that moves pricing above "Agency workflow", against the current one.
8. **Homepage as a server component.** All of `app/page.js` is a client component, so every static section ships JavaScript to the browser. Splitting it into a server-rendered shell with small interactive client parts would cut JS on the most-visited page.
9. **Tighten the CSP.** `fonts.googleapis.com` and `fonts.gstatic.com` are still allowed in `next.config.mjs`. Once nothing else needs them, they can come out.
10. **Existing lint debt.** `app/dpa`, `app/updates` and `app/cookie-policy` have existing `no-html-link-for-pages` and `no-unescaped-entities` errors that this branch didn't introduce.

## Verification
- `npm test`: 85 files, 481 tests passing.
- `eslint` is clean on every changed marketing file. This also fixes 2 existing errors in `app/pricing/page.js`.
- `next build` succeeds. The changed pages were rendered from a production build and screenshotted at 1280px and 390px. Headings render in Outfit with the size-matched fallback. On the demo form, an invalid email sets `aria-invalid`, links its error message, and moves focus to the field.
