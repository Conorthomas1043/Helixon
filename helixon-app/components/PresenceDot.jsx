// The small status dot on a teammate's avatar (lib/presence.js states).
export const PRESENCE_COLORS = {
  active: "#1f9d61",
  idle: "#e2a93b",
  busy: "#d24a3c",
  away: "#8e9b95",
  offline: "transparent",
};

export default function PresenceDot({ state = "offline", size = 10, ring = "white", className = "" }) {
  const offline = state === "offline";
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: PRESENCE_COLORS[state] ?? "transparent",
        border: offline ? "1.5px solid #9aa7a1" : "none",
        boxShadow: `0 0 0 2px ${ring}`,
      }}
      aria-hidden="true"
    />
  );
}
