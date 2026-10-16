# Helixon landing page: review against Apple's design guidelines

**Date:** 16 October 2026 · **Page:** `/` (`helixon-app/app/page.js`, `components/landing/home-interactive.jsx`, `components/marketing/*`)
**Method:** Apple's Human Interface Guidelines, applied as general rules for a responsive website (accessibility, colour, layout, typography, dark mode, motion, writing, branding). The page ran locally with CI's placeholder keys and was rendered in Chromium at 390px and 1440px wide. axe-core checked it against WCAG 2.0, 2.1 and 2.2 AA plus best practices. Text sizes, tap target sizes and capitalisation were measured from the rendered page. The page was also tested with dark mode, reduced motion and text at 200%.

## Fix status (16 October 2026)

Every finding below is fixed on `main`. The rest of this document describes the page before the fixes.

**Checks after the fixes:** the page was rendered again at 390px and 1440px, in light and dark. axe finds no violations in any of the four. At 200% text nothing scrolls sideways, the menu button stays on screen, and the open FAQ answer shows in full (677px of 677px). Nothing animates on a loop when reduced motion is on.

| Finding | What changed |
|---|---|
| Phone nav loses its menu button at 200% text | The nav bar has a minimum height instead of a fixed one, and wraps |
| FAQ answers cut off at large text | The accordion animates its grid row from `0fr` to `1fr`, so an answer always gets its full height |
| Much of the text at 11px | Section labels, footer headings and plan names are 12px, the hero badge 13px, and section lead paragraphs 16px. Product mock-ups keep 11px |
| No dark mode | The homepage follows the system setting (`.auto-theme` in `globals.css`). Two new tokens, `--on-forest` and `--brand-surface`, split the brand green's two jobs. Other pages stay light until the signed-in app loses its literal whites |
| Green means button, label and good score | The trust strip figures are ink. The "Act" tab's example actions are neutral tags. The agency chips went with their section |
| Page about 17 screens long on a phone | The agency section is folded into the dashboard section, and the "Stay compliant" card is gone. The phone page is 13,562px, down from 14,554px. That is about one screen shorter, not the two estimated, because the larger lead text adds some height back |
| Pipeline labels run together at 1440px | The pipeline and attention list are stacked at every width |
| Phone tap targets under 44pt | The nav button, menu button, footer links and workflow tabs are 44px on phones |
| Three typefaces, and figures switch between them | Marketing figures and prices use the display face with tabular numbers. Mono stays in the product mock-ups |
| Body size fixed in pixels | `body` is `1rem`, and the hero badge icon and anchor offset scale with the text |
| Role tabs wrap unevenly on a phone | A three-column grid below `sm` |

**Found while checking:** at 200% text the "Recommended for agencies" badge and the "Care Assistant" tab label ran off a phone screen. The badge now wraps, and the tab labels break inside their columns. The nav's "Get a demo" was marked hidden on phones, but the button's own `inline-flex` beat `hidden`, so it has always shown there. That is now the stated behaviour.

## Summary

**Rating: Good.** The page is calm, restrained and clearly about the product. It uses real product previews instead of stock images, has one primary action ("Get a demo"), and headings are consistently in sentence case. axe found **no WCAG violations** at either width, nothing scrolls sideways at the default text size, and every looping animation stops when reduced motion is on.

Against the guidelines, the gaps are:

1. The page **breaks at large text sizes**. The menu button moves off screen, and an open FAQ answer gets cut off.
2. A lot of the text is at the **11px minimum**.
3. There is **no dark mode**.
4. The page is **long on a phone**: 14,554px, about 17 screens.

## Critical issues

### 1. At 200% text, the phone nav loses its menu button
- **What:** With the root font size doubled (how browser text-size settings scale `rem`), the 390px page becomes 534px wide. The "Open menu" button sits at x=454–534, entirely off screen, and "Get a demo" is cut off. The nav is fixed at `h-[56px]` (`MarketingNav.jsx:87`), but the logo and buttons inside it grow with the text.
- **Guideline:** *Accessibility > Vision*: "Ideally, give people the option to enlarge text by at least 200 percent." *Typography > Supporting scalable text*: "Make sure your app's layout adapts to all font sizes."
- **Fix:** Below `sm`, let the nav wrap or drop the nav "Get a demo" button when space runs out. The hero already shows that action first. Use `min-h-[56px]` instead of `h-[56px]`, and keep the menu button `shrink-0` so it is always the last thing to leave the screen.

