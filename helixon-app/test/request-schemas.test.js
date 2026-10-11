// Every API route reads its JSON body through a schema that names the fields
// it accepts (lib/api/schemas.js): customerRoute's `body` option, or
// parseBody (lib/api/body.js) in routes that read the body themselves.
// Unknown keys are dropped, so a handler only sees what its schema lists.
//
// This keeps it that way: no route reads `request.json()` itself, and none
// goes back to accepting any object.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function routes(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) routes(rel, out);
    else if (/^route\.(js|ts)$/.test(e.name)) out.push(rel);
  }
  return out;
}

const ALL = routes("app/api");

describe("request schemas", () => {
  it("no route reads its JSON body without a schema", () => {
    const offenders = ALL.filter((f) => /\b(request|req)\.json\(\)/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("no route schema accepts any object", () => {
    const offenders = ALL.filter((f) => /\bJsonObject\b|z\.looseObject\(\{\s*\}\)/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("customerRoute bodies always come with a schema", () => {
    // A handler that takes a fourth (body) argument must pass `body:`.
    const offenders = ALL.filter((f) => {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      const withBody = [...src.matchAll(/customerRoute\(async \([^,)]*,[^,)]*,[^,)]*,\s*\w+\)/g)].length;
      const schemas = [...src.matchAll(/\{\s*body:\s*\w+/g)].length;
      return withBody > schemas;
    });
    expect(offenders).toEqual([]);
  });
});
