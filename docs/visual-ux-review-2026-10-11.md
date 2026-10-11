# Helixon: visual design, code design and UX review

**Date:** 11 October 2026 · **Branch:** `claude/amazing-bohr-m1a3oz` (same tree as `main` at "Typed response contracts for candidates, jobs and billing")

## How this was done

- **Rendered pages.** The app ran locally with CI's placeholder keys. Fourteen public routes were screenshotted in Chromium at 1440px and 390px wide, and scanned with axe-core against WCAG 2.0, 2.1 and 2.2 AA.
- **Read the code.** The token file, the shared UI kit, the five per-area kit wrappers, the dashboard nav, the landing page, the auth pages and the staff portal login were read in full. Every front-end file was measured for hard-coded colours, inline styles, arbitrary sizes and untyped buttons.
- **Checked against the earlier audits.** `docs/design-audit.md`, `docs/code-design-audit.md` and the two UX audits list fixes and "not done" items. Each open item was re-checked against today's code.

**Limits.** The signed-in app (dashboard, Screen, candidate profile, admin console) needs a real Clerk session and database, so it was judged from code, not from screenshots. Clerk's sign-in widget could not load in this sandbox.

---

## Verdict

Helixon looks like a calm, trustworthy B2B product, and most of the hard UX thinking has already been done. The marketing site and the shared UI kit are at a professional standard. axe found **no WCAG violations** on any rendered page, and no page scrolls sideways on a phone.

What holds it back is not taste, it is **consistency of implementation**. The product is styled four different ways, which shows up as small drifts in size, radius and colour from screen to screen. A few first-impression screens also fail ungracefully when a script is slow.

| Dimension | Score /10 | One line |
|---|---:|---|
| Visual design, marketing site | 8.5 | Restrained palette, strong type, real product previews instead of stock art |
| Visual design, product (from code and kit) | 7.5 | Good kit; drift from inline styles and off-scale sizes |
| UX, marketing | 7.5 | Clear story and one CTA; the homepage is very long on phones |
| UX, product (from code) | 7.5 | Well-reasoned IA with hints; dense nav, very stateful screens |
| Accessibility | 8.5 | Zero axe violations, skip links, reduced-motion everywhere |
| Front-end code design | 6.0 | Good tokens and kit, but the kit is bypassed in most files |
| **Overall** | **7.5** | Up from 6.5 in the earlier design audit |

---

## 1. First impression

- **Homepage hero (desktop).** The eye lands on the headline, then the ranked-candidates card. That is the right order. The card shows the product's actual output with a score, a band and the evidence. It sells better than any illustration would.
- **The example analysis section** is the strongest screen in the product. It explains a score in plain terms: requirement, CV quote, gap, interview question. It is the best argument for the product and deserves to sit higher on the page.
- **Pricing** is clean and honest. Two plans, the recommended one inverted in forest green, and FAQs that answer the real objections.
- **404 page** is on-brand, friendly and routes visitors to the homepage rather than a login wall.

## 2. Visual design

### What works

- **One palette with a reason for each colour.** Forest is the brand. Gold is secondary. Coral is reserved for score moments only. Three score-band colours are shared across the app. The comments in `app/globals.css` explain each decision.
- **Type pairing.** Outfit for headings and Inter for body is a confident, modern pairing. Mono is limited to numbers.
- **Motion with restraint.** One shared vocabulary of fade-up, lift, shimmer and value flash, each with a reduced-motion fallback.
- **Admin console** has its own dark theme driven by the same `--ui-*` tokens, so the kit renders correctly in both.

### Findings

| Finding | Severity | Recommendation |
|---|---|---|
| **Clerk sign-in widgets are set in Geist Mono.** The `ClerkProvider` appearance sets the widget font to monospace, so the login and sign-up forms read like a terminal next to an Inter page | 🟡 Moderate | Set the Clerk font to the body font variable. Keep mono for figures only, as the rest of the app does |
| **The login hero speaks a different voice.** "AI-powered recruitment, Match the right candidate, faster" and an "∞ analyses" stat differ from the marketing site's plainer tone | 🟢 Minor | Reuse the homepage promise and the three proof points from the stats strip |
| **Twenty different arbitrary font sizes** are in use, from 10px to 52px. Twelve of them appear fewer than ten times | 🟡 Moderate | Define a type scale of about seven steps as theme tokens, and snap the rare sizes to it as files are touched |
| **Seventeen different corner radii** are hard-coded, from 3px to 28px. The tokens define only 10px and 14px | 🟡 Moderate | Add small, medium, large and pill radius tokens, and map the rest onto them |
| **Uppercase, letter-spaced field labels** in the kit's `Field`. All-caps at 12px in the faint ink is harder to scan in long forms than sentence case | 🟢 Minor | Keep uppercase for eyebrows. Use sentence-case 13–14px labels in the ink-soft colour for form fields |
| **Staff portal hard-codes Tailwind's slate and red** in call outcomes and goals, which sit outside the brand palette | 🟢 Minor | Map outcome tones onto the kit's `Pill` tones |

## 3. Usability