### 2. Open FAQ answers are cut off at large text
- **What:** The accordion animates `max-height` up to a fixed `400px` (`home-interactive.jsx:674`). At 200% text, the first answer, which is open by default, is 677px tall, so 277px is clipped with no way to scroll to it.
- **Guideline:** *Typography*: "Keep text truncation to a minimum as font size increases… Avoid truncating text in scrollable regions unless people can open a separate view to read the rest."
- **Fix:** Animate `grid-template-rows: 0fr → 1fr` on a wrapper instead of `max-height`, or set `max-height: none` once the opening transition ends.

## Improvements

### High: much of the text is at the 11px minimum
- **What:** About 1,600 characters on the page render at 11px. That covers almost every label in the product previews, the hero badge, and all 38 uppercase section labels ("SEE A REAL ANALYSIS", "HOW IT WORKS", and so on). Paragraph text on a phone is mostly 14–15px.
- **Guideline:** *Typography > Ensuring legibility*: mobile default 17pt, minimum 11pt. "Use font sizes that most people can read easily." 11 is the floor, not a body size.
- **Fix:** Move section labels and the hero badge to `text-12` or `text-13`. On a phone, set paragraph text to `text-16`. That is already the scale's "body on marketing pages" step, but the sections use `text-15` and `text-sm`. Keep 11px only for decorative detail inside the product mock-ups, which are pictures of the app, not content to read.

### High: no dark mode
- **What:** With `prefers-color-scheme: dark`, the page stays white (`body` stays `rgb(255,255,255)`, `color-scheme: normal`). Every colour comes from `:root` tokens with no dark variant.
- **Guideline:** *Dark Mode*: "People… generally expect all apps and games to respect their preference." *Color*: "If you define a custom color, make sure to supply light and dark variants."
- **Fix:** The tokens are already semantic (`--ink`, `--ink-soft`, `--mist`, `--bg`, `--border`), so most of the work is one `@media (prefers-color-scheme: dark)` block in `globals.css`. Also add `color-scheme: light dark`. The main remaining work is about 40 inline `white` / `rgba(255,255,255,…)` values on the landing page, which need to become tokens. **Trade-off:** this is the largest fix here, and for a B2B marketing page it matters less than in the app. It is reasonable to do it together with the dashboard.

