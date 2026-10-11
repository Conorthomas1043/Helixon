# Helixon: design, visualisation and UX audit

**Scope:** `helixon-app` at `802793a` (main). The marketing site, sign-in, legal and utility pages, the whole customer app, the "Screen a CV" flow, and the admin console. The staff portal was reviewed in code and from its sign-in page only.

**How it was done:**
- **Rendered in a real browser.** 47 pages were screenshotted in Chromium at desktop (1440px) and phone (390px) width.
  - Public pages were rendered from the production build.
  - Signed-in pages need a login, so they were rendered from a throwaway copy of the app: Clerk was stubbed and the database pointed at a local mock holding a sample agency (24 candidates, 4 jobs, 3 clients, interviews, placements, invoices).
  - The real pages and API routes ran unchanged. Nothing in that harness is in the repo.
- **Automated accessibility scan.** axe-core (WCAG 2.1 AA plus best practice) ran on every desktop page.
- **Code read.** All 256 front-end files were measured: size, inline styles, hard-coded colours, arbitrary Tailwind values, UI-kit use, labels and ARIA. The shared building blocks and the files behind every finding were read.

**Scores** are out of 10. *Visual* and *UX* come from the screenshots. *Code* is a maintainability score from the measurements plus any confirmed bugs (formula at the end). It is not a judgement of the people who wrote it: most of this code is clearly commented and careful.

**Limits:**
- Clerk's sign-in, sign-up and profile widgets couldn't load here, so they aren't rated.
- Public link pages (shared shortlists, booking, portal) only showed their loading state.
- Charts were judged on sample data. A few visual quirks traced to the sample data were checked against the code and left out.

---

## Fix status

Every finding is fixed except the parts listed under **Not done**. The scores and rankings below describe `802793a`, before the fixes. They haven't been re-scored.

**Checks after the fixes:**
- lint: clean;
- typecheck: 73 errors, the existing baseline, none new;
- unit tests: 605 passing;
- end-to-end tests: 14 passing;
- migrations check and production build: both pass.

**Re-checked in the harness:** the same pages were screenshotted again at 1440px and 390px and scanned with axe.
- No page scrolls sideways.
- axe reports no violations on any page re-scanned, admin console included. Before the fixes there were 150 contrast failures, 8 region failures, 4 heading-order failures and the `/analyse` ARIA errors.

**What changed, by finding:**

| # | Fix |
|---|---|
| 1 | Topic names sent (`f22eabe`) |
| 2 | Attention-row pill truncates and the name keeps its width. Hero, job-detail and Candidates toolbars wrap. Overview funnel uses a 3-column grid on phones |
| 3 | Default `border-color: var(--border)` in `globals.css`. The 49 redundant inline colours are removed |
| 4 | Bar counts in ink, outside the fill (white only on the dark Placed bar) |
| 5 | "More" label capped with an ellipsis. Avatars 28px with more spacing. Mobile tab row fades at the edge (`.scroll-fade-x`) |
| 6 | See **Design system** below |
| 7 | Half-pixel sizes (10.5 to 14.5px, 243 uses) rounded to whole pixels. Off-scale rem headings (22.4, 25.6, 27.2, 28.8, 41.6px) snapped to 22, 24, 28 and 40px |
| 8 | Two widths: `wide` (1400px) for lists, boards and dashboards; `narrow` (1000px) for one record, a form or settings (`components/dashboard/page-frame.js`). The dashboard nav matches. Printable client documents stay at 860px |
| 9 | Stages run on the brand ramp: sage, green, teal, gold, forest. Each is at least 3:1 on white. Blue and violet are gone. The shortlist pill shows a coloured dot with ink text. "Open jobs" bars have a legend |
| 10 | Cookie policy, DPA and Product updates use `MarketingNav` and `MarketingFooter`. Fraunces removed. One CTA, "Get a demo" |
| 11 | Terms, Product updates and Cookie policy corrected. About rewritten: an example report replaces the placeholder. Blog removed from the nav, footer and sitemap. Careers roles get a summary and an Apply link that pre-fills the contact form |
| 12 | Admin text tokens: muted `#a3aebb`, faint `#7d8a99`, both at least 4.6:1 on every surface. The footer is now a compact user card with a log-out icon, and "Staff portal" and "Mobile view" moved into the nav, so the full nav fits or fades to show it scrolls. Top bar is a `<header>` landmark. Panel titles are `<h2>`. Empty table headers have screen-reader labels |
| 13 | "Strongest candidates" leaves out anyone already in "Needs your attention", and its "N more" count now counts strong matches only. The chart titles say "furthest stage reached" and "where candidates are now" |
| 14 | Plain "reply tracking isn't switched on" message with a support link |
| 15 | `Chip` renders nothing when empty |
| 16 | Explicit 1-2-5 ticks (`lib/chart-ticks.js`, tested). Fees below £10k show one decimal |

**Low findings:**
- **Fonts:** mono is used only for figures; worded metrics and the "Demo" price use the display face.
- **Pricing on mobile:** the recommended plan comes first.
- **Bulk-screening steps:** the three cards are the same height.
- **Cookie banner:** more compact on phones, with shorter copy.
- **Job picker on `/analyse`:** a plain list of toggle buttons.
- **Checkboxes:** 18px app-wide; Compliance checkboxes have a 24px hit area.
- **Pipeline move buttons:** 32px.
- **Shared-link and booking pages:** an `h1` while loading.
- **Heading order:** fixed on Contact and Careers.
- **Candidate profile:** five everyday actions stay visible; the occasional five sit behind "More" (Delete set apart in red).
- **Placements KPIs:** a money row of 4 and an activity row of 3.
- **Candidate rows:** skill chips sit on one line (2 chips plus "+N").

**Contrast found during re-checking:** offline team cards no longer fade. Account labels and the active filter-count badges use the shared ink colours. Home trust cards raised to 5:1. The UI kit's solid danger button and error toast use `--ui-on-danger` (dark text on the admin console's light red).

**Design system:**
- `test/design-tokens.test.js` now also counts arbitrary font sizes (`text-[13px]`) per file and fails on any half-pixel size. Like the hex and inline-style counts, a file may lose them but not gain them.
- Totals since `802793a`:
  - hex colours: 565 → 492;
  - inline style objects: 3,329 → 3,249;
  - arbitrary font sizes now at 1,653, and can only go down.
- `analytics/page.jsx` is split into `_components/charts.jsx`, `sections.jsx` and `states.jsx` (998 lines → 453 for the page).
- The feedback page uses the shared `PublicCard` instead of its own copy.

**Not done:**
- **Styling consolidation (6, 7).** The remaining arbitrary sizes and inline styles weren't rewritten in bulk. Swapping `text-[14px]` for `text-sm` also changes line height, so that conversion is safer file by file, as files are touched. The ratchet enforces it.
- **The remaining local primitives.** Most are already thin wrappers over the kit. The admin, staff-portal and landing versions are themed on purpose.
- **Overview length (13).** Moving whole sections off the Overview is a product decision, so the layout is unchanged.
- **Home page length.** Unchanged, for the same reason.
- **Legal page bodies.** The legal pages share a header and footer now, but their bodies still use three layouts.
- **Large files.** The other four largest files aren't split.
- **Untyped buttons.** The 165 `<button>`s without a `type` are untouched.

---

## Scorecard

