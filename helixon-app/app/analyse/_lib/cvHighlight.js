// Where each evidence quote sits in the CV text, so the CV pane can highlight
// the lines a score rests on. The model quotes the CV but not always
// character for character (line breaks, spacing, case), so a quote matches
// across any run of whitespace, ignoring case. A quote that still isn't found
// is tried again on its first few words; one that never matches is left out
// rather than highlighting the wrong line.

const FALLBACK_WORDS = 6;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function find(text, words) {
  if (!words.length) return null;
  const re = new RegExp(words.map(escapeRegExp).join("\\s+"), "i");
  const m = re.exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

// quotes: [{ skill, quote }]. Returns [{ start, end, skill }], in reading
// order, never overlapping (a later quote inside an earlier one is dropped).
export function quoteRanges(text, quotes) {
  if (!text || !quotes?.length) return [];
  const found = [];
  for (const { skill, quote } of quotes) {
    const words = String(quote || "").trim().split(/\s+/).filter(Boolean);
    const hit = find(text, words) || (words.length > FALLBACK_WORDS ? find(text, words.slice(0, FALLBACK_WORDS)) : null);
    if (hit) found.push({ ...hit, skill });
  }
  found.sort((a, b) => a.start - b.start);
  const ranges = [];
  for (const r of found) {
    if (ranges.length && r.start < ranges[ranges.length - 1].end) continue;
    ranges.push(r);
  }
  return ranges;
}

// The text cut into plain and highlighted pieces: [{ text, skill? }].
export function highlightSegments(text, ranges) {
  const out = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) out.push({ text: text.slice(at, r.start) });
    out.push({ text: text.slice(r.start, r.end), skill: r.skill });
    at = r.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
