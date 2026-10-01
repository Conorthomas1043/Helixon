import { describe, expect, it } from "vitest";
import { booleanToTsquery, looksBoolean } from "./boolean-search";

describe("looksBoolean", () => {
  it("spots boolean syntax", () => {
    expect(looksBoolean("java AND spring")).toBe(true);
    expect(looksBoolean('"product manager"')).toBe(true);
    expect(looksBoolean("sales -junior")).toBe(true);
    expect(looksBoolean("develop*")).toBe(true);
    expect(looksBoolean("ana ruiz")).toBe(false);
    expect(looksBoolean("android developer")).toBe(false);
  });
});

describe("booleanToTsquery", () => {
  it("handles AND / OR / NOT, brackets and phrases", () => {
    expect(booleanToTsquery('(java OR kotlin) AND "spring boot" NOT junior')).toBe("( java | kotlin ) & ( spring <-> boot ) & ! junior");
  });

  it("treats adjacent words as AND and - as NOT", () => {
    expect(booleanToTsquery("python django -intern")).toBe("python & django & ! intern");
  });

  it("supports prefixes and punctuation inside words", () => {
    expect(booleanToTsquery("develop* node.js")).toBe("develop:* & node.js");
  });

  it("is safe with junk and unbalanced input", () => {
    expect(booleanToTsquery("(java OR")).toBe("( java )");
    expect(booleanToTsquery('" "')).toBeNull();
    expect(booleanToTsquery("&|!:*")).toBeNull();
    expect(booleanToTsquery("NOT java")).toBeNull();
    expect(booleanToTsquery("c++ OR c#")).toBe("c++ | c#");
    expect(booleanToTsquery("it's a:b")).toBe("its & ( a <-> b )");
  });

  it("lower-cases and keeps accented letters", () => {
    expect(booleanToTsquery("Café AND Barista")).toBe("café & barista");
  });
});