| Dimension | Score | In one line |
|---|---:|---|
| Visual design: marketing site | **8.0** | Calm, confident, on-brand; real product previews do the selling |
| Visual design: product (desktop) | **7.5** | Polished cards and typography, let down by dark dividers and stray colours |
| UX: marketing site | **7.0** | Clear story and CTAs; dead ends (blog, careers, contact routing) |
| UX: product (desktop) | **7.0** | Powerful and well explained; overloaded Overview and crowded action bars |
| Mobile (product) | **5.0** | Usable, but three pages scroll sideways and the Overview's attention list is unreadable |
| Data visualisation | **6.5** | Honest, well-labelled analytics; contrast, tick and colour-encoding faults |
| Accessibility | **6.5** | Strong foundations; 150 contrast failures (mostly admin), a few ARIA errors, small targets |
| Consistency | **5.5** | Five page widths, 31 font sizes, three title treatments, three ways to style |
| Content accuracy | **6.0** | Plans, limits and domain differ between pages |
| Front-end code health | **5.9** | Line-weighted average of 256 files: inline styles and parallel primitives dominate |
| **Overall** | **6.5** | A well-designed product with a short list of high-visibility defects and a styling system worth consolidating |

---

## Findings, most important first

### High

**1. The contact form sent every message to hello@.**
- **Where:** `components/ContactPage.jsx`.
- **Cause:** the Topic dropdown's values were inbox addresses (`support@...`), but `app/api/contact` routes by topic name ("Support", "Sales & pricing").
- **Effect:** the route never matched, so sales and support enquiries landed in hello@. The dropdown also showed raw email addresses as its options.
- **Status:** fixed in `f22eabe` (the form now sends the topic names).

**2. The Overview is broken on phones.** At 390px:
- **"Needs your attention" rows hide the candidate's name.** The reason pill can't shrink (`app/dashboard/_components/attention.jsx:59`), so the name column collapses to zero width and the score spills outside the card.
- **The main button is cut off.** The hero's action row overflows and "+ Screen a CV" disappears off-screen (`app/dashboard/_components/header.jsx`).
- **Three product pages scroll sideways:** the Overview, Candidates and job detail. The job detail header's buttons are 55px too wide.
- **Fix:** let the pill truncate or wrap under the name (`min-width: 0; overflow: hidden; text-overflow: ellipsis`), and let the action rows wrap.

**3. List dividers render near-black across the product.**
- **Where:** 49 lists in 18 files use `className="divide-y" style={{ borderColor: "var(--border)" }}`.
- **Cause:** the colour is set on the list, but `divide-y` draws the border on each child. Tailwind v4 colours that border with `currentColor`, so it comes out in the text colour.
- **Effect:** it's the most visible polish defect, seen on Candidates, job detail, Interviews, Placements, Shortlists, Compliance, Email and Clients.
- **Fix:** one rule in `globals.css` fixes all 49:
  ```css
  @layer base { *, ::before, ::after { border-color: var(--border); } }
  ```

