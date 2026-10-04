# Helixon product glossary

One name per concept, used the same way in the product, emails, the website and support. Use it when writing any user-facing copy.

**Why it exists.** Before this, the core action had three names (Analyse, Screen, Score), its result three more, and "shortlist" meant two different things. Consistency (heuristic 4) and speaking the users' language rather than the system's (heuristic 2) were among the heuristics that explained the most problems when Nielsen analysed 249 usability problems from real projects (Nielsen, J., 1994, "Enhancing the explanatory power of usability heuristics", *Proc. CHI '94*; Nielsen & Molich, 1990, "Heuristic evaluation of user interfaces", *Proc. CHI '90*).

| Use | Meaning | Don't use |
|---|---|---|
| **Screen** (verb) | Run a CV through Helixon against a job | Analyse, assess, process |
| **Screening** | One CV scored against one job | Analysis, assessment, scan |
| **Screening report** | The page showing a screening's score, evidence and checks | Assessment, analysis report |
| **Match score** | The 0–100 number | Fit score, rating |
| **Strong match** | Score 80+ | Strong, Strong Match |
| **Worth reviewing** | Score 60–79 | Moderate, Review, Worth a look |
| **Weak match** | Score below 60 | Weak, Weak Match |
| **Not suitable** | The recommendation when a must-have isn't met (the score is capped at 40) | Rejected (that's a stage) |
| **Job** | What the agency is filling; a record with candidates and stages | Role (fine in marketing prose), vacancy (fine on public job pages) |
| **Shortlisted** | A pipeline **stage**. Internal; the client can't see it | — |
| **Client shortlist** | A **list** of candidates sent to a client to decide on | Shortlist (on its own) |
| **Talent pool** | People kept for future jobs | Bench, database |
| **Candidates** | Everyone the agency has screened or added | — |
| **Pipeline** | The stage board for a job or the whole agency | Kanban, board |
| **Client** | The company the agency is hiring for | Customer, hiring company |
| **Hiring manager** | The person at the client who decides | Client contact (in copy) |

Code (routes, variables, table names) can keep its older names. `/analyse` stays a URL, for example. Only user-facing words follow this table. The score band words come from `lib/scoreBands.js` (`BAND_LABELS`, `scoreBandLabel`); don't hard-code them.
