// Finds the sections of a raw CV (the text read from the uploaded file) so
// the "Raw CVs" comparison can jump every CV to the same part at once -
// Experience, Education, Contact info and so on. Display only: nothing here
// feeds scoring.
//
// CVs are written every which way, so a heading is recognised by its words
// ("Work Experience", "EMPLOYMENT HISTORY:", "Key Skills & Strengths") on a
// short line that reads like a heading rather than a sentence.

export const CV_SECTIONS = [
  { key: "contact", label: "Contact info" },
  { key: "profile", label: "Profile" },
  // Few CVs have a literal "Strengths" heading - fall back to where they
  // usually live instead of jumping nowhere.
  { key: "strengths", label: "Strengths", fallback: ["skills", "achievements", "profile"] },
  { key: "skills", label: "Skills" },
  { key: "experience", label: "Experience" },
  { key: "achievements", label: "Achievements" },
  { key: "education", label: "Education" },
  { key: "certifications", label: "Certifications" },
  { key: "languages", label: "Languages" },
  { key: "interests", label: "Interests" },
  { key: "references", label: "References" },
];

// Words that mark each kind of heading.
const HEADING_WORDS = {
  contact: /\bcontact(\s+(details|information|info))?\b|\bpersonal (details|information)\b/,
  profile: /\b(profile|summary|personal statement|statement|objective|about me)\b/,
  strengths: /\b(strengths|highlights|key attributes)\b/,
  skills: /\b(skills|competenc(y|ies)|expertise|technologies|technical|tools|capabilities)\b/,
  experience: /\b(experience|employment|work history|career history|professional background|positions held|career)\b/,
  achievements: /\b(achievements|accomplishments|awards|honou?rs)\b/,
  education: /\b(education|qualifications|academic)\b/,
  certifications: /\b(certifications?|certificates|licen[cs]es|accreditations?|training|courses|professional development|memberships?)\b/,
  languages: /\blanguages?\b/,
  interests: /\b(interests|hobbies|activities)\b/,
  references: /\breferences?\b/,
};

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const PROFILE_LINK = /\b(linkedin\.com|github\.com)\b/i;

// The heading's text with bullets, numbering, decoration and a trailing
// colon stripped, lower-cased.
function headingText(line) {
  return line
    .trim()
    .replace(/^[\s\d.)(•·▪●*#>|=_\-–—]+/, "")
    .replace(/[\s:|=_\-–—•·]+$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Which section a line heads, or null if it isn't a heading.
export function headingKey(line) {
  const raw = (line || "").trim();
  if (!raw || raw.length > 50 || EMAIL.test(raw) || /[.!?;,]$/.test(raw)) return null;
  const text = headingText(raw);
  if (!text || text.split(" ").length > 5) return null;
  // A sentence ("experience with Salesforce and HubSpot") isn't a heading;
  // a heading starts with a capital (or is all caps) or ends with a colon.
  const looksLikeHeading = /^[^a-z]/.test(raw.replace(/^[^A-Za-z]+/, "")) || /:\s*$/.test(raw);
  if (!looksLikeHeading) return null;

  // "Education & Training" is Education: the earliest matching word wins.
  let best = null;
  for (const [key, re] of Object.entries(HEADING_WORDS)) {
    const m = re.exec(text);
    if (m && (best === null || m.index < best.index)) best = { key, index: m.index };
  }
  return best?.key ?? null;
}

function isContactLine(line) {
  return EMAIL.test(line) || PROFILE_LINK.test(line) || (PHONE.test(line) && line.replace(/[^\d]/g, "").length >= 9);
}

// { lines, anchors: { key: lineIndex }, headings: Set<lineIndex>,
//   contactLines: Set<lineIndex> }. Only the first heading of each kind is
// an anchor.
export function parseCvSections(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const anchors = {};
  const headings = new Set();
  const contactLines = new Set();

  lines.forEach((line, i) => {
    const key = headingKey(line);
    if (key) {
      headings.add(i);
      if (anchors[key] === undefined) anchors[key] = i;
    }
    if (isContactLine(line)) contactLines.add(i);
  });

  // Most CVs put contact details at the top with no heading - point at the
  // first line that has any.
  if (anchors.contact === undefined && contactLines.size) {
    anchors.contact = Math.min(...contactLines);
  }

  return { lines, anchors, headings, contactLines };
}

// Where to jump for a section in one CV: { line, key } (key is the section
// actually found - it differs when a fallback was used), or null.
export function resolveSection(parsed, key) {
  if (parsed.anchors[key] !== undefined) return { line: parsed.anchors[key], key };
  const def = CV_SECTIONS.find((s) => s.key === key);
  for (const alt of def?.fallback || []) {
    if (parsed.anchors[alt] !== undefined) return { line: parsed.anchors[alt], key: alt };
  }
  return null;
}

// The lines a section spans: from its heading to just before the next one.
export function sectionRange(parsed, startLine) {
  if (startLine == null) return null;
  let end = parsed.lines.length - 1;
  for (const h of [...parsed.headings].sort((a, b) => a - b)) {
    if (h > startLine) {
      end = h - 1;
      break;
    }
  }
  return { start: startLine, end };
}

export function sectionLabel(key) {
  return CV_SECTIONS.find((s) => s.key === key)?.label || key;
}
