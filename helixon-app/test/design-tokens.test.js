// Keeps the design system the source of colours and styling.
//
// Hard-coded hex colours, inline style={{...}} objects and arbitrary font
// sizes (text-[13px]) are counted per file and compared with
// design-tokens.baseline.json. A file may lose them (please do, as you touch
// it: use the --ui-* / palette tokens, the kit in components/ui and the type
// scale - text-xs, text-sm, text-base ...), but not gain them, and a new file
// starts at zero. Half-pixel font sizes (13.5px) aren't allowed at all: they
// render blurry on standard screens and were the bulk of 31 distinct sizes.
//
// Exempt: where the tokens are defined (globals.css, the admin console's
// stylesheet), emails (mail clients need literal colours), and the generated
// social image.
//
//   UPDATE_DESIGN_BASELINE=1 npx vitest run test/design-tokens.test.js

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const BASELINE = path.join(__dirname, "design-tokens.baseline.json");
// lib/ui/clerk-appearance.js: Clerk computes shades from its colours, so it
// needs literal values (the same as the tokens). app/manifest.js: browsers
// read its colours outside any stylesheet.
const EXEMPT = [/^app\/admin\/_shared\/styles\.js$/, /^emails\//, /^app\/opengraph-image\.js$/, /^lib\/ui\/clerk-appearance\.js$/, /^app\/manifest\.js$/, /\.test\.jsx?$/];

function files(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) files(rel, out);
    else if (/\.(js|jsx)$/.test(e.name) && !EXEMPT.some((r) => r.test(rel))) out.push(rel);
  }
  return out;
}

export function count(source) {
  return {
    hex: (source.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g) || []).length,
    inlineStyles: (source.match(/style=\{\{/g) || []).length,
    fontSizes: (source.match(/\btext-\[[0-9.]+(?:px|rem)\]/g) || []).length,
  };
}

const HALF_PIXEL = /\btext-\[\d+\.5px\]|fontSize: ?"?\d+\.5(?:px)?\b|font-size: ?\d+\.5px/g;

function current() {
  const out = {};
  for (const f of ["app", "components", "lib"].flatMap((d) => files(d)).sort()) {
    const c = count(fs.readFileSync(path.join(ROOT, f), "utf8"));
    if (c.hex || c.inlineStyles || c.fontSizes) out[f] = c;
  }
  return out;
}

describe("design tokens", () => {
  it("counts hex colours and inline styles", () => {
    expect(count('<div style={{ color: "#13201b" }} className="text-[#fff] text-[13px]" />')).toEqual({ hex: 2, inlineStyles: 1, fontSizes: 1 });
  });

  it("no arbitrary font sizes or corner radii: every one is on the scale", () => {
    // The scales are the --text-* and --radius-* tokens in app/globals.css
    // (text-11 ... text-52, rounded-sm ... rounded-3xl). Add a step there if
    // a design genuinely needs one, rather than a one-off value here.
    const ARBITRARY = /\btext-\[[0-9.]+(?:px|rem)\]|\brounded(?:-[a-z]{1,2})?-\[[0-9.]+(?:px|rem)\]/g;
    const found = [];
    for (const f of ["app", "components", "lib"].flatMap((d) => files(d))) {
      const hits = fs.readFileSync(path.join(ROOT, f), "utf8").match(ARBITRARY);
      if (hits) found.push(`${f}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(found).toEqual([]);
  });

  it("no half-pixel font sizes", () => {
    const found = [];
    for (const f of ["app", "components", "lib"].flatMap((d) => files(d))) {
      const hits = fs.readFileSync(path.join(ROOT, f), "utf8").match(HALF_PIXEL);
      if (hits) found.push(`${f}: ${hits.join(", ")}`);
    }
    expect(found).toEqual([]);
  });

  it("no file gains hard-coded colours, inline styles or arbitrary font sizes", () => {
    const now = current();
    if (process.env.UPDATE_DESIGN_BASELINE) {
      fs.writeFileSync(BASELINE, JSON.stringify(now, null, 2) + "\n");
      return;
    }
    const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    const grew = [];
    for (const [f, c] of Object.entries(now)) {
      const b = { hex: 0, inlineStyles: 0, fontSizes: 0, ...base[f] };
      if (c.hex > b.hex) grew.push(`${f}: ${b.hex} -> ${c.hex} hex colours (use a token, e.g. var(--ui-text) or text-[var(--ink-soft)])`);
      if (c.inlineStyles > b.inlineStyles) grew.push(`${f}: ${b.inlineStyles} -> ${c.inlineStyles} inline style objects (use Tailwind classes or the kit)`);
      if (c.fontSizes > b.fontSizes) grew.push(`${f}: ${b.fontSizes} -> ${c.fontSizes} arbitrary font sizes (use text-xs, text-sm, text-base ...)`);
    }
    expect(grew).toEqual([]);
  });
});
