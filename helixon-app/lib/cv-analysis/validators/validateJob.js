import {
    PROTECTED_ATTRIBUTE_PATTERNS,
    ALLOWED_KNOCKOUT_FIELDS,
} from "../config.js";

const VALID_ROLE_TIERS = ["entry", "skilled", "senior", "executive"];

// Defense-in-depth: even though the extraction prompt is told not to turn
// protected characteristics into knockout requirements, model output can't
// be trusted as the only safeguard (prompt injection in the job text,
// model drift, a future prompt edit that drops the instruction). Every
// knockout rule is re-checked here, in code, before it can reach scoring.
function isDiscriminatoryKnockout(rule) {
    if (ALLOWED_KNOCKOUT_FIELDS.includes(rule.field.toLowerCase())) {
        return false;
    }

    const haystack = `${rule.field} ${rule.value}`;

    return PROTECTED_ATTRIBUTE_PATTERNS.some((pattern) => pattern.test(haystack));
}

function toStringOrDefault(value, fallback) {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    return fallback;
}

// Skill lists come from model output over a pasted job spec, so they're
// bounded like any other untrusted input: a skill is a short phrase (a
// longer "skill" is a sentence the model passed through, not something a
// CV can be matched against), and a real role names a few dozen at most.
// Exact duplicates are dropped - they'd otherwise count twice in scoring.
const MAX_SKILLS = 60;
const MAX_SKILL_CHARS = 150;

function toStringArray(value) {
    let items = [];

    if (Array.isArray(value)) {
        items = value.map((item) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item === "object") {
                return String(item.name || item.skill || "").trim();
            }
            return String(item ?? "").trim();
        });
    } else if (typeof value === "string" && value.trim()) {
        items = value.split(/,|\n/).map((s) => s.trim());
    }

    const seen = new Set();
    const out = [];
    for (const item of items) {
        const key = item.toLowerCase();
        if (!item || item.length > MAX_SKILL_CHARS || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        if (out.length >= MAX_SKILLS) break;
    }
    return out;
}

function toNonNegativeInt(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function toKnockoutRequirements(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((rule) => {
            if (!rule || typeof rule !== "object") {
                return null;
            }

            const field = typeof rule.field === "string" ? rule.field.trim() : "";
            const val =
                typeof rule.value === "string"
                    ? rule.value.trim()
                    : String(rule.value ?? "").trim();

            if (!field || !val) {
                return null;
            }

            return {
                field,
                value: val,
                // default to true - a knockout rule with no explicit
                // "required" flag is assumed to be a hard requirement
                required: rule.required !== false,
            };
        })
        .filter(Boolean)
        .filter((rule) => !isDiscriminatoryKnockout(rule));
}

const IMPORTANCE_LEVELS = ["Critical", "High", "Medium", "Low"];

export const JOB_FAMILIES = [
    "technology", "sales", "customer_service", "marketing", "finance", "hr",
    "operations", "healthcare", "education", "hospitality", "retail", "trades",
    "logistics", "legal", "creative", "admin", "executive", "other",
];

const PAY_PERIODS = ["year", "hour", "day"];

export const ROLE_TYPES = ["frontline", "professional", "executive"];

// { low, high, currency, period } pay for the role - stated in the job
// text, or Claude's estimate for the role, seniority and location. null
// when missing or implausible, so salaryEngine.js knows not to use it.
function toMarketSalary(value) {
    if (!value || typeof value !== "object") return null;
    const low = Number(value.low);
    const high = Number(value.high);
    const currency = String(value.currency || "").trim().toUpperCase();
    const period = PAY_PERIODS.includes(value.period) ? value.period : "year";
    // Upper bound per period, to reject e.g. an annual figure labelled hourly.
    const ceiling = { hour: 2_000, day: 20_000, year: 5_000_000 }[period];
    if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high < low || high > ceiling) {
        return null;
    }
    // Hourly/day rates keep their pence/cents (£12.21/hour).
    const round = (n) => (period === "year" ? Math.round(n) : Math.round(n * 100) / 100);
    return { low: round(low), high: round(high), currency: /^[A-Z]{3}$/.test(currency) ? currency : "GBP", period };
}

// { "<required skill>": "Critical" | "High" | "Medium" | "Low" }, keyed by
// the skill exactly as it appears in required_skills. Anything malformed
// (unknown level, a skill that isn't in required_skills) is dropped, and a
// required skill without an entry is scored at "Medium" - see
// scoreCandidate.js - so a job parsed before this field existed still
// scores exactly as it did.
function toSkillImportance(value, requiredSkills) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    const byLower = new Map(
        Object.entries(value).map(([skill, level]) => [String(skill).trim().toLowerCase(), level])
    );

    const result = {};
    for (const skill of requiredSkills) {
        const raw = String(byLower.get(skill.toLowerCase()) || "").trim();
        const level = IMPORTANCE_LEVELS.find((l) => l.toLowerCase() === raw.toLowerCase());
        if (level) result[skill] = level;
    }
    return result;
}

export default function validateJob(job = {}) {

    if (!job || typeof job !== "object") {
        job = {};
    }

    const roleTier = toStringOrDefault(job.role_tier, "skilled").toLowerCase();

    const requiredSkills = toStringArray(job.required_skills);

    return {

        title: toStringOrDefault(job.title, "Untitled Role"),

        client: toStringOrDefault(job.client, ""),

        client_email: toStringOrDefault(job.client_email, ""),

        location: toStringOrDefault(job.location, ""),

        employment_type: toStringOrDefault(job.employment_type, ""),

        seniority: toStringOrDefault(job.seniority, ""),

        role_tier: VALID_ROLE_TIERS.includes(roleTier) ? roleTier : "skilled",

        salary_range: toStringOrDefault(job.salary_range, ""),

        industry: toStringOrDefault(job.industry, "Unknown"),

        // Picks the scoring weight profile (config.js SCORE_WEIGHT_PROFILES).
        // "" for a job parsed before this field existed - scored as
        // professional, as it always was.
        role_type: ROLE_TYPES.includes(String(job.role_type || "").toLowerCase())
            ? String(job.role_type).toLowerCase()
            : (roleTier === "executive" ? "executive" : ""),

        // "" for a job parsed before this field existed.
        job_family: JOB_FAMILIES.includes(String(job.job_family || "").toLowerCase())
            ? String(job.job_family).toLowerCase()
            : (job.job_family ? "other" : ""),

        market_salary: toMarketSalary(job.market_salary),

        min_years_experience: toNonNegativeInt(job.min_years_experience, 0),

        required_skills: requiredSkills,

        preferred_skills: toStringArray(job.preferred_skills),

        skill_importance: toSkillImportance(job.skill_importance, requiredSkills),

        knockout_requirements: toKnockoutRequirements(job.knockout_requirements),

    };
}