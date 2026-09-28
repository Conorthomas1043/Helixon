export function normaliseSkill(skill=""){

return String(skill ?? "")

.toLowerCase()

.replace(/[._/-]/g," ")

.replace(/[^a-z0-9+# ]/g,"")

.replace(/\s+/g," ")

.trim();

}

function escapeRegExp(text){

return text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

}

// True when `phrase` appears in `text` as whole words, after both are
// normalised. "+" and "#" count as part of a word so "C" doesn't match
// "C++"/"C#", and word boundaries stop "Java" matching "JavaScript" or
// "Go" matching "good". This used to be a raw substring check, which
// meant any short skill ("R", "C", "Go") was "evidenced" by nearly every
// line of every CV.
export function containsPhrase(text,phrase){

const hay=normaliseSkill(text);

const needle=normaliseSkill(phrase);

if(!hay||!needle)return false;

return new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(needle)}($|[^a-z0-9+#])`).test(hay);

}

export function skillMatch(a,b){

return containsPhrase(a,b)||containsPhrase(b,a);

}
