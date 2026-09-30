import { containsPhrase, normaliseSkill } from "../utils/skillNormaliser.js";

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
const CERT_FILLER = new Set([
  "certified", "certification", "certificate", "certificates", "cert",
  "professional", "the", "of", "in", "and", "for", "a", "an", "level",
]);

function significantWords(text) {
  return normaliseSkill(text).split(" ").filter((w) => w && !CERT_FILLER.has(w));
}

// Everything the CV lists that a credential could be named in.
function heldCredentials(candidate) {
  const certs = Array.isArray(candidate.certifications) ? candidate.certifications : [];
  return [
    ...certs.map((cert) => String(cert?.name || cert || "")),
    ...(Array.isArray(candidate.skills) ? candidate.skills.map(String) : []),
    // What the CV states about right to work, transport, availability.
    ...(Array.isArray(candidate.work_eligibility) ? candidate.work_eligibility.map(String) : []),
  ].filter(Boolean);
}

const stated = (candidate, pattern) =>
  (Array.isArray(candidate.work_eligibility) ? candidate.work_eligibility : []).some((s) => pattern.test(String(s)));

// "pass" when a held credential names the requirement (all its significant
// words), "partial" when about half do, "none" otherwise.
function credentialMatch(value, held) {
  const wanted = significantWords(value);
  if (wanted.length === 0) return "none";

  let best = 0;
  for (const name of held) {
    if (containsPhrase(name, value)) return "pass";
    const have = new Set(significantWords(name));
    best = Math.max(best, wanted.filter((w) => have.has(w)).length / wanted.length);
  }
  if (best === 1) return "pass";
  if (best >= 0.5) return "partial";
  return "none";
}

// Job extraction is asked for a fixed field vocabulary
// (jobExtractionPrompt.js), but older saved jobs and model drift produce
// variants - "Driving License", "professional registration", "degree".
const FIELD_ALIASES = {
  licence: "license",
  registration: "license",
  professional_registration: "license",
  qualification: "certification",
  certificate: "certification",
  driving_license: "driving_licence",
  drivers_license: "driving_licence",
  driving: "driving_licence",
  transport: "own_transport",
  own_vehicle: "own_transport",
  shifts: "availability",
  shift_availability: "availability",
  work_authorisation: "right_to_work",
  work_authorization: "right_to_work",
  degree: "education",
  qualification_level: "education",
  dbs: "background_check",
  dbs_check: "background_check",
};

