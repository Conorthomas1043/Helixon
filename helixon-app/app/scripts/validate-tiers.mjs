// validate-tiers.mjs
// Run with: node validate-tiers.mjs
// Requires ANTHROPIC_API_KEY set in the environment.
//
// This calls the REAL functions (extractJob, extractCandidate, scoreCandidate)
// through the actual built system — not a mental walkthrough — per Part Six's
// go/no-go gate. Nothing ships until all six tests below print PASS.

import { extractJob, extractCandidate, scoreCandidate } from "./cv-analysis.js";

const tests = [
  {
    id: 1,
    label: "Tier 1 (Entry-level) — honest, no metrics — should score WELL",
    job: `Cleaner, care home, Cardiff. Must be reliable, available for early
morning and weekend shifts, physically able to carry out cleaning duties
across a large site. Full training given. No formal qualifications required.`,
    cv: `3 years' experience as a cleaner in a residential care setting.
Reliable attendance record, no unexplained absences. Comfortable with early
starts and weekend shifts. Holds a current COSHH certificate. Previous role:
cleaner, Sunnyside Care Home, 2022-present. Duties included daily cleaning of
resident rooms and communal areas, laundry, and following infection control
procedures.`,
    expectTier: "entry_level",
    check: (r) => r.match_score >= 65,
    describe: "score >= 65 (Good/Excellent Match band)",
  },
  {
    id: 2,
    label: "Tier 1 (Entry-level) — genuine mismatch — should score POORLY",
    job: `Cleaner, care home, Cardiff. Must be reliable, available for early
morning and weekend shifts, physically able to carry out cleaning duties
across a large site. Full training given. No formal qualifications required.`,
    cv: `Recent graduate seeking office-based administrative work. No cleaning
or care-sector experience. Available weekday daytime only. Career interest
lies in marketing and communications.`,
    expectTier: "entry_level",
    check: (r) => r.match_score < 45,
    describe: "score < 45 (Weak/No Match band)",
  },
  {
    id: 3,
    label: "Tier 2 (Skilled) — strong fit — should score WELL",
    job: `Qualified electrician needed for ongoing commercial maintenance work.
Must hold a valid 18th Edition qualification and NICEIC registration or
equivalent. Minimum 2 years' post-qualification experience.`,
    cv: `Qualified electrician, City & Guilds Level 3, 18th Edition certified.
3 years post-qualification experience in commercial maintenance, currently
NICEIC registered. Comfortable working independently across multiple sites.`,
    expectTier: "skilled",
    check: (r) => r.match_score >= 85,
    describe: "score >= 85 (Excellent Match)",
  },
  {
    id: 4,
    label: "Tier 2 (Skilled) — missing core qualification — should score POORLY",
    job: `Qualified electrician needed for ongoing commercial maintenance work.
Must hold a valid 18th Edition qualification and NICEIC registration or
equivalent. Minimum 2 years' post-qualification experience.`,
    cv: `Enthusiastic handyman with general DIY experience. No formal electrical
qualification. Willing to learn and train on the job.`,
    expectTier: "skilled",
    check: (r) => r.match_score < 45,
    describe: "score < 45 (Weak/No Match band)",
  },
  {
    id: 5,
    label: "Tier 3 (Senior) — strong quantified fit — should score WELL",
    job: `Seeking an experienced Operations Manager to own P&L for a 40-person
distribution site, drive efficiency improvements, and manage senior
stakeholder relationships.`,
    cv: `Operations Manager with 6 years' experience. Reduced site operating
costs by 18% through process redesign. Managed a team of 35 across two
shifts. Held full P&L responsibility for a £4m site budget. Improved
on-time delivery rate from 87% to 96% over 12 months.`,
    expectTier: "senior",
    check: (r) => r.match_score >= 85,
    describe: "score >= 85 (Excellent Match) — confirms Tier 3 unweakened",
  },
  {
    id: 6,
    label: "Tier 3 (Senior) — buzzwords, no evidence — should score POORLY",
    job: `Seeking an experienced Operations Manager to own P&L for a 40-person
distribution site, drive efficiency improvements, and manage senior
stakeholder relationships.`,
    cv: `Dynamic, results-driven leader passionate about operational excellence
and synergistic team management. Proven track record of success and
strategic thinking. Strong communicator and natural leader.`,
    expectTier: "senior",
    check: (r) => r.match_score < 45,
    describe: "score < 45, evidence mostly discounted",
  },
];

async function runTest(t) {
  const jobParsed = await extractJob(t.job);
  const extracted = await extractCandidate(t.cv);
  const result = await scoreCandidate(t.cv, t.job, extracted, jobParsed);

  const tierOk = jobParsed.role_tier === t.expectTier;
  const scoreOk = t.check(result);
  const pass = tierOk && scoreOk;

  return { pass, tierOk, scoreOk, jobParsed, result };
}

(async () => {
  console.log("Helixon V7 — Role-Aware Scoring validation\n" + "=".repeat(60));
  let allPass = true;

  for (const t of tests) {
    process.stdout.write(`\nTest ${t.id}: ${t.label}\n`);
    try {
      const { pass, tierOk, scoreOk, jobParsed, result } = await runTest(t);
      console.log(`  Classified tier: ${jobParsed.role_tier} (expected ${t.expectTier}) — ${tierOk ? "OK" : "MISMATCH"}`);
      console.log(`  match_score: ${result.match_score} — need ${t.describe} — ${scoreOk ? "OK" : "FAIL"}`);
      console.log(`  recommendation: ${result.recommendation}`);
      console.log(`  ${pass ? "PASS ✅" : "FAIL ❌"}`);
      if (!pass) allPass = false;
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      allPass = false;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(allPass
    ? "ALL SIX TESTS PASS — go/no-go gate cleared. Safe to ship."
    : "AT LEAST ONE TEST FAILED — do NOT ship. See Part Seven for fixes.");
  process.exit(allPass ? 0 : 1);
})();
