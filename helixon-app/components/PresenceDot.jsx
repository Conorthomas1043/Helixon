// The small status dot on a teammate's avatar (lib/agency/presence.js states).
export const PRESENCE_COLORS = {
  active: "var(--forest)",
  idle: "var(--gold)",
  busy: "var(--score-low)",
  away: "var(--ink-faint)",
  offline: "transparent",
};

export default function PresenceDot({ state = "offline", size = 10, ring = "white", className = "" }) {
  const offline = state === "offline" || state === "hidden";
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: PRESENCE_COLORS[state] ?? "transparent",
        border: offline ? "1.5px solid var(--ink-faint)" : "none",
        boxShadow: `0 0 0 2px ${ring}`,
      }}
      aria-hidden="true"
    />
  );
}
