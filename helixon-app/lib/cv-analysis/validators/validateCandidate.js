import { CURRENT_YEAR } from "../config.js";


function toStringOrEmpty(value) {
    return typeof value === "string" ? value.trim() : "";
}

function toBooleanOrNull(value) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        const v = value.trim().toLowerCase();
        if (["yes", "true", "y"].includes(v)) return true;
        if (["no", "false", "n"].includes(v)) return false;
    }
    return null;
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}


export default function validateCandidate(candidate = {}) {

    if (!candidate || typeof candidate !== "object") {
        candidate = {};
    }


    const defaults = {


        name: "Candidate",

        email: "",

        phone: "",

        location: "",

        summary: "",


        // contact / status fields the run route and CandidateResult UI
        // read directly - previously missing from both the prompt and
        // this validator, so they always came through as undefined
        linkedin: "",

        github: "",

        portfolio_url: "",

        current_title: "",

        current_employer: "",

        notice_period: "",

        willing_to_relocate: null,


        skills: [],

        positions: [],

        education: [],

        certifications: [],

        languages: [],

        industries: [],


        experience_breakdown: [],


        skill_details: [],


        years_experience: 0,


        cv_quality_issues: []


    };



    candidate = {


        ...defaults,


        ...candidate

    };


    // Force scalars to the right type
    candidate.name = toStringOrEmpty(candidate.name) || "Candidate";
    candidate.email = toStringOrEmpty(candidate.email);
    candidate.phone = toStringOrEmpty(candidate.phone);
    candidate.location = toStringOrEmpty(candidate.location);
    candidate.summary = toStringOrEmpty(candidate.summary);
    candidate.linkedin = toStringOrEmpty(candidate.linkedin);
    candidate.github = toStringOrEmpty(candidate.github);
    candidate.portfolio_url = toStringOrEmpty(candidate.portfolio_url);
    candidate.current_title = toStringOrEmpty(candidate.current_title);
    candidate.current_employer = toStringOrEmpty(candidate.current_employer);
    candidate.notice_period = toStringOrEmpty(candidate.notice_period);
    candidate.willing_to_relocate = toBooleanOrNull(candidate.willing_to_relocate);



    // Force arrays

    candidate.skills =
        toArray(candidate.skills)
            .map((s) => (typeof s === "string" ? s.trim() : String(s?.name || s?.skill || "").trim()))
            .filter(Boolean);



    candidate.positions =
        toArray(candidate.positions).map((position) => ({

            title: "",

            employer: "",

            start_year: null,

            end_year: null,

            ...(position && typeof position === "object" ? position : {})

        }));



    candidate.education =
        toArray(candidate.education);



    candidate.certifications =
        toArray(candidate.certifications);



    candidate.languages =
        toArray(candidate.languages);



    candidate.industries =
        toArray(candidate.industries);



    candidate.experience_breakdown =
        toArray(candidate.experience_breakdown);



    candidate.cv_quality_issues =
        toArray(candidate.cv_quality_issues)
            .map((issue) => (typeof issue === "string" ? issue.trim() : String(issue ?? "").trim()))
            .filter(Boolean);



    candidate.skill_details =
        toArray(candidate.skill_details).map(skill => ({


            skill: "",


            last_used_year: CURRENT_YEAR,


            years_used: 0,


            depth: "Mentioned",


            ...(skill && typeof skill === "object" ? skill : {})


        }));



    candidate.years_experience =

        Number(candidate.years_experience) || 0;


    // If the extractor didn't give us current_title/current_employer
    // directly, backfill from whichever position looks most recent -
    // route.js and the UI both read these as top-level fields.
    if (!candidate.current_title || !candidate.current_employer) {

        const mostRecent = [...candidate.positions].sort(
            (a, b) => (b.end_year || CURRENT_YEAR) - (a.end_year || CURRENT_YEAR)
        )[0];

        if (mostRecent) {
            candidate.current_title =
                candidate.current_title || toStringOrEmpty(mostRecent.title);

            candidate.current_employer =
                candidate.current_employer || toStringOrEmpty(mostRecent.employer);
        }
    }


    return candidate;
}