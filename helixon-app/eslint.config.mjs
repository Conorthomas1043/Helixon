import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // The app is plain JavaScript, so this is the check that catches a
    // variable used outside the block that declares it.
    files: ["**/*.{js,jsx,mjs}"],
    rules: { "no-undef": "error" },
  },
  {
    // Playwright fixtures call `use()`, which isn't a React hook.
    files: ["e2e/**/*.js"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // The LinkedIn browser extension runs with the `chrome` extension API.
    files: ["extensions/**/*.js"],
    languageOptions: { globals: { chrome: "readonly" } },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
