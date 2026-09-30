export const MODEL = "claude-sonnet-5";

export const RUBRIC_VERSION = "3.1.0";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const CURRENT_YEAR = new Date().getFullYear();

export const CACHE_SIZE = 200;

export const MAX_RETRIES = 2;

// Thinking effort per kind of Claude call (see anthropic/askClaude.js).
// Extraction is transcription into a schema; judgement (fitJudgeEngine)
// weighs evidence, so it keeps more thinking. Overridable per environment
// to tune against an evaluation set without a code change.
const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"];
const effortFromEnv = (name, fallback) =>
    EFFORT_LEVELS.includes(process.env[name]) ? process.env[name] : fallback;

export const EXTRACTION_EFFORT = effortFromEnv("CV_EXTRACTION_EFFORT", "low");

export const JUDGMENT_EFFORT = effortFromEnv("CV_JUDGMENT_EFFORT", "medium");

// Per attempt. A long CV's extraction returns a large JSON object (every
// skill with its depth), which can take longer than a minute to generate.
export const DEFAULT_TIMEOUT = 90000;

// Points per component (each profile sums to 100), chosen by the kind of
// role (job.role_type from job extraction).
//
// professional / executive: achievement quality is judged on every
// analysis and takes 10 points, so a candidate with demonstrable results
// outranks one who only lists duties.
//
// frontline (hourly, shift-based, manual and hands-on roles - warehouse,
// driving, cleaning, kitchen, factory, construction, security, care,
// retail floor): CVs for this work rarely state quantified achievements
// and many of these occupations have no promotion ladder, so scoring them
// like office roles penalised good candidates for the shape of their CV
// rather than their ability to do the job. Weight goes to what the job
// actually asks for instead.
export const SCORE_WEIGHT_PROFILES = {

    professional: { required:35, experience:20, preferred:15, industry:10, career:10, achievements:10 },

    executive: { required:30, experience:20, preferred:10, industry:10, career:15, achievements:15 },

    frontline: { required:45, experience:25, preferred:15, industry:10, career:5, achievements:0 }

};

// Default / jobs parsed before role_type existed.
export const SCORE_WEIGHTS = SCORE_WEIGHT_PROFILES.professional;

export function scoreWeightsFor(job = {}) {
    return SCORE_WEIGHT_PROFILES[job.role_type] || SCORE_WEIGHTS;
}

// Weights for this job once components it gives nothing to score are taken
// out: no required skills extracted, or no preferred ones. Their points are
// shared across the remaining components in proportion, so the total still
// runs to 100. Handing everyone the missing component's full points instead
// (the old behaviour) gave every candidate the same 35-50 points on a vague
// job description, which squashed the ranking.
export function effectiveWeights(base, { hasRequired = true, hasPreferred = true } = {}) {
    const dropped = new Set([
        ...(hasRequired ? [] : ["required"]),
        ...(hasPreferred ? [] : ["preferred"]),
    ]);
    if (!dropped.size) return { ...base };
    const kept = Object.entries(base).filter(([key]) => !dropped.has(key));
    const keptTotal = kept.reduce((sum, [, weight]) => sum + weight, 0);
    const total = Object.values(base).reduce((sum, weight) => sum + weight, 0);
    const out = {};
    for (const key of Object.keys(base)) {
        out[key] = dropped.has(key) || !keptTotal ? 0 : (base[key] / keptTotal) * total;
    }
    return out;
}

// Years of relevant experience that earn full experience points when a
// job doesn't state a minimum. Entry-level frontline work shouldn't need
// five years to score fully.
export const FULL_CREDIT_YEARS = { professional: 5, executive: 10, frontline: 2 };

// How much of a matched skill's points the candidate earns, by how deeply
// the CV shows it (candidate.skill_details[].depth). A skill that's only
// listed used to earn exactly the same as one used for years.
export const DEPTH_CREDIT = {

    Expert:1,

    Used:0.9,

    Mentioned:0.55

};

export const IMPORTANCE_MULTIPLIER = {

    Critical:3,

    High:2,

    Medium:1,

    Low:0.5

};

export const KNOCKOUT_CAP = 40;

// Job descriptions are free text supplied by whoever posts the role, and
// the extraction step turns that text into pass/fail "knockout_requirements".
// Those must never be allowed to encode a protected characteristic - if a
// posting mentions age, sex, race, religion, etc., that language must be
// dropped before it can ever affect a candidate's score, not just
// discouraged in the prompt (prompts can be ignored or bypassed by the
// wording of the input). See validators/validateJob.js, which is the single
// place this list is enforced.
//
// This list is intentionally centralised and easy to extend: add a new
// term/regex here and every knockout check (present and future) inherits
// the protection automatically, without touching scoring code.
export const PROTECTED_ATTRIBUTE_PATTERNS = [
    /\bage\b/i,
    /\b(date of birth|dob|birth ?date|born)\b/i,
    /\b(sex|gender)\b/i,
    /\b(race|racial|ethnic|ethnicity)\b/i,
    /\b(national origin|nationality|native (speaker|language))\b/i,
    /\b(religion|religious|creed|faith)\b/i,
    /\b(disability|disabled|able-?bodied)\b/i,
    /\b(pregnan\w*|maternity|paternity)\b/i,
    /\b(marital|married|single|family status|children)\b/i,
    /\b(sexual orientation|gay|lesbian|straight|bisexual)\b/i,
    /\b(gender identity|transgender|cisgender)\b/i,
    /\b(genetic)\b/i,
    /\b(veteran|military status)\b/i,
    /\bcitizenship\b/i, // distinct from legitimate "right to work" checks
    // Physical/health requirements (disability) - a CV screen must not
    // auto-reject on them; the job prompt says to omit them too.
    /\b(physically fit|physical fitness|fitness level|heavy lifting|able to stand|good health|in good health|medical condition|health condition)\b/i,
    /\blift(ing)?\b.*\b\d+ ?(kg|kgs|lbs?)\b/i,
];

// Legitimate, non-discriminatory checks that can look superficially similar
// to the patterns above (e.g. "right to work" mentions a work-authorisation
// status, not citizenship itself) are explicitly allow-listed so they are
// never accidentally dropped.
export const ALLOWED_KNOCKOUT_FIELDS = [
    "right_to_work",
    "work_authorization",
    "work_authorisation",
    "visa_sponsorship",
    "security_clearance",
    "certification",
    "license",
    "background_check",
    "min_years_experience",
    "location",
    "relocation",
];