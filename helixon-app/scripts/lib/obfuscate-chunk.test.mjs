import { describe, expect, it } from "vitest";
import { GenMapping, addMapping, toEncodedMap } from "@jridgewell/gen-mapping";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { obfuscateChunk } from "./obfuscate-chunk.mjs";

const DEBUG_ID = "2f4b8c1e-9a7d-4e3b-8f21-6c5d4a3b2e10";

// A compiled chunk and its build map: every token on line 1 comes from
// line 5 of src/greet.js.
function compiledChunk() {
  const code = `function greet(name){return "hello "+name}window.greet=greet;\n//# debugId=${DEBUG_ID}\n`;
  const gen = new GenMapping({ file: "page.js" });
  for (const column of [0, 9, 15, 21, 28, 42, 49]) {
    addMapping(gen, { generated: { line: 1, column }, source: "src/greet.js", original: { line: 5, column } });
  }
  return { code, map: toEncodedMap(gen) };
}

describe("obfuscateChunk", () => {
  it("maps the obfuscated code back to the original source, not the compiled chunk", () => {
    const { code, map } = compiledChunk();
    const out = obfuscateChunk(code, { fileName: "page.js", inputMap: map });

    expect(out.code).not.toContain("hello ");
    expect(out.map.sources).toEqual(["src/greet.js"]);

    const traced = new TraceMap(out.map);
    const lines = out.code.split("\n");
    const hits = [];
    lines.forEach((text, i) => {
      for (let column = 0; column < text.length; column += 7) {
        const pos = originalPositionFor(traced, { line: i + 1, column });
        if (pos.source) hits.push(pos);
      }
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((p) => p.source === "src/greet.js" && p.line === 5)).toBe(true);
  });

  it("keeps the debug ID on the code and copies it into the map", () => {
    const { code, map } = compiledChunk();
    const out = obfuscateChunk(code, { fileName: "page.js", inputMap: map });
    expect(out.debugId).toBe(DEBUG_ID);
    expect(out.code.trimEnd().endsWith(`//# debugId=${DEBUG_ID}`)).toBe(true);
    expect(out.map.debugId).toBe(DEBUG_ID);
    expect(out.code).not.toContain("sourceMappingURL");
  });

  it("obfuscates without a map when the build made none", () => {
    const out = obfuscateChunk(`function greet(n){return "hello "+n}window.greet=greet;`, { fileName: "page.js" });
    expect(out.map).toBeNull();
    expect(out.debugId).toBeNull();
    expect(out.code).not.toContain("hello ");
  });
});
