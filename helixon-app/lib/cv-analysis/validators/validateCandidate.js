import { CURRENT_YEAR } from "../config.js";


export default function validateCandidate(candidate = {}) {


    const defaults = {


        name: "Candidate",

        email: "",

        phone: "",

        location: "",

        summary: "",


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


        ...(candidate || {})


    };



    // Force arrays

    candidate.skills =
        Array.isArray(candidate.skills)
            ? candidate.skills
            : [];



    candidate.positions =
        Array.isArray(candidate.positions)
            ? candidate.positions
            : [];



    candidate.education =
        Array.isArray(candidate.education)
            ? candidate.education
            : [];



    candidate.certifications =
        Array.isArray(candidate.certifications)
            ? candidate.certifications
            : [];



    candidate.languages =
        Array.isArray(candidate.languages)
            ? candidate.languages
            : [];



    candidate.industries =
        Array.isArray(candidate.industries)
            ? candidate.industries
            : [];



    candidate.experience_breakdown =
        Array.isArray(candidate.experience_breakdown)
            ? candidate.experience_breakdown
            : [];



    candidate.cv_quality_issues =
        Array.isArray(candidate.cv_quality_issues)
            ? candidate.cv_quality_issues
            : [];



    candidate.skill_details =
        Array.isArray(candidate.skill_details)
            ? candidate.skill_details
            : [];



    candidate.skill_details =

        candidate.skill_details.map(skill => ({


            skill: "",


            last_used_year: CURRENT_YEAR,


            years_used: 0,


            depth: "Mentioned",


            ...skill


        }));



    candidate.years_experience =

        Number(candidate.years_experience) || 0;



    return candidate;

}