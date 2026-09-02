const VALID_ROLE_TIERS = ["entry", "skilled", "senior", "executive"];

function toStringOrDefault(value, fallback) {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    return fallback;
}

function toStringArray(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => {
                if (typeof item === "string") return item.trim();
                if (item && typeof item === "object") {
                    return String(item.name || item.skill || "").trim();
                }
                return String(item ?? "").trim();
            })
            .filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
        return value
            .split(/,|\n/)
            .map((s) => s.trim())
            .filter(Boolean);
    }

    return [];
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
        .filter(Boolean);
}

export default function validateJob(job = {}) {

    if (!job || typeof job !== "object") {
        job = {};
    }

    const roleTier = toStringOrDefault(job.role_tier, "skilled").toLowerCase();

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

        min_years_experience: toNonNegativeInt(job.min_years_experience, 0),

        required_skills: toStringArray(job.required_skills),

        preferred_skills: toStringArray(job.preferred_skills),

        importance: Array.isArray(job.importance) ? job.importance : [],

        knockout_requirements: toKnockoutRequirements(job.knockout_requirements),

    };
}