**4. The numbers inside analytics bars are unreadable.**
- **What:** white labels on the sage bars (#a9c4b5) in the funnel, source-of-hire and fall-through charts measure **1.86:1**; 4.5:1 is needed.
- **Fix:** put the counts outside the bar in ink, or darken the bar fill.

### Medium

**5. The dashboard nav collides with itself.**
- **The search box gets covered.** On any page under "More" (Placements, Shortlists, Performance, Email, Business development, Settings), the menu button takes that page's name. At 1440px the label then runs underneath the search box: "Placements & invoi⌕ Search".
- **The avatars clip their own initials.** The team avatar stack overlaps so tightly that "AM SP JR" become unreadable.
- **Fix:** cap the button label width with an ellipsis (or keep it reading "More" and mark it active), and add spacing to the avatar stack (`components/DashboardNav.jsx`).

**6. Three styling systems run side by side.**
- **The numbers:**
  - 3,333 inline `style={{...}}` objects;
  - 3,560 arbitrary Tailwind values (`rounded-[14px]`, `text-[13px]`);
  - 504 hard-coded hex colours.
- **The UI kit is barely used.** `components/ui` is a well-built, themeable kit (it covers the customer app and the dark admin console). But only 63 of 256 files use it, directly or through an area adapter. The marketing and legal pages don't use it at all.
- **Primitives are duplicated:** five local `Card`s, three `Button`s, four `EmptyState`s, two `Pill`s and a separate `Spinner`.
- **Effect:** every visual fix has to be made in many places. This is why issue 3 exists in 18 files and why the type and spacing drift (issues 7 and 8).

**7. There is no type scale.**
- **What:** 31 distinct font sizes render across the pages reviewed, including 10, 10.5, 11, 11.5, 12, 12.5 and 13.5px, and 22.4, 25.6, 27.2 and 28.8px.
- **Fix:** define about 8 steps as tokens (12, 13, 14, 16, 18, 22, 28, 36) and map arbitrary sizes onto them.

**8. Product pages use five different maximum widths.**
- **What:** 936, 1036, 1136, 1336 and 1352px. Moving between Interviews (936), Analytics (1036), Jobs (1136) and Candidates (1336) makes the content jump sideways.
- **Fix:** pick two widths, a reading width and a full-table width.

**9. Stage colours are off-brand and contradict their own comment.**
- **What:** `lib/stage-labels.js` says the stages go "progressively greener through the funnel". They actually run slate → blue → violet → gold → green.
- **Off-palette colours:** blue (#5b8def) and violet (#8b6cf0) appear nowhere else in the brand.
- **Contrast:** the slate "Screened" pill measures 2.35:1 on the page background.
- **Also unlabelled:** the multi-colour progress bars on the Overview's "Open jobs" use these colours with no legend.

**10. The marketing and legal pages don't share a header.**
- **Their own nav:** the Cookie policy, DPA and Product updates pages each build their own header and nav instead of using `MarketingNav`.
- **Three CTAs:** "Get a demo", "Get a demo now" and "Try now".
- **Two title typefaces:** Outfit sans and Fraunces serif.
- **Inconsistent elsewhere:** the legal pages use three different layouts (cards plus contents, a single card, and a numbered list).

**11. Content contradicts itself.** Visitors who read two pages see two different products:

| Page | Says | Elsewhere it's |
|---|---|---|
| Terms | "Free accounts include a limited number of analyses. Paid plans (Solo, Team)" | No free plan; plans are Individual and Agency |
| Product updates | "Bulk CV upload for Team plans", "up to 25 CVs" | Agency plan; 50 CVs |
| Cookie policy | helixon.io | helixon.co.uk |
| About | "Helixon is being developed...", a placeholder illustration | A mature product everywhere else |
| Blog | Six posts, all "Coming soon", linked from the main nav | - |
| Careers | Four roles, each linking to the contact form | No description, no apply |

**12. Admin console text fails contrast throughout.**
- **What:** secondary text #566373 on #0f141b is 3.0:1. It's 16 to 19 failures per admin page, 150 contrast failures in total across 16 pages.
- **Small type:** labels are 10 to 12px.
- **Hidden menu items:** at 900px height the sidebar's last items ("Site controls") sit underneath the signed-in user card.

**13. The Overview tries to show everything.**
- **What:** 12+ cards across 4,000px.
- **Duplicate lists:** "Needs your attention" and "Strongest candidates" list largely the same people.
- **Duplicate stage counts:** they appear on the Overview and twice more on Analytics, in two different encodings.
- **Fix:** keep agenda, attention and KPIs above the fold, and move the rest behind "Analytics".

**14. Customers are shown server configuration.**
- **Where:** `/dashboard/email`.
- **What:** it tells an agency user to "set RESEND_INBOUND_DOMAIN and RESEND_WEBHOOK_SECRET and point Resend's email.received webhook at /api/webhooks/resend-inbound".
- **Fix:** customers can't act on this. Show a plain "Reply tracking isn't switched on yet" and keep the set-up note in the admin health page.

**15. Job cards show empty chips.**
- **What:** `Chip` renders even with no content (`app/dashboard/jobs/JobsList.jsx:81-82`), so every job without a seniority or employment type shows two blank grey pills.

**16. Analytics axes look wrong.**
- **What:** the scale is linear, but Recharts' automatic ticks skip values (0, 1, 2, 4) and the formatter rounds £4,500 to "£5k". The axis then looks uneven and slightly misstates values.
- **Fix:** set explicit `ticks` and format to one decimal place below £10k.

### Low

**Marketing site:**
- The monospace face is used for words, not just numbers ("Under a minute", "Swiss-hosted", "Demo"). Keep it for figures.
- The home page is 9,400px on desktop and 15,000px on mobile.
- On mobile the recommended Agency plan comes last, below the demo card.
- In "Bulk screening", the middle step card sits taller than its neighbours because its title wraps.

**Throughout:**
- The cookie banner sits mid-screen on first visit, covering content on every page, including sign-in.

**Accessibility:**
- On `/analyse`, the job picker uses `role="option"` items inside a plain `<ul>`, which gives 4 critical and serious axe errors.
- Compliance checkboxes are 13px.
- Pipeline card move buttons are about 16px.
- Admin tables have empty header cells.
- The shared-link and booking pages have no `<h1>` while loading.

**Product pages:**
- The candidate profile header offers nine actions of equal weight.
- Placements' seven KPI tiles wrap 5 + 2.
- Candidate rows grow tall because the skill chips stack vertically.

---

## Pages, ranked

*Overall* is the mean of Visual, UX and Code. Code for a page is the line-weighted score of the files that render it.

| Rank | Page | Area | Visual | UX | Code | Overall | Notes |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | **Command** `/admin` | Admin | 8 | 7.5 | 10 | **8.5** | Polished dark console; secondary text 3.0:1 throughout |
| 2 | **Settings** `/dashboard/settings` | Product | 8 | 8 | 9 | **8.3** | Well grouped, a line on each item |
| 3 | **Invoice** `/dashboard/invoices/[id]` | Product | 8 | 8 | 8 | **8** | Clean and printable |
| 4 | **Interviews** `/dashboard/interviews` | Product | 7.5 | 7.5 | 8.5 | **7.8** | Interviews to close out first, then upcoming |
| 5 | **Admin and staff sign-in** `/admin/login, /employee/login` | Admin | 8 | 8 | 7.5 | **7.8** | Simple and clear; admin footer text 3.0:1 |
| 6 | **FAQ** `/faq` | Marketing | 8 | 8 | 7 | **7.7** | Grouped, scannable accordions |
| 7 | **Checkout result** `/checkout/success` | Auth | 8 | 8 | 7 | **7.7** | Clear failure state with a next step |
| 8 | **Too many requests** `/rate-limited` | Utility | 8 | 8 | 7 | **7.7** | Calm, clear, with a retry button |
| 9 | **Clients** `/dashboard/clients` | Product | 8 | 8 | 7 | **7.7** | Clean table with follow-ups inline |
| 10 | **Screen a CV** `/analyse` | Product | 8.5 | 8 | 6 | **7.5** | Clear two-column flow; the job picker list has invalid ARIA |
| 11 | **Demo request** `/demo` | Marketing | 8 | 8 | 6 | **7.3** | Focused form that says what happens next |
| 12 | **Complaints** `/complaints` | Legal | 7.5 | 7.5 | 7 | **7.3** | Numbered steps and clear contact |
| 13 | **Not found** `any unknown URL` | Utility | 8 | 7 | 7 | **7.3** | Friendly copy and two ways out; no site nav |
| 14 | **Client shortlists** `/dashboard/shortlists` | Product | 7.5 | 7.5 | 7 | **7.3** | Explains how it differs from the Shortlisted stage |
| 15 | **Team** `/dashboard/team` | Product | 7.5 | 7.5 | 7 | **7.3** | Clear presence and workload; 12 near-miss contrast failures (4.4:1) |
| 16 | **Performance** `/dashboard/performance` | Product | 7 | 7 | 8 | **7.3** | Leaderboard table; dense |
| 17 | **Privacy policy** `/privacy` | Legal | 8 | 8.5 | 5 | **7.2** | At-a-glance cards, contents list, print button; the best legal page |
| 18 | **Candidate profile** `/dashboard/candidates/[id]` | Product | 7 | 6.5 | 8 | **7.2** | Rich right-hand rail, but nine competing header actions and a very long page; dark dividers |
| 19 | **Compliance** `/dashboard/compliance` | Product | 7 | 7 | 7.5 | **7.2** | Good triage order; dark dividers; 13px checkboxes |
| 20 | **Agencies, Users, Leads, Billing** `/admin/*` | Admin | 7.5 | 7.5 | 6.5 | **7.2** | Consistent tables and KPI tiles; empty table headers; tiny type |
| 21 | **Security, Health** `/admin/security, /admin/health` | Admin | 7.5 | 7.5 | 6.5 | **7.2** | Clear controls; sidebar's last items hidden at 900px height |
| 22 | **How it works** `/how-it-works` | Marketing | 7.5 | 7.5 | 6 | **7** | Clear three steps plus an "under the hood" section |
| 23 | **Under construction** `/under-development` | Utility | 7 | 7 | 7 | **7** | Simple password gate |
| 24 | **Pricing** `/pricing` | Marketing | 8 | 7.5 | 5 | **6.8** | Clear two-plan layout. Differs from the home page's pricing (three cards; "Buy" vs "Choose") |
| 25 | **Pipeline** `/dashboard/pipeline` | Product | 8 | 7.5 | 5 | **6.8** | Clear kanban with counts and averages; the move buttons on cards are tiny |
| 26 | **Client detail** `/dashboard/clients/[id]` | Product | 7.5 | 7.5 | 5.5 | **6.8** | Sensible two-column layout |
| 27 | **Traffic** `/admin/traffic` | Admin | 8 | 7.5 | 4.5 | **6.7** | Rich traffic views and a globe; same contrast issue |
| 28 | **Talent pool** `/dashboard/talent-pool` | Product | 7.5 | 7 | 5 | **6.5** | Match-to-job cards and filters; long rows |
| 29 | **Business development** `/dashboard/business-development` | Product | 7 | 7 | 5.5 | **6.5** | Deal stages and follow-ups |
| 30 | **Overview** `/dashboard` | Product | 7.5 | 6 | 5.5 | **6.3** | Polished cards and a useful agenda, but 12+ cards over 4,000px and the strongest candidates listed twice. On mobile the attention rows are unreadable and the main button is cut off |
| 31 | **Jobs** `/dashboard/jobs` | Product | 7.5 | 7.5 | 4 | **6.3** | Good cards and filters; empty chips on every card |
| 32 | **Placements & invoices** `/dashboard/placements` | Product | 7 | 7 | 5 | **6.3** | Useful figures (seven tiles wrap 5 + 2); dark dividers |
| 33 | **Home** `/` | Marketing | 8.5 | 8 | 2 | **6.2** | Strong hero and real product previews. Monospace face used for words; 9,400px long (15,000px on mobile); recommended plan comes last on mobile |
| 34 | **Sign-in screens** `/login and friends` | Auth | 7.5 | 7 | 4 | **6.2** | Branded split layout (the Clerk form itself wasn't reviewable) |
| 35 | **Terms** `/terms` | Legal | 6.5 | 5 | 7 | **6.2** | Plain wall of text; describes free accounts and old plan names |
| 36 | **Shortlist detail** `/dashboard/shortlists/[id]` | Product | 7 | 7 | 4.5 | **6.2** | Good actions; dark dividers; slate stage pill at 2.35:1 |
| 37 | **Careers** `/careers` | Marketing | 7 | 5.5 | 5 | **5.8** | Every role links to the contact form: no description, no way to apply |
| 38 | **Candidates** `/dashboard/candidates` | Product | 7 | 7 | 3.5 | **5.8** | Powerful search and filters. Tall rows from stacked skill chips; dark dividers; scrolls sideways on mobile |
| 39 | **Job detail** `/dashboard/jobs/[id]` | Product | 7 | 7 | 2.5 | **5.5** | Ranked candidates and an advert editor. Dark dividers; header overflows on mobile |
| 40 | **Analytics** `/dashboard/analytics` | Product | 8 | 7.5 | 1 | **5.5** | Comprehensive, with honest empty states and a table view. Bar labels at 1.9:1, odd axis ticks, stage counts shown twice |
| 41 | **Email templates** `/dashboard/email` | Product | 6.5 | 5.5 | 4.5 | **5.5** | Shows customers server environment-variable instructions |
| 42 | **About** `/about` | Marketing | 5.5 | 5 | 5 | **5.2** | Placeholder-grade copy ("Helixon is being developed...") and illustration |
| 43 | **Blog** `/blog` | Marketing | 6 | 3.5 | 6 | **5.2** | Every post is "Coming soon", yet it's in the main nav |
| 44 | **Cookie policy** `/cookie-policy` | Legal | 7 | 6.5 | 2 | **5.2** | Own header and serif title; names helixon.io |
| 45 | **Contact** `/contact` | Marketing | 7 | 5 | 3 | **5** | Dropdown lists inbox addresses; every message went to hello@ (fixed in this pass) |
| 46 | **DPA** `/dpa` | Legal | 7 | 7 | 1 | **5** | Own header and CTA; serif title |
| 47 | **Product updates** `/updates` | Marketing | 6 | 6 | 2 | **4.7** | Own header, serif title and "Try now" CTA; copy contradicts pricing |

---

## Shared components, rated

| Component | Visual | Code | Notes |
|---|---:|---:|---|
| UI kit `components/ui/index.jsx` | 8.5 | 8.5 | Themeable through `--ui-*` tokens; focus rings, spinner labels, focus-trapped dialog, toasts. The best code in the front end. Its weakness is adoption (63 of 256 files), not quality |
| Marketing footer | 8.5 | 8.0 | Clear four-column structure |
| Cookie banner | 7.0 | 9.0 | Honest, consent-first copy; mid-screen position covers content on first visit |
| Marketing nav | 8.0 | 6.0 | Clean desktop and mobile versions. Bypassed by three pages that build their own |
| Dashboard nav `DashboardNav.jsx` | 6.5 | 1.0 | Clear tabs plus a grouped "More" with a hint for each item. The label collides with search; avatars clip; 512 lines with 37 inline style objects |
| Search and notifications `NavTools.jsx` | 7.5 | 5.0 | ⌘K search with recent items |
| Dashboard area kit `components/dashboard/ui.jsx` | 8.0 | 8.0 | Thin adapter over the kit (`Page`, `PageHeader`, `Card`) |
| Analysis report `analyse/_components/Report.jsx` | 8.5 | 5.0 | Score ring, breakdown bars, evidence quotes; 116 arbitrary values |
| Bulk screening `BulkFlow.jsx` | 8.0 | 6.0 | Clear progress and queue states |
| Compare view `CompareView.jsx` | 7.5 | 4.0 | 121 arbitrary values and 15 hex colours in 629 lines |
| Placement panel `components/dashboard/placements.jsx` | 7.0 | 3.0 | 520 lines, 12 hex colours, dark dividers |
| Compliance panel | 7.0 | 4.0 | Inputs without visible labels |
| Interviews panel | 7.5 | 5.0 | 22 `useState` hooks in one file |
| Home page interactive previews `home-interactive.jsx` | 9.0 | 1.0 | The best visual work on the site, in the least maintainable file: 772 lines, 103 inline style objects |
| Analysis example `AnalysisExample.jsx` | 9.0 | 2.0 | Excellent sample report; 13 hex colours duplicate tokens |

---

## Data visualisation

**What works:**
- Every number has a label, and every empty chart says why it's empty and what fills it ("4 of 10 resolved outcomes needed").
- Analytics offers "Show as a table" for its charts.
- Score bands use one shared three-colour scale (`--score-strong`, `--score-mid`, `--score-low`) with text labels, not colour alone.
- KPI figures use tabular monospaced digits, so columns of numbers line up.
- Fees are labelled as self-reported.

**What to fix:**

| Chart | Issue | Fix |
|---|---|---|
| Analytics funnel, source of hire, fall-through | White counts on sage bars at 1.86:1 | Labels outside the bar in ink |
| Analytics week-by-week | Automatic ticks skip values (0, 1, 2, 4) and round £4,500 to "£5k" | Explicit ticks; finer money format |
| Overview "Where candidates stand" and Analytics "Candidates by stage" | Boxes of equal size with fills that don't read as quantities; blue and violet appear only here; shown in two encodings | One bar encoding, the brand ramp, shown once |
| Analytics funnel next to "Candidates by stage" | Two sets of stage numbers (furthest stage reached vs current stage) side by side | Say which is which in the title, not only in small print |
| Overview "Open jobs" | Multi-colour progress bars with no legend | Add a legend, or use one colour plus text |
| Score distribution | Red and green segments are hard to tell apart for red-green colour-blind users | Already labelled with numbers; add a pattern or reorder labels to match |
| Activity sparkline | No y-axis or value labels on hover | Fine as a sparkline; add a tooltip |

---

## Accessibility

**Foundations in place:**
- a skip link;
- visible `focus-visible` rings in the kit;
- `prefers-reduced-motion` honoured for every animation;
- text colour tokens chosen to pass 4.5:1;
- labelled form fields in the kit;
- a focus-trapped dialog;
- a Switch with role and state;
- `aria-expanded` on toggles;
- no images without `alt`.

**axe results** (WCAG 2.1 AA plus best practice, desktop, 47 pages):

| Rule | Impact | Failures | Pages | Where |
|---|---|---:|---:|---|
| colour-contrast | serious | 150 | 16 | Mostly the admin console (3.0:1 secondary text). Also analytics bar labels (1.86:1), shortlist pill (2.35:1), account (3.9:1), candidates count badge (3.7:1), team (4.4:1), home trust cards (4.46:1), UI kit's dark-theme danger button (2.87:1) |
| region | moderate | 8 | 8 | Admin pages: content outside landmarks |
| heading-order | moderate | 4 | 4 | Contact, Careers, Admin |
| aria-required-parent and children, listitem | critical and serious | 9 | 1 | `/analyse` job picker |
| empty-table-header | minor | 3 | 2 | Admin Users and Billing |
| page-has-heading-one | moderate | 2 | 2 | Shared-link and booking pages while loading |
| landmark-unique | moderate | 1 | 1 | DPA's second header |

**Not caught by axe:**
- 13px checkboxes on Compliance;
- 16px card arrows on Pipeline;
- the Overview's unreadable mobile rows;
- dividers coloured like text, which add visual noise for low-vision users.

Automated scans find about a third of real issues. Keyboard and screen-reader passes were not part of this audit.

---

## Mobile

| Page | Result |
|---|---|
| Marketing site, sign-in, legal | Good: no sideways scroll; layouts stack cleanly |
| Overview | Scrolls sideways (hero buttons); attention rows hide names; funnel overflows its card |
| Candidates | Scrolls sideways; "Showing 1-8 of 24" wraps over three lines; sort menu clipped |
| Job detail | Scrolls sideways (header actions, 55px) |
| Candidate profile, Pipeline, Screen a CV, Analytics | Fine. Pipeline scrolls inside its own lane area, as it should |
| Dashboard nav | Tabs scroll horizontally, but labels are cut mid-word ("Pipelir") with no fade to show there's more |

---

## Design system and code health

**What's good:**
- **One set of tokens.** Colours, radii, shadows and fonts live in `globals.css`, mapped into Tailwind with comments explaining why.
- **One motion vocabulary,** with reduced-motion fallbacks.
- **A real UI kit** with a dark theme.
- **Comments that say why,** throughout.

**What drags it down:**
- **No single way of styling.** The same card is written as Tailwind classes in one file, an inline `style` object in another and a local `CARD` constant in a third.
- **Hard-coded values bypass the tokens.** 504 hex colours (many are token values typed out again) and 3,560 arbitrary values mean the tokens are often skipped.
- **Very large files:**
  - `analytics/page.jsx`, 998 lines with 22 components;
  - `jobs/[id]/page.jsx`, 839 lines;
  - `home-interactive.jsx`, 772 lines;
  - `talent-pool/page.jsx`, 763 lines;
  - `CandidateList.jsx`, 748 lines.
- **State sprawl.** `AnalyseWorkspace.jsx` holds 29 `useState` hooks; `candidate-extras.jsx` holds 27.
- **Buttons without a type.** 165 `<button>`s lack `type=` (harmless outside forms, risky inside them).

**Code health by area** (line-weighted):

| Area | Score | Files | Lines |
|---|---:|---:|---:|
| Shell and utility pages | 8.0 | 12 | 946 |
| Admin console | 6.9 | 40 | 10,467 |
| Screen a CV (analyse) | 6.6 | 21 | 5,944 |
| Dashboard components | 6.0 | 34 | 6,559 |
| Public link pages | 5.9 | 14 | 1,714 |
| Auth, billing and account | 5.9 | 13 | 1,791 |
| Dashboard pages | 5.7 | 66 | 16,752 |
| Staff portal | 5.1 | 27 | 6,640 |
| Marketing site | 4.6 | 22 | 5,048 |
| Legal pages | 3.8 | 6 | 1,476 |

The admin console scores best among the big areas because it styles everything through one shared stylesheet and kit (`app/admin/_shared`). That's the pattern to copy.

**A consolidation path, in order of payoff:**
1. Add the default border-colour rule (fixes issue 3 everywhere).
2. Add type-scale and spacing tokens, and a lint rule against new `text-[Npx]` and hex literals.
3. Move the dashboard pages onto the kit's `Card`, `Button`, `Pill`, `EmptyState` and `Field`, deleting the local copies.
4. Give the marketing and legal pages a shared `LegalPage` layout using `MarketingNav`.
5. Split the five largest files by section.

---

## What works well

**Brand and copy:**
- **A distinct, restrained identity.** Forest green, mint and ink, one accent saved for scores, and confident Outfit headlines. It reads as a serious B2B tool, not a template.
- **The product sells itself.** The home page's live-looking previews (ranked list, report, dashboard) show exactly what a recruiter gets.
- **The copy is plain and honest.** Empty states explain what will fill them; fees are labelled self-reported; the score is "a decision-support tool".

**Product:**
- **The core flows are clear.** "Screen a CV", the pipeline board, the analysis report and the settings index are the strongest screens.
- **Errors are thought through.** Rate-limit, 404, checkout failure and maintenance pages are friendly and always offer a way forward.
- **The admin console** is a polished, consistent operations tool.

---

## How the code score works

Each file starts at 10 and loses points for the following.

**Size:**
- over 300 lines: 1;
- over 500 lines: 2;
- over 700 lines: 3.

**Inline style objects per 100 lines:**
- over 2: 1;
- over 5: 2;
- over 10: 3.

**Arbitrary Tailwind values per 100 lines:**
- over 8: 1;
- over 15: 2.

**Hard-coded hex colours:**
- over 3: 1;
- over 10: 2.

**Other deductions:**
- No UI kit, in a file over 120 lines that renders UI: 1.
- More than 12 `useState` hooks: 1; more than 20: 2.
- A click handler on a non-button element: 1.
- Inputs with no label or ARIA: 1.
- More than 3 untyped buttons: 0.5.
- The dark-divider pattern: 0.5.
- Each confirmed bug: 1.

Scores are clamped to 1 to 10, then line-weighted for areas and pages. Files under 15 lines are left out. The UI kit is hand-rated (see the appendix).

---

## Appendix: every front-end file, weakest first

| Score | File | Lines | Why it scored lower |
|---:|---|---:|---|
| 1 | `app/dashboard/analytics/page.jsx` | 998 | Y-axis ticks skip values and round (£4.5k shows as "£5k"); 998 lines; 95 inline style objects; 4 hard-coded colours; dark row dividers (Tailwind v4 default) |
| 1 | `components/landing/home-interactive.jsx` | 772 | 772 lines; 103 inline style objects; 12 hard-coded colours; no UI kit |
| 1 | `components/DashboardNav.jsx` | 512 | Team avatar stack clips its own initials; Active label under "More" overlaps the search box at 1440px; 512 lines; 37 inline style objects; 6 hard-coded colours; no UI kit |
| 1 | `app/dpa/page.js` | 418 | Own header and nav with a different CTA ("Get a demo now"); 49 inline style objects; 24 hard-coded colours; no UI kit |
| 1.5 | `app/employee/calendar/page.js` | 544 | 544 lines; 50 inline style objects; 11 hard-coded colours; no UI kit |
| 1.5 | `app/employee/cold-calls/page.js` | 519 | 519 lines; 47 inline style objects; 30 hard-coded colours; no UI kit |
| 2 | `app/admin/mobile/AdminMobileApp.jsx` | 704 | 704 lines; 51 inline style objects; 11 hard-coded colours; no UI kit |
| 2 | `components/landing/AnalysisExample.jsx` | 350 | 37 inline style objects; 13 hard-coded colours; no UI kit |
| 2 | `app/cookie-policy/page.jsx` | 274 | Own header; names helixon.io instead of helixon.co.uk; 42 inline style objects; 21 hard-coded colours; no UI kit |
| 2 | `app/updates/page.js` | 265 | Own header and nav; copy says "Team plans" and "25 CVs" (pricing says Agency and 50); 32 inline style objects; 13 hard-coded colours; no UI kit |
| 2.5 | `app/dashboard/jobs/[id]/page.jsx` | 839 | Mobile: header actions overflow the page by 55px; 839 lines; 60 inline style objects; dark row dividers (Tailwind v4 default) |
| 2.5 | `app/employee/files/page.js` | 327 | 25 inline style objects; 8 hard-coded colours; no UI kit; inputs without labels |
| 3 | `app/page.js` | 571 | 571 lines; 63 inline style objects; no UI kit |
| 3 | `components/dashboard/placements.jsx` | 520 | 520 lines; 27 inline style objects; 12 hard-coded colours |
| 3 | `components/ContactPage.jsx` | 225 | Dropdown shows email addresses as topic names; Topic sent the inbox address, so every message went to hello@ (fixed in this pass); 24 inline style objects; 4 hard-coded colours; no UI kit |
| 3.5 | `app/dashboard/candidates/CandidateList.jsx` | 748 | 748 lines; no UI kit; dark row dividers (Tailwind v4 default) |
| 3.5 | `app/employee/goals/page.js` | 452 | 36 inline style objects; 19 hard-coded colours; no UI kit |
| 4 | `app/analyse/_components/CompareView.jsx` | 629 | 629 lines; 121 arbitrary Tailwind values; 15 hard-coded colours |
| 4 | `app/dashboard/jobs/JobsList.jsx` | 559 | Empty grey chips on every job without seniority or employment type; 559 lines; 34 inline style objects |
| 4 | `app/signup/[[...rest]]/page.jsx` | 501 | 501 lines; 28 inline style objects; 8 hard-coded colours; no UI kit |
| 4 | `components/dashboard/CompliancePanel.jsx` | 495 | 27 inline style objects; 8 hard-coded colours; inputs without labels |
| 4 | `app/employee/cold-calls/CallListPanel.jsx` | 417 | 42 inline style objects; 6 hard-coded colours; no UI kit |
| 4 | `app/dashboard/team/_components/invite.jsx` | 390 | 40 inline style objects; no UI kit |
| 4 | `app/dashboard/_components/header.jsx` | 282 | Mobile: hero action row overflows; "+ Screen a CV" is cut off; 55 inline style objects; 4 hard-coded colours; no UI kit |
| 4 | `components/auth/AuthShell.jsx` | 78 | 13 inline style objects; 13 arbitrary Tailwind values; 5 hard-coded colours |
| 4.5 | `app/admin/traffic/page.js` | 755 | 755 lines |
| 4.5 | `app/admin/security/investigate/page.js` | 736 | 736 lines; click handler on a non-button element |
| 4.5 | `app/dashboard/shortlists/[id]/page.jsx` | 363 | 37 inline style objects; dark row dividers (Tailwind v4 default) |
| 4.5 | `app/dashboard/settings/integrations/page.jsx` | 350 | 28 inline style objects; 9 hard-coded colours; dark row dividers (Tailwind v4 default) |
| 4.5 | `app/dashboard/email/page.jsx` | 312 | Shows customers server set-up instructions (environment variable names); 18 inline style objects; dark row dividers (Tailwind v4 default) |
| 5 | `app/dashboard/talent-pool/page.jsx` | 763 | 763 lines |
| 5 | `app/employee/dashboard/my-tasks-panel.js` | 582 | 582 lines; 35 inline style objects; 8 hard-coded colours |
| 5 | `app/admin/_shared/hooks.js` | 573 | 573 lines; no UI kit; 28 useState hooks |
| 8.5* | `components/ui/index.jsx` | 569 | *Hand-rated: arbitrary values here are `var(--ui-*)` theme references, the intended pattern |
| 5 | `app/dashboard/privacy/page.jsx` | 567 | 567 lines; 119 arbitrary Tailwind values; 9 hard-coded colours |
| 5 | `app/analyse/_components/Report.jsx` | 500 | 116 arbitrary Tailwind values; 5 hard-coded colours |
| 5 | `components/dashboard/candidate-extras.jsx` | 497 | 25 inline style objects; 27 useState hooks |
| 5 | `components/dashboard/interviews.jsx` | 488 | 4 hard-coded colours; 22 useState hooks |
| 5 | `app/privacy/page.js` | 487 | 45 inline style objects; no UI kit |
| 5 | `app/dashboard/pipeline/page.jsx` | 459 | 37 inline style objects; 5 hard-coded colours |
| 5 | `app/about/page.js` | 426 | Placeholder-grade copy ("Helixon is being developed...") and illustration; 31 inline style objects; no UI kit |
| 5 | `components/dashboard/NavTools.jsx` | 397 | 25 inline style objects; no UI kit |
| 5 | `app/dashboard/_components/pipeline.jsx` | 371 | 56 inline style objects; click handler on a non-button element |
| 5 | `app/dashboard/_components/attention.jsx` | 322 | Mobile: reason pill cannot shrink, candidate name collapses to zero width and the score spills out of the card; 49 inline style objects |
| 5 | `app/employee/mobile/_components/calls.jsx` | 259 | 21 inline style objects; 4 hard-coded colours; no UI kit |
| 5 | `app/pricing/page.js` | 230 | 28 inline style objects; 8 hard-coded colours; no UI kit |
| 5 | `app/dashboard/candidates/[id]/_components/talent-pool.jsx` | 205 | 25 inline style objects; no UI kit |
| 5 | `app/share/[token]/page.jsx` | 201 | 24 inline style objects; no UI kit |
| 5 | `app/sign/[token]/page.jsx` | 172 | 22 inline style objects; no UI kit |
| 5 | `app/login/[[...rest]]/page.jsx` | 167 | 11 inline style objects; 6 hard-coded colours; no UI kit |
| 5 | `app/reference/[token]/page.jsx` | 166 | 17 inline style objects; no UI kit |
| 5 | `app/dashboard/team/_components/members.jsx` | 162 | 20 inline style objects; no UI kit |
| 5 | `app/portal/[token]/page.jsx` | 162 | 17 inline style objects; no UI kit |
| 5 | `components/public/ApplyForm.jsx` | 156 | 18 inline style objects; no UI kit |
| 5 | `app/careers/page.jsx` | 131 | 19 inline style objects; no UI kit |
| 5 | `components/account/DangerZone.jsx` | 106 | 19 arbitrary Tailwind values; 11 hard-coded colours |
| 5 | `components/public/JobsChrome.jsx` | 29 | 4 inline style objects; 5 arbitrary Tailwind values |
| 5.5 | `app/dashboard/clients/[id]/page.jsx` | 595 | 595 lines; dark row dividers (Tailwind v4 default) |
| 5.5 | `app/admin/users/page.js` | 560 | 560 lines; click handler on a non-button element |
| 5.5 | `app/dashboard/business-development/page.jsx` | 258 | 26 inline style objects; dark row dividers (Tailwind v4 default) |
| 6 | `app/analyse/AnalyseWorkspace.jsx` | 699 | 699 lines; 29 useState hooks |
| 6 | `app/analyse/_components/BulkFlow.jsx` | 677 | 677 lines |
| 6 | `app/demo/page.js` | 470 | 31 inline style objects; no UI kit |
| 6 | `app/analyse/_components/RoleInputs.jsx` | 446 | 138 arbitrary Tailwind values; 5 hard-coded colours |
| 6 | `app/analyse/_components/RawCvCompare.jsx` | 432 | 73 arbitrary Tailwind values; 5 hard-coded colours |
| 6 | `app/employee/dashboard/page.js` | 368 | 4 hard-coded colours |
| 6 | `app/dashboard/candidates/[id]/_components/workspace.jsx` | 353 | 18 inline style objects; no UI kit |
| 6 | `app/analyse/_components/Rail.jsx` | 309 | 70 arbitrary Tailwind values; 4 hard-coded colours |
| 6 | `app/employee/_shared/EmployeeShell.jsx` | 303 | 25 inline style objects; no UI kit |
| 6 | `app/feedback/[token]/page.jsx` | 273 | 16 inline style objects; 8 hard-coded colours; no UI kit |
| 6 | `app/blog/page.jsx` | 265 | Every post is "Coming soon"; a dead end in the main nav; 16 inline style objects; no UI kit |
| 6 | `app/employee/settings/page.js` | 258 | 30 inline style objects; no UI kit |
| 6 | `app/account/[[...account]]/AccountClient.jsx` | 256 | 14 hard-coded colours; no UI kit |
| 6 | `app/dashboard/candidates/[id]/_components/header.jsx` | 256 | 24 inline style objects; no UI kit |
| 6 | `app/employee/mobile/_components/calendar.jsx` | 252 | 17 inline style objects; no UI kit |
| 6 | `components/dashboard/research.jsx` | 215 | 16 inline style objects; no UI kit |
| 6 | `app/dashboard/team/_components/status.jsx` | 212 | 17 inline style objects; no UI kit |
| 6 | `components/marketing/MarketingNav.jsx` | 212 | 13 inline style objects; no UI kit |
| 6 | `app/dashboard/candidates/[id]/_components/overview.jsx` | 198 | 20 inline style objects; no UI kit |
| 6 | `components/dashboard/AddToShortlist.jsx` | 178 | 12 inline style objects; no UI kit |
| 6 | `components/dashboard/ClientProfileDocument.jsx` | 173 | 15 inline style objects; 8 hard-coded colours; no UI kit |
| 6 | `app/dashboard/candidates/[id]/_components/notes.jsx` | 158 | 14 inline style objects; no UI kit |
| 6 | `app/employee/_shared/TeamPresencePanel.jsx` | 147 | 8 inline style objects; 6 hard-coded colours; no UI kit |
| 6 | `app/employee/ops/page.js` | 141 | 18 inline style objects; no UI kit |
| 6 | `components/HowItWorksPage.jsx` | 129 | 14 inline style objects; no UI kit |
| 6 | `app/employee/page.js` | 97 | 13 inline style objects |
| 6.5 | `app/admin/security/page.js` | 468 | 36 inline style objects |
| 6.5 | `app/admin/agencies/page.js` | 405 | 21 inline style objects |
| 6.5 | `app/dashboard/candidates/[id]/_components/feedback.jsx` | 165 | 13 inline style objects; no UI kit; dark row dividers (Tailwind v4 default) |
| 7 | `app/analyse/_lib/roles.js` | 588 | 588 lines; no UI kit |
| 7 | `app/under-development/page.jsx` | 372 | no UI kit |
| 7 | `app/admin/health/page.js` | 363 | 19 inline style objects |
| 7 | `app/dashboard/team/page.jsx` | 330 | no UI kit |
| 7 | `app/employee/dashboard/team-tasks-panel.js` | 300 | 22 inline style objects; 9 hard-coded colours |
| 7 | `app/dashboard/clients/page.jsx` | 297 | 15 inline style objects; click handler on a non-button element |
| 7 | `components/dashboard/SignaturesCard.jsx` | 271 | 15 inline style objects |
| 7 | `app/dashboard/candidates/[id]/_components/primitives.jsx` | 246 | 23 inline style objects |
| 7 | `app/dashboard/talent-pool/_components/row.jsx` | 240 | 62 arbitrary Tailwind values; 7 hard-coded colours |
| 7 | `app/employee/login/page.js` | 235 | 18 inline style objects; no UI kit |
| 7 | `app/employee/dashboard/day-cards.js` | 234 | 24 inline style objects |
| 7 | `app/employee/mobile/_components/files.jsx` | 234 | 18 inline style objects; no UI kit |
| 7 | `app/billing/page.jsx` | 231 | 25 inline style objects |
| 7 | `app/dashboard/_components/kpis.jsx` | 210 | 30 inline style objects |
| 7 | `app/dashboard/shortlists/page.jsx` | 209 | 20 inline style objects |
| 7 | `app/dashboard/candidates/_components/row.jsx` | 194 | 17 inline style objects |
| 7 | `components/dashboard/AccountSetupGate.jsx` | 193 | 19 inline style objects; no UI kit |
| 7 | `components/landing/TooManyRequestsPage.js` | 191 | 19 inline style objects; no UI kit |
| 7 | `app/dashboard/candidates/[id]/_components/documents.jsx` | 189 | 14 inline style objects; no UI kit |
| 7 | `components/AppNav.jsx` | 178 | 16 inline style objects; no UI kit |
| 7 | `app/dashboard/talent-pool/_components/pickers.jsx` | 170 | 30 arbitrary Tailwind values; 4 hard-coded colours |
| 7 | `app/scorecard/[token]/page.jsx` | 149 | 13 inline style objects; no UI kit |
| 7 | `app/checkout/success/page.jsx` | 148 | 14 inline style objects; no UI kit |
| 7 | `components/dashboard/SavedSearches.jsx` | 148 | 13 inline style objects |
| 7 | `components/dashboard/AdvertisePanel.jsx` | 142 | 8 inline style objects; 4 hard-coded colours |
| 7 | `app/employee/dashboard/onboarding-panel.js` | 132 | 13 inline style objects; no UI kit |
| 7 | `app/employee/mobile/EmployeeMobileApp.jsx` | 130 | 11 inline style objects; no UI kit |
| 7 | `app/book/[token]/page.jsx` | 129 | 10 inline style objects; no UI kit |
| 7 | `app/employee/mobile/_components/stats.jsx` | 127 | 8 inline style objects; no UI kit |
| 7 | `app/dashboard/_components/jobs-team.jsx` | 116 | 27 inline style objects |
| 7 | `components/FaqPage.jsx` | 108 | 12 inline style objects |
| 7 | `app/dashboard/candidates/_components/filters.jsx` | 97 | 7 inline style objects |
| 7 | `app/complaints/page.js` | 96 | 13 inline style objects |
| 7 | `app/terms/page.js` | 85 | Copy describes free accounts and "Solo, Team" plans that no longer exist; 7 inline style objects |
| 7 | `app/jobs/[slug]/[jobId]/page.jsx` | 83 | 6 inline style objects |
| 7 | `app/analyse/_components/RunningPanel.jsx` | 72 | 21 arbitrary Tailwind values |
| 7 | `app/jobs/[slug]/page.jsx` | 68 | 6 inline style objects |
| 7 | `app/dashboard/_components/states.jsx` | 67 | 15 inline style objects |
| 7 | `components/RouteError.jsx` | 55 | 6 inline style objects |
| 7 | `app/not-found.js` | 50 | 6 inline style objects |
| 7 | `components/dashboard/ClientProfileToolbar.jsx` | 47 | 4 inline style objects |
| 7 | `app/dashboard/talent-pool/_components/summary.jsx` | 44 | 11 arbitrary Tailwind values |
| 7 | `components/marketing/CtaBand.jsx` | 40 | 3 inline style objects |
| 7 | `components/marketing/Logo.jsx` | 36 | 3 inline style objects |
| 7 | `app/opengraph-image.js` | 34 | 4 inline style objects |
| 7.5 | `app/admin/pentester/page.js` | 381 | inputs without labels |
| 7.5 | `app/admin/leads/page.js` | 362 | - |
| 7.5 | `app/admin/audit/page.js` | 357 | - |
| 7.5 | `app/dashboard/placements/page.jsx` | 332 | dark row dividers (Tailwind v4 default) |
| 7.5 | `app/admin/site/page.js` | 232 | 6 hard-coded colours |
| 7.5 | `app/dashboard/compliance/page.jsx` | 232 | 17 inline style objects; dark row dividers (Tailwind v4 default) |
| 7.5 | `components/dashboard/ConnectedApps.jsx` | 224 | 16 inline style objects; dark row dividers (Tailwind v4 default) |
| 7.5 | `components/dashboard/EmailThreadPanel.jsx` | 162 | 9 inline style objects; dark row dividers (Tailwind v4 default) |
| 8 | `app/dashboard/candidates/[id]/CandidateProfile.jsx` | 594 | 594 lines |
| 8 | `app/admin/_shared/TrafficTimeline.jsx` | 303 | no UI kit |
| 8 | `app/dashboard/DashboardHome.jsx` | 303 | no UI kit |
| 8 | `app/admin/_shared/ui.js` | 296 | click handler on a non-button element |
| 8 | `app/admin/employees/EmployeeDrawer.jsx` | 291 | 20 inline style objects |
| 8 | `components/dashboard/opportunities.jsx` | 278 | - |
| 8 | `app/dashboard/invoices/[id]/page.jsx` | 257 | 16 inline style objects |
| 8 | `app/dashboard/import/page.jsx` | 254 | 16 inline style objects |
| 8 | `app/dashboard/settings/targets/page.jsx` | 252 | 14 inline style objects |
| 8 | `app/dashboard/settings/pipeline/page.jsx` | 237 | 15 inline style objects |
| 8 | `app/analyse/_components/RoleCard.jsx` | 227 | 44 arbitrary Tailwind values |
| 8 | `app/admin/command/RecentPanels.js` | 217 | 17 inline style objects |
| 8 | `app/employee/mobile/_components/todos.jsx` | 208 | no UI kit |
| 8 | `app/dashboard/candidates/[id]/_components/activity.jsx` | 197 | no UI kit |
| 8 | `app/analyse/_components/CandidateChooser.jsx` | 174 | 41 arbitrary Tailwind values |
| 8 | `app/dashboard/performance/page.jsx` | 173 | 14 inline style objects |
| 8 | `app/analyse/_components/CandidateCard.jsx` | 152 | 29 arbitrary Tailwind values |
| 8 | `app/ui-gallery/Gallery.jsx` | 144 | 11 hard-coded colours |
| 8 | `app/admin/voice/page.js` | 135 | 10 inline style objects |
| 8 | `components/dashboard/ShareShortlist.jsx` | 131 | 7 inline style objects |
| 8 | `app/admin/employees/access.jsx` | 130 | no UI kit |
| 8 | `app/privacy/PrivacyToc.jsx` | 116 | 8 inline style objects |
| 8 | `components/dashboard/interview-week.jsx` | 113 | 7 inline style objects |
| 8 | `app/dashboard/settings/connections/page.jsx` | 112 | 10 inline style objects |
| 8 | `app/employee/mobile/_components/shared.jsx` | 112 | 5 hard-coded colours |
| 8 | `app/employee/_shared/ui.jsx` | 107 | 10 inline style objects |
| 8 | `app/admin/_shared/table.js` | 101 | click handler on a non-button element |
| 8 | `components/account/NotificationsInfo.jsx` | 101 | 6 hard-coded colours |
| 8 | `components/dashboard/SmsPanel.jsx` | 98 | 5 inline style objects |
| 8 | `components/dashboard/ui.jsx` | 95 | 8 inline style objects |
| 8 | `components/marketing/MarketingFooter.jsx` | 88 | 7 inline style objects |
| 8 | `app/employee/_shared/Toaster.jsx` | 81 | 5 hard-coded colours |
| 8 | `components/dashboard/PhoneActions.jsx` | 77 | 7 inline style objects |
| 8 | `components/public/PublicCard.jsx` | 70 | 6 inline style objects |
| 8 | `app/account/layout.jsx` | 64 | 4 inline style objects |
| 8 | `app/dashboard/team/_components/states.jsx` | 41 | 3 inline style objects |
| 8 | `app/jobs/[slug]/privacy/page.jsx` | 40 | 3 inline style objects |
| 8 | `components/PresenceDot.jsx` | 26 | 5 hard-coded colours |
| 8.5 | `app/admin/employees/page.js` | 298 | - |
| 8.5 | `app/admin/_shared/AdminShell.jsx` | 238 | click handler on a non-button element |
| 8.5 | `app/admin/_shared/modal.js` | 176 | no UI kit |
| 8.5 | `app/admin/billing/page.js` | 174 | - |
| 8.5 | `app/dashboard/interviews/page.jsx` | 162 | dark row dividers (Tailwind v4 default) |
| 8.5 | `app/dashboard/settings/offices/page.jsx` | 159 | dark row dividers (Tailwind v4 default) |
| 8.5 | `app/dashboard/settings/audit/page.jsx` | 124 | dark row dividers (Tailwind v4 default) |
| 8.5 | `components/dashboard/InterviewsPanel.jsx` | 72 | dark row dividers (Tailwind v4 default) |
| 8.5 | `components/dashboard/PlacementPanel.jsx` | 72 | dark row dividers (Tailwind v4 default) |
| 9 | `app/admin/_shared/traffic-ui.js` | 338 | - |
| 9 | `components/landing/ChatWidget.jsx` | 263 | no UI kit |
| 9 | `app/admin/_shared/WorldMap.jsx` | 244 | no UI kit |
| 9 | `app/admin/_shared/icons.js` | 200 | no UI kit |
| 9 | `components/dashboard/custom-fields.jsx` | 187 | - |
| 9 | `app/analyse/_lib/analyse.js` | 176 | no UI kit |
| 9 | `app/analyse/_lib/compare.js` | 175 | no UI kit |
| 9 | `components/dashboard/ComposeEmail.jsx` | 171 | - |
| 9 | `app/admin/_shared/datatable.js` | 168 | click handler on a non-button element |
| 9 | `app/dashboard/candidates/[id]/_components/email.jsx` | 160 | - |
| 9 | `app/analyse/_components/compareBits.jsx` | 159 | - |
| 9 | `app/analyse/_lib/cvSections.js` | 134 | no UI kit |
| 9 | `app/admin/_shared/session.js` | 132 | no UI kit |
| 9 | `app/dashboard/settings/careers/page.jsx` | 123 | - |
| 9 | `app/admin/login/page.js` | 120 | - |
| 9 | `app/layout.js` | 115 | 4 hard-coded colours |
| 9 | `components/CookieConsentBanner.jsx` | 112 | - |
| 9 | `app/dashboard/shortlists/[id]/client-pack/page.jsx` | 108 | - |
| 9 | `app/dashboard/candidates/[id]/client-profile/page.jsx` | 87 | - |
| 9 | `app/dashboard/settings/permissions/page.jsx` | 85 | - |
| 9 | `app/admin/_shared/TrafficMapPanel.jsx` | 80 | - |
| 9 | `app/dashboard/settings/page.jsx` | 80 | - |
| 9 | `app/dashboard/candidates/_components/states.jsx` | 61 | - |
| 9 | `components/account/ui.jsx` | 46 | - |
| 10 | `app/admin/command/page.js` | 283 | - |
| 10 | `app/analyse/_lib/useEmailComposer.js` | 161 | - |
| 10 | `app/admin/seo/page.js` | 135 | - |
| 10 | `app/dashboard/settings/invoicing/page.jsx` | 131 | - |
| 10 | `app/admin/employees/sales-marketing-panel.js` | 128 | - |
| 10 | `app/analyse/_lib/bulkRun.js` | 110 | - |
| 10 | `components/dashboard/use-confirm.jsx` | 109 | - |
| 10 | `app/admin/_shared/palette.js` | 106 | - |
| 10 | `app/admin/_shared/data.js` | 84 | - |
| 10 | `components/dashboard/ClientPicker.jsx` | 84 | - |
| 10 | `app/analyse/_lib/zip.js` | 76 | - |
| 10 | `components/SiteAnnouncement.jsx` | 70 | - |
| 10 | `components/dashboard/use-undo-delete.js` | 68 | - |
| 10 | `components/landing/Button.jsx` | 64 | - |
| 10 | `app/dashboard/_components/shared.jsx` | 62 | - |
| 10 | `components/dashboard/CopyButton.jsx` | 59 | - |
| 10 | `components/dashboard/CountUp.jsx` | 56 | - |
| 10 | `app/admin/_shared/nav.js` | 55 | - |
| 10 | `components/account/SettingsNav.jsx` | 52 | - |
| 10 | `app/admin/_shared/toast.js` | 47 | - |
| 10 | `app/employee/_shared/useHeartbeat.js` | 42 | - |
| 10 | `app/admin/layout.js` | 41 | - |
| 10 | `app/dashboard/candidates/[id]/_components/utils.jsx` | 39 | - |
| 10 | `app/admin/mobile/page.js` | 35 | - |
| 10 | `components/useSiteSettings.js` | 34 | - |
| 10 | `app/employee/mobile/page.js` | 32 | - |
| 10 | `app/manifest.js` | 31 | - |
| 10 | `app/faq/page.jsx` | 30 | - |
| 10 | `app/dashboard/candidates/page.jsx` | 29 | - |
| 10 | `app/rate-limited/page.js` | 29 | - |
| 10 | `app/sitemap.js` | 29 | - |
| 10 | `app/robots.js` | 27 | - |
| 10 | `app/account/[[...account]]/page.js` | 26 | - |
| 10 | `app/global-error.jsx` | 26 | - |
| 10 | `app/dashboard/candidates/[id]/page.jsx` | 25 | - |
| 10 | `app/analyse/compare/page.jsx` | 24 | - |
| 10 | `app/analyse/page.js` | 24 | - |
| 10 | `components/dashboard/use-offices.js` | 23 | - |
| 10 | `app/dashboard/page.js` | 21 | - |
| 10 | `app/dashboard/jobs/page.jsx` | 18 | - |
| 10 | `app/admin/_shared/csrf.js` | 16 | - |
| 10 | `app/jobs/[slug]/feed.xml/route.js` | 16 | - |
| 10 | `components/account/PageTransition.jsx` | 15 | - |