### Medium: the same green means "button", "label" and "good score"
- **What:** `--forest` fills every button, but it is also the colour of non-interactive text: the trust-strip figures, the "Strong" score, the timeline role labels, and the mint pills ("Shared shortlists", "Notes & tags", and the "Act" tab's "Shortlist", "Send draft email"). Those pills look like buttons you can tap.
- **Guideline:** *Color > Best practices*: "Avoid using the same color to mean different things… if you use your brand color to indicate that a… button is interactive, using the same or similar color to stylize noninteractive text is confusing."
- **Fix:** Show the non-interactive pills as plain text with a check icon, like the feature lists, or as neutral `--mist` / `--ink-soft` tags. Keep mint plus forest for things that can be clicked or selected.

### Medium: the phone page is about 17 screens long, and the trust message is repeated four times
- **What:** On a phone there are 10 sections, 14,554px tall. Data handling is covered by the trust strip ("Swiss-hosted…"), the green trust section, the "Stay compliant" feature card and an FAQ answer. Team features are covered by the dashboard section, the agency section and the "Run the whole desk" card.
- **Guideline:** *Layout*: "Make essential information easy to find by giving it sufficient space… don't obscure it by crowding it with nonessential details." *Writing*: "Check each word to be sure it needs to be there."
- **Fix:** Merge the agency section into the dashboard section, since its timeline repeats the dashboard's bullet points. Remove the "Stay compliant" card, because the trust section covers it. Together that saves about two screens on a phone without losing any claim.

### Medium: the pipeline labels in the dashboard preview run together at 1440px
- **What:** At desktop width, "Screened", "Shortlisted" and "Interview" touch, so they read as "ScreenedShortlistedInterview". A comment at `home-interactive.jsx:270` says this was fixed. The labels did switch to sentence case, but each of the five columns is still about 44px wide inside the `lg:grid-cols-[1.1fr_1fr]` split.
- **Guideline:** *Layout*: "Align components with one another… make them easier to scan." *Typography*: avoid truncation and overlap.
- **Fix:** At `lg`, give the pipeline the full width of the card, with "Needs your attention" below it. Otherwise, use shorter labels ("Screen", "List", "Interview", "Offer", "Placed").

### Medium: some phone tap targets are below 44pt
- **What:** On a phone, the measured targets are: the nav "Get a demo" button at 107×36, the menu button at 40×40, the workflow tabs at 40px tall, and the footer links at 36px tall. The footer links are stacked with no gap.
- **Guideline:** *Accessibility > Mobility*: mobile default 44×44pt, minimum 28×28. "Consider spacing between controls as important as size."
- **Fix:** Below `md`, use `min-h-[44px]` on the footer links and workflow tabs, and `w-11 h-11` on the menu button. The nav CTA can stay at 36px if its tappable area is padded out to 44px.

### Low: three typefaces, and figures switch between them
- **What:** The page uses Outfit (display), Inter (body) and Geist Mono (figures). In the trust strip, "50" is in mono right next to "Under a minute" in Outfit, so the three stats look unrelated. Prices are in mono, but "Demo" in the same position is in Outfit.
- **Guideline:** *Typography*: "Minimize the number of typefaces you use… Mixing too many different typefaces can obscure your information hierarchy." *Branding*: a custom font for headlines works well, with the system or body face for the rest.
- **Fix:** On marketing pages, show figures in Outfit or Inter with `tabular-nums`, and keep Geist Mono for the product mock-ups, where it reads as data.

### Low: the body font size is fixed in pixels
- **What:** `body { font-size: 16px }` (`globals.css:277`). Tailwind's `text-*` utilities use `rem`, so most text scales, but anything that inherits from `body` ignores the browser's text-size setting. The hero badge icon is also fixed at 10px and stays tiny when the text doubles.
- **Guideline:** *Typography > Supporting scalable text*: "Increase the size of meaningful interface icons as font size increases."
- **Fix:** Use `font-size: 1rem`. Size inline icons in `em` (`width="1em"`) where they sit next to text.

### Low: example role tabs wrap unevenly on a phone
- **What:** At 390px, the three role buttons above the example analysis wrap to two rows, with "Care Assistant" alone and centred on the second.
- **Guideline:** *Layout*: "Align components with one another to make them easier to scan."
- **Fix:** Use a three-column grid below `sm`, or a horizontal scroller using the existing `.scroll-fade-x` utility.

## What works well

- **No WCAG violations.** axe passed at both widths. The comments in the code that measure contrast (for example, white on the trust cards) show the care taken.
- **Reduced motion is fully respected.** No looping animation runs when it is on, and the scroll reveals fail safe, so content stays visible if the JavaScript never loads.
- **One clear primary action.** "Get a demo" is the same everywhere, and signed-in visitors get "Go to dashboard" instead. *Writing*: "Be action oriented… use a verb."
- **Sentence case** for every heading and button (*Writing > Build language patterns*).
- **Colour is never the only signal for a score.** "Strong", "Review" and "Weak" always appear next to the coloured number (*Color > Inclusive color*).
- **The content leads, not the brand.** The logo appears only in the nav and footer, and the first thing on screen is the product working (*Branding*: "Ensure branding always defers to content").
- On a phone, **the recommended plan comes first** in pricing, and the chat launcher stays hidden until the visitor scrolls past the hero.

## Platform notes

- **Hamburger menu on a phone.** The guidelines prefer a tab bar for an app's primary navigation. A marketing site with four links is a different case: a menu button is the web convention, and the dashboard already uses a bottom tab bar (`MobileTabBar.jsx`). No change is recommended.
- **Desktop.** The 12px nav links with 28px hit areas meet the desktop default control size (28pt), so they don't need to change.

## Suggested order

1. The nav and FAQ at 200% text (critical, both small changes)
2. Phone tap targets and the `rem` body size (small)
3. Text sizes: section labels, hero badge and phone paragraphs (one pass through `page.js`)
4. The pipeline label overlap
5. Green reserved for interactive elements
6. Merging sections to shorten the page (needs a content decision)
7. Dark mode (largest, best done together with the app)