function normaliseField(field) {
  const f = String(field || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return FIELD_ALIASES[f] || f;
}

const DEGREE_WORDS = /\b(degree|bachelor|bachelors|bsc|ba|beng|llb|master|masters|msc|ma|mba|meng|phd|doctorate)\b/;

function evaluateRule(rule, candidate, context = {}) {
  const value = rule.value.toLowerCase();

  switch (normaliseField(rule.field)) {
    case "min_years_experience": {
      const required = parseFloat(rule.value);
      if (!Number.isFinite(required)) return "unverifiable";
      // A CV without dates (common for hourly and hands-on work) gives no
      // way to count years - that's unknown, not zero. It used to read as 0
      // and fail the requirement, capping the candidate at 40.
      if (!yearsKnown(candidate)) return "unverifiable";
      // The same years the experience points use: relevant to this role
      // when the judgement gave a figure, total career otherwise. Ten years
      // in an unrelated field no longer passes "5 years' experience".
      const actual = Number.isFinite(context.relevantYears) ? context.relevantYears : Number(candidate.years_experience) || 0;
      return actual >= required ? "pass" : "fail";
    }

    case "location": {
      // A remote/anywhere role has no location to fail.
      if (/\b(remote|anywhere|worldwide|distributed)\b/.test(value)) return "pass";
      if (candidate.willing_to_relocate === true) return "pass";
      const location = String(candidate.location || "");
      if (!location) return "unverifiable";
      if (containsPhrase(location, value) || containsPhrase(value, location)) return "pass";
      // No text overlap isn't proof of a mismatch: "UK" vs "London",
      // "Bay Area" vs "San Francisco" or "EMEA" vs "Berlin" share no words
      // but satisfy each other. This used to be a hard fail - capping a
      // qualified candidate at 40 and marking them "Not suitable" - so
      // anything short of a textual match is left for the recruiter.
      return "unverifiable";
    }

    case "certification": {
      // Compared by significant words rather than one exact substring: the
      // same certification is written many ways ("AWS Certified Solutions
      // Architect" vs "AWS Solutions Architect - Associate"), and an
      // exact-string miss used to hard-fail the candidate.
      const held = heldCredentials(candidate);
      const match = credentialMatch(value, held);
      if (match === "pass") return "pass";
      if (match === "partial") return "unverifiable";
      // Only a real "no" when the CV does list its certifications and this
      // isn't among them. A CV listing none at all is common in many
      // fields (care, retail, hospitality, trades) and says nothing either
      // way - it used to hard-fail, capping the candidate at 40.
      // Not shown on the CV is "can't confirm", not "doesn't hold it" -
      // whether or not the candidate lists other certificates. It used to
      // fail only candidates who listed some, so listing more was punished.
      return "unverifiable";
    }

    case "license":
    case "driving_licence":
    case "background_check":
    case "security_clearance": {
      // Licences, registrations and checks (driving licence, NMC PIN, SIA,
      // CSCS, Enhanced DBS, clearance) pass when the CV states them, but
      // are often simply left off a CV - absence is never a fail.
      const held = heldCredentials(candidate);
      if (credentialMatch(value, held) === "pass") return "pass";
      if (
        normaliseField(rule.field) === "driving_licence" &&
        !/\b(hgv|lgv|c\+e|class|cat|pcv|d1|c1)\b/.test(value) &&
        held.some((h) => /driv\w* licen[cs]e/i.test(h))
      ) {
        return "pass";
      }
      return "unverifiable";
    }

    // Stated on many frontline CVs, rarely elsewhere - pass when the CV
    // says so, otherwise the recruiter confirms. Never a fail.
    case "right_to_work":
      return stated(candidate, /right to work|eligible to work|work permit|settled status|british (citizen|passport)|indefinite leave|no (visa )?sponsorship (is )?required/i)
        ? "pass" : "unverifiable";

    case "own_transport":
      return stated(candidate, /own (transport|vehicle|car)|driv\w* licen[cs]e|full (uk )?licen[cs]e/i) ? "pass" : "unverifiable";

    case "availability": {
      // Pass only when the stated availability covers what the role asks
      // ("nights", "weekends", "immediate start").
      const wantWords = significantWords(value).filter((w) => !["available", "availability", "to", "work", "must", "be", "able"].includes(w));
      const statedText = (candidate.work_eligibility || []).join(" ");
      if (wantWords.length && wantWords.every((w) => significantWords(statedText).some((s) => s.startsWith(w.replace(/s$/, ""))))) {
        return "pass";
      }
      return "unverifiable";
    }

    case "education": {
      // Many roles accept equivalent experience, so this never fails - a
      // match passes it, anything else goes to the recruiter.
      const education = Array.isArray(candidate.education) ? candidate.education : [];
      const studied = education.map((e) => `${e?.degree || ""} ${e?.field_of_study || ""}`.trim()).filter(Boolean);
      if (credentialMatch(value, [...studied, ...heldCredentials(candidate)]) === "pass") return "pass";
      // A requirement that's only "a degree" (no subject) is met by any degree.
      const subject = significantWords(value).filter((w) => !DEGREE_WORDS.test(w) && !["or", "equivalent", "relevant", "related", "field", "subject"].includes(w));
      if (DEGREE_WORDS.test(value) && subject.length === 0 && studied.some((d) => DEGREE_WORDS.test(d.toLowerCase()))) {
        return "pass";
      }
      // "Degree in Nursing" is met by "BSc Adult Nursing": the subject
      // words appear, whatever the degree is called.
      if (subject.length && studied.some((d) => {
        const words = significantWords(d);
        return subject.every((w) => words.includes(w));
      })) {
        return "pass";
      }
      return "unverifiable";
    }

    case "relocation": {
      // willing_to_relocate is true/false/null - null means the CV simply
      // never mentioned relocation, which is "unknown", not "no".
      if (candidate.willing_to_relocate === true) return "pass";
      if (candidate.willing_to_relocate === false) return "fail";
      return "unverifiable";
    }

    // right_to_work, work_authorisation, visa_sponsorship and anything
    // else: a CV rarely states these either way, so they're never
    // auto-failed - passed if the CV does state them, otherwise left for
    // the recruiter to check.
    default:
      return credentialMatch(value, heldCredentials(candidate)) === "pass" ? "pass" : "unverifiable";
  }
}

// Whether the CV says anything about how long the candidate has worked:
// a total from extraction, or at least one dated position.
function yearsKnown(candidate) {
  if (Number(candidate.years_experience) > 0) return true;
  return (Array.isArray(candidate.positions) ? candidate.positions : []).some((p) => Number(p?.start_year) > 1950);
}

// context.relevantYears: years relevant to this role from the fit
// judgement, or null when it gave none.
export function applyKnockouts(candidate, job, score, context = {}) {
  const failed = [];
  const unverified = [];

  for (const rule of job.knockout_requirements || []) {
    if (!rule.required) continue;

    const outcome = evaluateRule(rule, candidate, context);
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
