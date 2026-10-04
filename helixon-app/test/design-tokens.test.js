// Keeps the design system the source of colours and styling.
//
// Hard-coded hex colours and inline style={{...}} objects are counted per
// file and compared with design-tokens.baseline.json. A file may lose them
// (please do, as you touch it: use the --ui-* / palette tokens and the kit in
// components/ui), but not gain them, and a new file starts at zero.
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
const EXEMPT = [/^app\/admin\/_shared\/styles\.js$/, /^emails\//, /^app\/opengraph-image\.js$/, /\.test\.jsx?$/];

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
  };
}

function current() {
  const out = {};
  for (const f of ["app", "components", "lib"].flatMap((d) => files(d)).sort()) {
    const c = count(fs.readFileSync(path.join(ROOT, f), "utf8"));
    if (c.hex || c.inlineStyles) out[f] = c;
  }
  return out;
}

describe("design tokens", () => {
  it("counts hex colours and inline styles", () => {
    expect(count('<div style={{ color: "#13201b" }} className="text-[#fff]" />')).toEqual({ hex: 2, inlineStyles: 1 });
  });

  it("no file gains hard-coded colours or inline styles", () => {
    const now = current();
    if (process.env.UPDATE_DESIGN_BASELINE) {
      fs.writeFileSync(BASELINE, JSON.stringify(now, null, 2) + "\n");
      return;
    }
    const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    const grew = [];
    for (const [f, c] of Object.entries(now)) {
      const b = base[f] || { hex: 0, inlineStyles: 0 };
      if (c.hex > b.hex) grew.push(`${f}: ${b.hex} -> ${c.hex} hex colours (use a token, e.g. var(--ui-text) or text-[var(--ink-soft)])`);
      if (c.inlineStyles > b.inlineStyles) grew.push(`${f}: ${b.inlineStyles} -> ${c.inlineStyles} inline style objects (use Tailwind classes or the kit)`);
    }
    expect(grew).toEqual([]);
  });
});
