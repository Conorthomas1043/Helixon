// "your agency" was previously shown verbatim for two very different
// situations (no agency row yet at all, and an agency row with a blank
// name) even though real data - the agency's own name, or at least the
// owner's first name (createProfileAndAgency already defaults a new
// agency's name to "{firstName}'s agency", see lib/create-profile.js) -
// is usually available. Centralising the fallback order here means every
// call site prefers the most real value on hand instead of jumping
// straight to the generic placeholder, and can't drift out of sync with
// each other.
export function agencyDisplayName(agency, profile) {
  if (agency?.name) return agency.name;
  if (profile?.first_name) return `${profile.first_name}'s agency`;
  return "your agency";
}
