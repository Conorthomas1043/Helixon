/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: "#0b6e4f",
          deep: "#0b3a2a",
        },
        mint: "#e3f2e9",
        mist: "#f4f8f6",
        ink: "#13201b",
        muted: "#5a7a6a",
        faint: "#8aaa9a",
        line: "#d8e5de",
        signal: "#f59e0b",
      },
      // A small type scale to replace one-off text-[Npx] values.
      fontSize: {
        "3xs": ["9px", { lineHeight: "1.4" }],
        "2xs": ["10px", { lineHeight: "1.4" }],
      },
      fontFamily: {
        // Fraunces gives headlines real character - a wonky, high-contrast
        // serif built for display sizes, not just "a serif" as a signal.
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        raise: "0 20px 40px -20px rgba(19,32,27,0.18)",
        card: "0 12px 28px -12px rgba(11,110,79,0.5)",
        cta: "0 8px 20px -8px rgba(11,110,79,0.5)",
        button: "0 12px 24px -10px rgba(11,58,42,0.5)",
        pop: "0 50px 100px -30px rgba(11,26,20,0.45)",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        popIn: {
          from: { opacity: 0, transform: "scale(0.94) translateY(10px)" },
          to: { opacity: 1, transform: "scale(1) translateY(0)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
        heroIn: {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.25s cubic-bezier(0.16,1,0.3,1)",
        popIn: "popIn 0.35s cubic-bezier(0.16,1,0.3,1)",
        shake: "shake 0.4s ease",
        heroIn: "heroIn 0.6s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};