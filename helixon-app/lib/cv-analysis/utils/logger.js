// Centralised logging for the CV pipeline. Two things this exists to fix:
//
// 1. Debug noise in production. The pipeline used to sprinkle raw
//    console.log everywhere ("CLAUDE RAW:", full text) which is fine on a
//    laptop but expensive and noisy once it's running on real traffic.
//    debug() is a no-op in production unless explicitly turned back on.
//
// 2. Candidate PII ending up in logs. CV text, extracted names/emails/
//    phone numbers, and full job descriptions were being logged verbatim
//    on every request. Whatever platform aggregates these logs then holds
//    candidate personal data indefinitely, outside of the database's own
//    access controls/retention policy - a real compliance problem
//    (GDPR/UK GDPR "right to erasure" can't reach a log line). summarise()
//    exists so a call site can log "yes, I got a result, here's its
//    shape" without the payload riding along.
const isProd = process.env.NODE_ENV === "production";
const debugEnabled = process.env.CV_PIPELINE_DEBUG === "true";

export function debug(...args) {
    if (isProd && !debugEnabled) return;
    console.log("[cv-analysis]", ...args);
}

export function warn(...args) {
    console.warn("[cv-analysis]", ...args);
}

export function error(...args) {
    console.error("[cv-analysis]", ...args);
}

// Reduces a value to something safe to log: lengths and key names, never
// the underlying content. Use this any time the thing you want to log
// might contain CV text, extracted candidate/job fields, or raw model
// output.
export function summarise(value) {
    if (value == null) return value;

    if (typeof value === "string") {
        return `string(${value.length} chars)`;
    }

    if (Array.isArray(value)) {
        return `array(${value.length})`;
    }

    if (typeof value === "object") {
        return `object{${Object.keys(value).join(",")}}`;
    }

    return value;
}
