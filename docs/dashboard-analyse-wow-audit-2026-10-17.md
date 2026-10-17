# Helixon dashboard and Analyse: review for "wow", against Apple's design guidelines

**Date:** 17 October 2026 · **Scope:** the signed-in app (`/dashboard/*`) and the screening flow (`/analyse`, single CV and bulk)

> **Status: built, 17 October 2026.**
>
> **All ten opportunities and five quick wins are in.**
>
> **Where the build differs from the proposals:**
> - **Interview questions (quick win 4):** they're pinned to the candidate's notes rather than added to a scorecard. Scorecards belong to a booked interview, which a freshly screened candidate doesn't have yet.
> - **Running view (#1):** it shows a drawing of the CV page being read, not the CV's own text. The CV text is only extracted on the server.
> - **Candidate list (#10):** no re-sort animation. Changing the sort reloads the list, so an animation would never be seen.
>
> **Still open:**
> - **Profile (#7):** activity, notes and emails are still separate rather than one timeline.
> - **Offers (#6):** there's no quieter moment for a client accepting an offer.

## Summary

**Rating: Good, not yet awesome.** The app is accessible, consistent and honest. axe found **no WCAG violations** on any rendered screen, in light or dark, at desktop or phone width. The tokens hold, dark mode works, and the AI is disclosed with a feedback loop that asks *why* a score is wrong.

What it lacks is **moments**. Every page has the same shape: a label, a title, filters, then a list or a grid of equal cards. The product's most dramatic events pass with no ceremony:
- an AI reading a CV in under a minute;
- fifty CVs ranking themselves;
- a placement worth thousands of pounds.

The new homepage now shows these things *more* vividly than the product does, which is the clearest sign of the gap.

The ten opportunities below are ranked by impact for effort. Five quick wins follow, then the build order.

## How this was done

- **Rendered.** The production build ran with the UI gallery and the e2e API fixtures. The rendered screens were:
  - all 11 gallery screens (overview, candidates, candidate, jobs, pipeline, screen, clients, talent pool, interviews, placements, settings) in light at 1440px, dark at 1440px, and light at 390px;
  - the Analyse flow, driven with a mocked `/api/run`: setup, running and the finished report (light and dark at 1440px, and at 390px), and bulk setup, running and done with 8 CVs.
- **Checked.** Every rendered screen was scanned with axe (WCAG 2.2 AA) and checked for sideways scrolling.
- **Read.** `DashboardHome` and its `_components`, `AnalyseWorkspace`, `Report`, `RunningPanel`, `BulkFlow`, the candidate profile and the analytics components.
- **Not rendered.** Analytics, performance, job and client detail, shortlists and the client pack, compare, the settings subpages and the staff portal aren't in the gallery. Analytics was judged from code; the rest wasn't reviewed.

## The ten opportunities

### 1. Make the wait the show (Analyse, running)
- **What:** a screening takes 20–60 seconds. For that whole time the recruiter sees a spinner, a clock and four steps that advance on a 6-second timer. The steps describe the pipeline but show nothing of *this* CV or *this* role. The last step can sit "current" for as long as the server takes.
- **Guidelines:**
  - *Loading:* "If loading takes an unavoidably long time, give people something interesting to view while they wait", and "Show something as soon as possible."
  - *Generative AI:* "Factor processing time into your design."
- **Proposal:** show the work.
  - **Client-only, in days:** show the CV as a page being read, with the scan line from the homepage passing over it. Beside it, list the role's must-haves (the ones the recruiter just entered) waiting to be checked. When the response arrives, tick or cross them in sequence and count the score up before the report opens.
  - **With streaming, in a week or two:** have `/api/run` send server-sent events as each stage completes: name and current title once the CV is parsed, then each requirement's verdict, then the score. The screen fills in live. It's honest, and it's the single most memorable thing the product could do.

### 2. Give the verdict a moment, and the evidence a source (Analyse, report)
- **What:**
  - **The verdict is static.** The score sits as a static "88 /100" with a thin bar.
  - **The evidence is paraphrased.** Each requirement's evidence is a sentence, not a quote, and there is no way to see the CV beside the report.
  - **The marketing sample is richer.** The homepage's example report (`AnalysisExample`) has a score ring, "Expert / Shown in CV / Missing" pills, "From the CV: 'Ran weekly stock counts…'" quotes and a pay guide. The real report has none of these.
- **Guidelines:**
  - *Generative AI:* "Raise awareness about and minimize the chance of hallucinations." A quote the recruiter can check is the strongest defence.
  - *Charting:* "help people learn how to interpret the chart… by animating them individually."
- **Proposal:**
  - **Verdict:** a score ring that fills and counts up once when the report opens, with the recommendation as a coloured verdict line under the name.
  - **Must-haves:** show them as pills (Met · Shown in CV · Missing · To confirm), each with the CV line quoted when the model returns one. Ask the model for a verbatim quote per requirement.
  - **CV view:** a "View CV" toggle that opens the CV text beside the report, with quoted lines highlighted. `RawCvCompare` already loads the text.
  - **Pay:** turn the pay estimate into the same "Pay guide" card the homepage uses.

### 3. Turn bulk results into a live leaderboard (Analyse, bulk)
- **What:**
  - **No live ranking.** Rows score in upload order and only appear ranked when the run ends. The homepage hero now shows the re-sort as it happens; the product doesn't.
  - **No reasons.** Each finished row shows the name, then the file name (usually the same name again), and a score. There is no band word, no reason, and no shortlist line.
  - **Wasted space and a dead button.** The setup panel keeps half the screen during and after the run. A disabled "Screen candidates" button stays at the bottom when everything is done.
- **Guidelines:**
  - *Feedback:* "When status feedback is available near the items it describes, people get important information without having to take action."
  - *Layout:* "Make essential information easy to find by giving it sufficient space."
- **Proposal:**
  - **Live ranking:** re-sort as each score lands, with a layout animation, Motion's `layout` as on the homepage.
  - **Richer rows:** each row gets a band word ("Strong / Review / Weak") and the one-line summary instead of the file name.
  - **Shortlist line:** draw a cut line after the strong matches ("3 strong matches above the line"), with **Shortlist these 3** and **Compare top 3** as the primary actions.
  - **Results first:** collapse the setup panel to a one-line summary ("Warehouse Team Leader · blind screening on · Edit") once the run starts. Replace the dead button with the result actions.

### 4. A first "aha" in 30 seconds (first run)
- **What:**
  - **No sample data.** A new account gets a good checklist (`GettingStarted`), but its first step, "Screen your first CV", needs a real CV and a real role in hand.
  - **No look before effort.** Nothing lets someone see a report before doing that work. Many trials will stall there.
- **Guidelines:**
  - *Onboarding:* "Teach through interactivity… where people can safely test an action."
  - *Onboarding:* "Prefer letting people experience your app… before prompting them for ratings or purchases."
- **Proposal:**
  - **Sample run:** add a "Try it with a sample CV" button on the first-run checklist and on an empty Analyse page. It pre-fills a sample role (e.g. Warehouse Team Leader) and a sample CV, then runs the real pipeline.
  - **Labelled sample candidate:** the result lands in the pipeline as a sample candidate the user can delete. The user sees the whole product, report, pipeline and shortlist, before uploading anything.

### 5. Replace the overview's card wall with a "Today" briefing (dashboard home)
- **What:**
  - **Long page:** the overview is 3,148px on desktop and 5,077px on a phone.
  - **Equal weight:** there are 14 cards of the same visual weight.
  - **Late actions:** two rows of figures (9 tiles) come before anything you can act on.
  - **Labels everywhere:** every card opens with an uppercase label.
  - **Empty cards:** "Follow-ups" and "Team targets" take prime space while they're empty.
  - **No starting point:** the greeting header is pleasant, but it doesn't say what to do first.
- **Guidelines:**
  - *Layout:* "Make essential information easy to find by giving it sufficient space… don't obscure it by crowding it with nonessential details."
  - *Charting:* "Keep a chart simple… Aid comprehension by adding descriptive text."
- **Proposal:**
  - **"Today" strip:** under the greeting, three cards ranked by urgency, each with one button:
    - "Amy Clarke's interview is at 14:00. 2 questions to ask"
    - "Jordan Williams has waited 3 days to go to Northwind. Send now"
    - "3 strong matches unreviewed for Warehouse Operative. Review"
  - **One row of figures:** merge the two figure rows into one row of 5, each with a trend line and a change against last week.
  - **Fewer panels:** move plan usage, recruiter performance and recent analyses to Analytics or below the fold. Hide empty panels until they have content.

### 6. Celebrate what matters (placements, offers, strong matches)
- **What:** nothing in the product marks a placement, the moment a recruiter earns a fee. A stage change to "Placed" looks the same as any other. The only "congratulations" in the codebase is in a candidate offer email.
- **Guideline:** *Feedback:* "When it makes sense, confirm that a significant action or task has completed… reserve this type of confirmation for activities that are sufficiently important."
- **Proposal:** a short, tasteful moment when a candidate becomes Placed, kept professional (no confetti rain):
  - the stage pill fills;
  - a "£4,320 fee · Placed with Northwind" card slides in;
  - "Placed this month" on the overview counts up next time the recruiter visits.

  Do the same, more quietly, for a client accepting an offer. Turn it off with reduced motion.

### 7. Give the candidate profile one place to act
- **What:**
  - **Long page:** the profile is 3,088px on desktop and 5,173px on a phone.
  - **Stacked rail:** the right rail stacks about a dozen cards: workspace, stage, recruiter, tags, next action, notes, call notes (AI), contact, emails, email drafting, interview booking, feedback.
  - **Scattered actions:** six buttons sit at the top (Shortlist · Move to Offer · Add note · Add to client shortlist · Email · More), and more actions are scattered down the rail.
- **Guideline:** *Layout:* "Take advantage of progressive disclosure", and "Group related items… make controls easier to use by… grouping them in logical sections."
- **Proposal:**
  - **Sections:** make the right rail a segmented panel: **Act** (stage, next action, tags) · **Notes** · **Messages** (email, SMS, booking) · **Files**.
  - **Next step:** add a header "next step" suggestion based on stage. "Interview tomorrow: send prep notes" becomes the primary button, instead of six equal ones.
  - **One timeline:** merge activity, notes and emails into one timeline.

### 8. Keep the main action within reach on a phone
- **What:**
  - **Screen a CV:** on a phone, the "Screen candidate" button is about 2,000px down the page, under the role picker's five tiles.
  - **Report:** the stage, shortlist and email actions come after 5,000px of report.
  - **Profile:** the profile's actions are spread down a 5,173px page.
- **Guideline:** *Accessibility > Mobility*, and *Layout:* "Place items to convey their relative importance."
- **Proposal:**
  - **Fixed action bar:** add a bar above the tab bar on these three pages, using `--tabbar-h` as the toast stack does. It holds the primary action: **Screen candidate** (with what's missing, if anything), **Shortlist · Move stage**, or **Next step**.
  - **Role choice:** on a phone, collapse the five role-source tiles into a segmented control.

### 9. Turn ⌘K search into a command bar
- **What:**
  - **Search only:** ⌘K, Ctrl+K or "/" searches candidates, jobs and clients, but it can't *do* anything.
  - **Hidden shortcuts:** the candidate profile has good keyboard shortcuts (J/K to move, S to shortlist, N for a note), but they're local to one page and only listed behind a "Shortcuts" button.
- **Guideline:** *Accessibility:* "Let people use the keyboard alone to navigate and interact with your app."
- **Proposal:**
  - **Actions:** add actions to the palette, such as "Screen a CV for…", "Move Amy Clarke to…", "Draft email to…", "New job", "Go to Pipeline".
  - **Recents:** show recent items when the palette opens empty.
  - **"?" overlay:** list the shortcuts available on every page.

  For recruiters at a desk all day, this is where the product feels fast.

### 10. A motion language for the app
- **What:** the homepage has a motion system (Motion with layout animations); the app has `CountUp` and a few CSS transitions. The app has no motion for:
  - a list re-sorting;
  - a card moving between pipeline columns;
  - a candidate opening from a list;
  - a stage advancing.
- **Guideline:** *Motion:* "Add motion purposefully… Aim for brevity and precision in feedback animations… avoid adding motion to UI interactions that occur frequently."
- **Proposal:** a small, shared vocabulary, used only where state changes meaningfully:
  - layout re-sorts (bulk results, the candidate list when the sort changes, the pipeline);
  - a card gliding to its new column on a stage change;
  - the score ring and verdict reveal (#2);
  - the placement moment (#6).

  Reuse the homepage's `LandingMotion` approach (lazy features, `reducedMotion="user"`). Leave everyday clicks instant.

## Quick wins

1. **Remove truncation in pipeline cards.** At 1440px, pipeline cards cut off the recruiter ("Sam Pa…") and the role ("Senior Software Engi…"). Use an initials avatar for the recruiter and let the role wrap to two lines. *(Typography: "Keep text truncation to a minimum.")*
2. **Use a menu for Export.** "Export…" on Placements is a `<select>` used as an action menu. Make it a menu button like the report's **More**. *(Menus run actions; pickers choose values.)*
3. **Fewer uppercase labels.** The overview has an uppercase, wide-tracked label on every card and every figure (8 in the dashboard components alone). Keep them for section headings and use sentence-case labels inside cards. *(Writing: choose a capitalisation style per element type and use it consistently.)*
4. **Make interview questions usable.** Each question in a report should have a copy button and "Add to the interview scorecard".
5. **Explain "Culture and fit".** A culture score drawn from a CV is where bias most easily creeps in. Rename it to what it measures (for example "Working pattern and context"), and say in the report that protected characteristics aren't used. *(Generative AI: "Take extra care… to consider how assumptions and personal attributes might impact the feature.")*

## What already works

- **Accessibility:** no axe violations on any screen, in either appearance, at either width. Dark mode is complete.
- **Honest AI:** every report carries a clear AI disclosure (UK GDPR Art. 22). Feedback asks *why* a score is wrong (read the CV wrongly, misunderstood the job), which is best practice in the guidelines. Low confidence and floor-capped scores are flagged rather than hidden.
- **Specific errors:** failure messages say what went wrong ("That file is too large…", "You've run a lot of analyses in a short time…"), and there's a "Try again".
- **Good first run:** a new account gets a checklist instead of a wall of zeros, with the workspace step already ticked.
- **Keyboard support:** ⌘K, Ctrl+K and "/" open search, Ctrl+Enter runs an analysis, and the profile has J/K/S/N.
- **Consistency:** tokens, the type scale and the UI kit hold across every screen.

## Suggested order

| Phase | Work | Why first |
|---|---|---|
| 1 | Bulk live leaderboard (#3), report reveal and evidence pills (#2), client-only running experience (#1) | The biggest wow for the effort. All sit on the one flow every customer uses, and they deliver what the homepage now promises |
| 2 | Sample CV first run (#4), phone action bars (#8), the quick wins | Activation, and the phone gaps |
| 3 | "Today" overview (#5), placement moment (#6), profile action panel (#7) | Day-to-day delight for paying users |
| 4 | Streaming `/api/run` (#1, full version), command bar (#9), app motion language (#10) | Bigger engineering, compounding payoff |
