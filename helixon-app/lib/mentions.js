// @mentions in notes: "@Sam" or "@Sam Lee" notifies that teammate. A first
// name alone only counts when no one else on the team shares it.

const norm = (s) => String(s || "").trim().toLowerCase();

// members: [{ id, name }]. Returns the ids mentioned in `text`.
export function findMentions(text, members = []) {
  const body = ` ${norm(text)}`;
  if (!body.includes("@")) return [];
  const firstNameCount = new Map();
  for (const m of members) {
    const first = norm(m.name).split(/\s+/)[0];
    if (first) firstNameCount.set(first, (firstNameCount.get(first) || 0) + 1);
  }
  const hit = (token) => {
    const i = body.indexOf(`@${token}`);
    if (i < 0) return false;
    const next = body[i + 1 + token.length];
    return next === undefined || !/[a-z0-9]/.test(next);
  };
  const ids = [];
  for (const m of members) {
    const full = norm(m.name);
    if (!full) continue;
    const first = full.split(/\s+/)[0];
    if (hit(full) || (firstNameCount.get(first) === 1 && hit(first))) ids.push(m.id);
  }
  return [...new Set(ids)];
}
