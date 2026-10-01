// Recruiter boolean search -> a Postgres to_tsquery string, matched against
// candidates.search_vector (name, title, employer, location, skills and CV
// text - see migration 20261001050000_search_and_saved_searches.sql).
//
// Supports what sourcers type: AND, OR, NOT (or a leading -), "quoted
// phrases", (brackets), and a trailing * for prefixes (develop* matches
// developer, development). Words next to each other mean AND.
//
//   (java OR kotlin) AND "spring boot" NOT junior
//   -> ( java | kotlin ) & ( spring <-> boot ) & ! junior

// Does the text use boolean syntax? Plain words keep the ordinary
// substring search, which also matches jobs and recruiters.
export function looksBoolean(text) {
  return /(^|\s)(AND|OR|NOT)(\s|$)|["()]|(^|\s)-\S|\*/.test(String(text || ""));
}

function tokenize(text) {
  const tokens = [];
  const re = /\s*(?:(\()|(\))|"([^"]*)"?|(-)(?=\S)|([^\s()"]+))/gy;
  let m;
  const s = String(text || "");
  while (re.lastIndex < s.length && (m = re.exec(s))) {
    if (m[1]) tokens.push({ t: "(" });
    else if (m[2]) tokens.push({ t: ")" });
    else if (m[3] !== undefined) tokens.push({ t: "phrase", v: m[3] });
    else if (m[4]) tokens.push({ t: "NOT" });
    else if (m[5]) {
      const w = m[5];
      if (w === "AND" || w === "OR" || w === "NOT") tokens.push({ t: w });
      else tokens.push({ t: "word", v: w });
    }
    if (m[0] === "") break;
  }
  return tokens;
}

// Only tsquery's own operator characters are removed; Postgres normalises
// the rest the same way it indexed the CV (so "node.js" and "asp.net" stay
// whole, and "developers" matches "developer").
function cleanWord(w) {
  return String(w)
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[&|!():*<>"\\\s]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((part) => /[\p{L}\p{N}]/u.test(part));
}

function termToQuery(word) {
  const prefix = word.endsWith("*");
  const parts = cleanWord(prefix ? word.slice(0, -1) : word);
  if (!parts.length) return null;
  if (parts.length === 1) return prefix ? `${parts[0]}:*` : parts[0];
  return `( ${parts.join(" <-> ")}${prefix ? ":*" : ""} )`;
}

function phraseToQuery(text) {
  const parts = cleanWord(text);
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : `( ${parts.join(" <-> ")} )`;
}

// Recursive descent: expr = and (OR and)* ; and = unary (AND? unary)* ;
// unary = NOT unary | primary ; primary = word | phrase | ( expr )
function parse(tokens) {
  let i = 0;
  const peek = () => tokens[i];

  function primary() {
    const tok = tokens[i++];
    if (!tok) return null;
    if (tok.t === "word") return termToQuery(tok.v);
    if (tok.t === "phrase") return phraseToQuery(tok.v);
    if (tok.t === "(") {
      const inner = expr();
      if (peek()?.t === ")") i++;
      return inner ? `( ${inner} )` : null;
    }
    return null;
  }

  function unary() {
    if (peek()?.t === "NOT") {
      i++;
      const operand = unary();
      return operand ? `! ${operand}` : null;
    }
    return primary();
  }

  function and() {
    let left = unary();
    while (peek() && peek().t !== "OR" && peek().t !== ")") {
      if (peek().t === "AND") i++;
      const right = unary();
      if (right) left = left ? `${left} & ${right}` : right;
    }
    return left;
  }

  function expr() {
    let left = and();
    while (peek()?.t === "OR") {
      i++;
      const right = and();
      if (right) left = left ? `${left} | ${right}` : right;
    }
    return left;
  }

  const out = expr();
  return out;
}

// The tsquery, or null when there's nothing searchable (or only NOTs,
// which Postgres can't answer on their own).
export function booleanToTsquery(text) {
  const q = parse(tokenize(String(text || "").slice(0, 500)));
  if (!q) return null;
  if (/^! /.test(q) && !/[&|]/.test(q)) return null;
  return q;
}
