// Small and fixed enough not to need its own table. If this grows past a
// handful of agency-specific tags, promote it to a `tag_catalog` table
// scoped by agency_id instead.
export const TAG_CATALOG = [
  { id: "strong-technical", label: "Strong technical" },
  { id: "urgent", label: "Urgent" },
  { id: "client-ready", label: "Client-ready" },
  { id: "remote-only", label: "Remote only" },
  { id: "senior-profile", label: "Senior profile" },
  { id: "follow-up", label: "Needs follow-up" },
  { id: "referral", label: "Referral" },
];
