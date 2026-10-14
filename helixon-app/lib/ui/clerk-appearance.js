// Clerk's widgets in Helixon's colours and type.
//
// Clerk derives hover and focus shades from these values, so they have to be
// literal colours rather than CSS variables. They are the same values as the
// tokens in app/globals.css (--forest, --ink, --ink-soft); keep them in step.
// This file is exempt from the hex-colour ratchet in test/design-tokens.test.js
// for that reason.

export const CLERK_COLORS = {
  primary: "#0b6e4f", // --forest
  text: "#13201b", // --ink
  textSecondary: "#4a6658", // --ink-soft
};

// Provider-wide defaults: modals, popovers and any widget without its own
// appearance. Set in the body font, the same as the page around them.
export const CLERK_PROVIDER_APPEARANCE = {
  variables: {
    colorPrimary: CLERK_COLORS.primary,
    colorText: CLERK_COLORS.text,
    colorTextSecondary: CLERK_COLORS.textSecondary,
    colorBackground: "#ffffff",
    borderRadius: "12px",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
  },
};

// The sign-in and sign-up cards on /login and /signup, which sit on a
// translucent glass panel and take the page's font.
export const AUTH_CARD_VARIABLES = {
  colorPrimary: CLERK_COLORS.primary,
  colorText: CLERK_COLORS.text,
  colorTextSecondary: CLERK_COLORS.textSecondary,
  colorInputBackground: "rgba(255,255,255,0.6)",
  colorInputText: CLERK_COLORS.text,
  borderRadius: "12px",
  fontFamily: "inherit",
};

export const AUTH_CARD_ELEMENTS = {
  rootBox: "!w-full !min-w-0",
  cardBox: "!w-full !min-w-0 !shadow-none !bg-transparent",
  card: "!w-full !min-w-0 !max-w-full !box-border !shadow-none !bg-transparent !p-0 !gap-4",
  headerTitle: "tracking-tight",
  headerSubtitle: "text-13",
  form: "!w-full gap-3.5",
  formField: "!w-full !min-w-0",
  formFieldInput: "!w-full box-border rounded-xl",
  socialButtonsBlockButton: "!w-full box-border rounded-xl",
  formButtonPrimary: "normal-case text-sm font-semibold rounded-xl py-3 shadow-[0_12px_24px_-10px_rgba(11,110,79,0.5)] hover:brightness-95",
  footer: "!bg-transparent !px-0",
  footerAction: "!flex !flex-col !items-center !gap-1 text-13 text-center",
  dividerRow: "my-4",
};