| Finding | Severity | Recommendation |
|---|---|---|
| **Staff portal login shows only a spinner** until a session check returns. There is no heading, form or timeout. On a slow or failed request, staff see an endless spinner | 🔴 Critical for staff | Render the form immediately and redirect if the session check succeeds. Give the page a title and an `h1` |
| **The customer login has no fallback if Clerk fails to load.** The right-hand panel is an empty white card. Ad-blockers and strict networks are a common cause | 🟡 Moderate | Show a skeleton, then after a few seconds a message with a retry and a support link |
| **The homepage is very long on phones.** It runs to about 15,000px, roughly eighteen screens. The key proof, the example analysis, sits several screens down | 🟡 Moderate | Move the example analysis up to follow the hero. Collapse the before-and-after and bulk-screening sections into one |
| **The 404 page has no page title.** Browser tabs and history show the homepage title | 🟢 Minor | Export metadata with the title "Page not found" |
| **Dashboard nav density.** Seven tabs, a "More" menu of twelve items, search, notifications, presence avatars and a user menu share one bar. On phones the tabs become a horizontal scroller | 🟡 Moderate | Consider a left sidebar on desktop for the twelve "More" items. On phones, a bottom tab bar of four primary destinations would be easier to reach than a scrolling strip |
| **Eight native `confirm()` or `alert()` calls remain** although a styled confirm hook exists | 🟢 Minor | Move them onto the shared confirm dialog so destructive steps look and behave the same everywhere |
| **The `lang` attribute is `en`**, while the site writes in British English and sets the `en_GB` locale for Open Graph | 🟢 Minor | Use `en-GB` so screen readers and spellcheck pick the right dialect |

## 4. Consistency and code design

This is the biggest opportunity. The foundation is good: one token file, one UI kit, and a ratchet test that stops numbers from getting worse. The problem is that most screens bypass the kit.

**Measured today:**

| Measure | Count |
|---|---:|
| Inline `style={{…}}` objects | 3,242 |
| Hard-coded hex colours outside the token files | 445 |
| Distinct arbitrary font sizes | 20 |
| Distinct arbitrary radii | 17 |
| Fixed pixel widths | 144 |
| `<button>` elements without a `type` | 142 |
| Separate `Button` implementations | 3 |
| Separate toast systems | 3 |
| Separate icon sets | 4 |

**Findings:**

- **Four styling methods in one codebase.** Tailwind token classes, Tailwind arbitrary values, inline style objects that reference CSS variables, and JS constants such as `INK` and `CARD`. The same card is written differently in neighbouring files. This is the root cause of the visual drift above.
- **The marketing site has its own button.** `components/landing/Button.jsx` duplicates the kit's button with different sizes and focus styles. The landing CTA is 14px with 24px padding, while the kit's large button is 15px with 20px padding.
- **Parallel primitives.** Toasts exist in the kit, in the staff portal and in the admin console. Icons exist in four files. Each one is small, but together they mean a fix lands in one place and not the others.
- **Very stateful screens.** The Screen workspace holds 30 `useState` hooks and the candidate extras panel holds 28. That is where interaction bugs hide. A reducer per screen would make the states explicit and testable.
- **Untyped buttons** default to `submit` inside a form. Any of the 142 that end up inside a `<form>` will submit it by accident.
- **Good practice to keep.** The design-token ratchet test, the `ui-gallery` page that shows the kit in both themes, comments that explain why, and the area wrappers that re-export the kit.

## 5. Accessibility

- **Colour contrast:** pass. axe found no contrast failures on any rendered page. The token comments record the ratios.
- **Landmarks and headings:** pass on all marketing pages. Each page has exactly one `h1`, a `main` and a skip link. The staff portal login has no `h1` while loading.
- **Touch targets:** mostly pass. A few small links on the Privacy, Contact and Demo pages measure under 24px. They are inline text links, which WCAG 2.5.8 exempts.
- **Motion:** pass. Every animation has a reduced-motion fallback.
- **Focus:** the kit uses a visible focus ring. Nineteen places remove the outline without adding a ring. Each should be checked by keyboard.
- **Tables:** twelve files use `<th>` without `scope`. Add `scope="col"` or `scope="row"` so screen readers announce headers correctly.

## 6. Open items from earlier audits

| Item | Status today |
|---|---|
| Styling consolidation (inline styles, arbitrary sizes) | Open. Inline styles went from 3,249 to 3,242; the ratchet holds the line but nothing drives it down |
| Untyped buttons | Open. Down from 165 to 142 |
| Overview and homepage length | Open. Product decision |
| Legal page bodies in three layouts | Open |
| Code design items D1 to D9 (RLS, Sentry maps, schemas, route tests, contracts) | Done in the last commits on `main` |

---

## Priority recommendations

1. **Fix the two auth screens.** Render the staff login form immediately, add a Clerk loading fallback, and set the Clerk font to the body font. These are the first screens a returning user sees, and they are the weakest.
2. **Add type, radius and spacing scales as tokens, then add a lint rule.** Ban new `text-[Npx]`, `rounded-[Npx]` and hex literals in JSX. This turns the ratchet from "no worse" into a clear target.
3. **Retire the landing button and the duplicate toasts and icons.** Give the kit a marketing size and theme instead. One button, one toast system, one icon set.
4. **Migrate the most-used screens off inline styles.** Start with the dashboard pages and the Screen workspace, one file per pull request, using the kit's `Card`, `Pill`, `Field` and `Button`.
5. **Tighten the phone homepage.** Move the example analysis directly under the hero and merge the two process sections.
6. **Clear the small fixes in one sweep.** Add `type` to every button, use `lang="en-GB"`, give the 404 a title, add `scope` to table headers, and replace the remaining native confirms.
7. **Screenshot the signed-in app.** Add a seeded test session to the existing Playwright setup so the dashboard, Screen and candidate profile can be visually checked in CI. This review could not render them.
