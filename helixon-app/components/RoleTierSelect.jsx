// RoleTierSelect.jsx
// Drop into the save-job screen. Shows the auto-detected role_tier from
// extractJob()/classifyJobTier(), editable in one click — this is the
// correction mechanism for boundary-role misclassification (Part Two:
// "the tier is always shown to the recruiter as an editable dropdown
// specifically so a misclassified boundary job can be corrected in one
// click rather than silently scoring wrong").
//
// Usage:
//   <RoleTierSelect value={job.role_tier} onChange={(tier) => updateJob({ role_tier: tier })} />

const TIER_OPTIONS = [
  { value: "entry_level", label: "Entry-level / High-volume" },
  { value: "skilled",     label: "Skilled / Specialist" },
  { value: "senior",      label: "Senior / Leadership" },
];

export default function RoleTierSelect({ value, onChange, autoDetected = true }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        htmlFor="role-tier-select"
        style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5" }}
      >
        Role type
      </label>
      <select
        id="role-tier-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "#1a1a1a",
          color: "#f5f5f5",
          border: "1px solid #3a3a3a",
          borderRadius: 6,
          padding: "8px 10px",
          fontSize: 14,
        }}
      >
        {TIER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {autoDetected && (
        <span style={{ fontSize: 12, color: "#9a9a9a" }}>
          Auto-detected — change if needed
        </span>
      )}
    </div>
  );
}