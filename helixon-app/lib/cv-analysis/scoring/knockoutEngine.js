// Applies a job's hard pass/fail requirements (job.knockout_requirements,
// extracted by jobExtractor.js and restricted to config.js's
// ALLOWED_KNOCKOUT_FIELDS - see validateJob.js) against the candidate.
//
// Previously this did `candidate[rule.field]` directly, but the candidate-
// extraction schema (candidateExtractionPrompt.js) has no field literally
// named right_to_work / work_authorization / security_clearance /
// background_check / certification (singular) / license - so that lookup
// was always undefined -> "" for every one of those, which always failed
// `.includes(rule.value)`, which - because `required` defaults to true -
// capped every candidate's score to <=40 and marked them "Not suitable"
// the moment a job had ANY such requirement, regardless of whether the
// candidate actually met it. Confirmed live-reachable (validateJob.js lets
// these field names straight through) but not yet triggered in production
// as of this fix (no job in the live database had a populated
// knockout_requirements list yet).
//
// The fix has two parts:
//  1. Fields the CV extraction genuinely captures (years of experience,
//     location, willingness to relocate, certifications) are checked
//     against the real field, properly typed - not string-`.includes()`
//     against something that was never a string.
//  2. Fields a CV essentially never states explicitly (right to work,
//     security clearance, background check, visa sponsorship) are marked
//     "unverifiable from the CV" rather than auto-failed. Silently
//     rejecting a candidate over a fact their CV was never going to
//     contain isn't just inaccurate, it's a fairness problem - it rejects
//     good candidates for a reason that has nothing to do with whether
//     they meet the requirement, and the recruiter never even sees that
//     the rejection was manufactured rather than real. Unverified
//     requirements are surfaced back to the recruiter to check manually
//     (e.g. at interview) instead of silently deciding "no".
// Returns "pass", "fail" or "unverifiable" - three states, not two, because
// several of these fields (right_to_work, security_clearance, etc.) have no
// corresponding candidate field at all, and treating "we don't know" the
// same as "fail" is exactly the bug this file used to have.
function evaluateRule(rule, candidate) {
  const value = rule.value.toLowerCase();

  switch (rule.field) {
    case "min_years_experience": {
      const required = parseFloat(rule.value);
      if (!Number.isFinite(required)) return "unverifiable";
      const actual = Number(candidate.years_experience) || 0;
      return actual >= required ? "pass" : "fail";
    }

    case "location": {
      const location = String(candidate.location || "").toLowerCase();
      if (!location) return "unverifiable";
      return location.includes(value) ? "pass" : "fail";
    }

    case "certification":
    case "license": {
      // Unlike right-to-work/clearance (never stated on a CV either way),
      // the extraction prompt explicitly enumerates every certification a
      // CV lists - so an empty list is real negative evidence, not merely
      // "unknown", the same way it would read to a human recruiter.
      const certs = Array.isArray(candidate.certifications) ? candidate.certifications : [];
      const has = certs.some((cert) => String(cert?.name || "").toLowerCase().includes(value));
      return has ? "pass" : "fail";
    }

    case "relocation": {
      // willing_to_relocate is true/false/null - null means the CV simply
      // never mentioned relocation, which is "unknown", not "no".
      if (candidate.willing_to_relocate === true) return "pass";
      if (candidate.willing_to_relocate === false) return "fail";
      return "unverifiable";
    }

    // right_to_work, work_authorization(_authorisation), visa_sponsorship,
    // security_clearance, background_check: nothing in the extraction
    // schema captures these, and a CV essentially never states them
    // explicitly either way, so there is no candidate-side signal to
    // check against at all - always unverifiable, never auto-failed.
    default:
      return "unverifiable";
  }
}

export function applyKnockouts(candidate, job, score) {
  const failed = [];
  const unverified = [];

  for (const rule of job.knockout_requirements || []) {
    if (!rule.required) continue;

    const outcome = evaluateRule(rule, candidate);
    if (outcome === "fail") {
      failed.push(rule);
    } else if (outcome === "unverifiable") {
      unverified.push(rule);
    }
  }

  if (!failed.length) {
    return { score, failed, unverified };
  }

  return { score: Math.min(score, 40), failed, unverified };
}
