// lib/employee-permissions.js
// What each employee can do in the staff portal, section by section.
//
// Every section has an access level: "none" (hidden, API refuses), "view"
// (can read, can't change anything) or "edit" (full use). A role gives a
// starting set (ROLE_PRESETS); an admin can then override any section for
// one person from the admin console, stored in employees.permissions as
// e.g. {"cold_calls": "none", "files": "view"}. NULL/missing keys fall back
// to the role.
//
// Enforcement is server-side, in requireEmployeeAccess() (lib/session.js):
// GET needs "view", anything that changes data needs "edit". The portal
// also hides sections an employee can't open, but that is cosmetic.

export const LEVELS = ["none", "view", "edit"];
const RANK = { none: 0, view: 1, edit: 2 };

export const SECTIONS = [
  { key: "tasks", label: "My tasks", description: "Their own to-do list on the Today page." },
  { key: "team_tasks", label: "Team tasks", description: "The shared task list everyone can see and assign." },
  { key: "calendar", label: "Calendar", description: "The shared team calendar and Google Calendar sync." },
  { key: "goals", label: "Goals", description: "Team goals and their checklists." },
  { key: "cold_calls", label: "Cold calls", description: "The call log, leaderboard and imported call list." },
  { key: "files", label: "Files", description: "The shared file store: browse, download, upload." },
  { key: "platform", label: "Platform stats", description: "Read-only company numbers (customers, traffic, pipeline)." },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);

const ALL_EDIT = Object.fromEntries(SECTION_KEYS.map((k) => [k, "edit"]));
const ALL_VIEW = Object.fromEntries(SECTION_KEYS.map((k) => [k, "view"]));

// "platform" is read-only by nature, so "edit" and "view" behave the same.
export const ROLE_PRESETS = {
  super_admin: { ...ALL_EDIT },
  admin: { ...ALL_EDIT },
  operations: { ...ALL_EDIT },
  employee: { ...ALL_EDIT },
  sales: { ...ALL_EDIT },
  support: { ...ALL_EDIT, cold_calls: "view" },
  viewer: { ...ALL_VIEW, tasks: "edit", platform: "view" },
};

export const ROLES = [
  { key: "employee", label: "Employee", description: "Full use of every section." },
  { key: "sales", label: "Sales", description: "Full use of every section." },
  { key: "support", label: "Support", description: "Everything, but the call log is read-only." },
  { key: "operations", label: "Operations", description: "Full use of every section." },
  { key: "viewer", label: "Viewer", description: "Can look at everything, change only their own tasks." },
  { key: "admin", label: "Admin", description: "Full use of every section." },
  { key: "super_admin", label: "Super admin", description: "Full use of every section." },
];

export function isLevel(value) {
  return LEVELS.includes(value);
}

/** The role's starting permissions (unknown roles get read-only access). */
export function rolePreset(role) {
  return { ...(ROLE_PRESETS[role] || ALL_VIEW) };
}

/**
 * Only the valid section/level pairs from a stored or submitted overrides
 * object; anything else is dropped. Returns null when nothing is left.
 */
export function cleanOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const key of SECTION_KEYS) {
    if (isLevel(raw[key])) out[key] = raw[key];
  }
  return Object.keys(out).length ? out : null;
}

/** Effective permissions: role preset with the employee's overrides on top. */
export function effectivePermissions(employee) {
  const base = rolePreset(employee?.role);
  const overrides = cleanOverrides(employee?.permissions) || {};
  return { ...base, ...overrides };
}

/** True when `employee` has at least `needed` ("view" | "edit") in `section`. */
export function can(employee, section, needed = "view") {
  const level = effectivePermissions(employee)[section] || "none";
  return RANK[level] >= RANK[needed];
}

/**
 * Overrides to store so that the effective permissions equal `desired`:
 * only the sections that differ from the role preset. Keeps the stored
 * value small and lets a later role change still apply to everything the
 * admin didn't deliberately set.
 */
export function overridesFor(role, desired) {
  const base = rolePreset(role);
  const out = {};
  for (const key of SECTION_KEYS) {
    if (isLevel(desired?.[key]) && desired[key] !== base[key]) out[key] = desired[key];
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Overrides to store after a role change: sections the admin customised
 * keep their level, everything else follows the new role. (Pinning the
 * whole old access instead would make a role change do nothing.)
 */
export function overridesAfterRoleChange(storedOverrides, newRole) {
  return overridesFor(newRole, { ...rolePreset(newRole), ...(cleanOverrides(storedOverrides) || {}) });
}
