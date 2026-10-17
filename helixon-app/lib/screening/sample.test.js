import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_CV_PATH, SAMPLE_ROLE, isSampleCv } from "./sample";

const bytes = readFileSync(path.join(__dirname, "../../public", SAMPLE_CV_PATH));

describe("the sample CV", () => {
  it("is recognised by its bytes", async () => {
    expect(await isSampleCv(new File([bytes], "anything.pdf", { type: "application/pdf" }))).toBe(true);
  });

  it("isn't matched by any other file, or by a name", async () => {
    const changed = new Uint8Array(bytes);
    changed[changed.length - 10] ^= 1;
    expect(await isSampleCv(new File([changed], "helixon-sample-cv.pdf"))).toBe(false);
    expect(await isSampleCv(new File(["%PDF-1.4"], "helixon-sample-cv.pdf"))).toBe(false);
    expect(await isSampleCv(null)).toBe(false);
  });

  it("has a role long enough to screen against", () => {
    expect(SAMPLE_ROLE.length).toBeGreaterThan(50);
  });
});
