// Prefers the agency's own name (absent when there's no agency row yet, or
// its name is blank), then the owner's first name (createProfileAndAgency
// already defaults a new agency's name to "{firstName}'s agency", see
// lib/create-profile.js), and only then the generic "your agency".
// Centralising the fallback order here means every call site prefers the
// most real value on hand, and they can't drift out of sync with each other.
export function agencyDisplayName(agency, profile) {
  if (agency?.name) return agency.name;
  if (profile?.first_name) return `${profile.first_name}'s agency`;
  return "your agency";
}
