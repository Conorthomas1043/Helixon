import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readScreeningForm } from "./input";
import { SAMPLE_CV_PATH, SAMPLE_ROLE } from "./sample";

const sampleBytes = readFileSync(path.join(__dirname, "../../public", SAMPLE_CV_PATH));

function form(fields) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

describe("readScreeningForm and the sample CV", () => {
  it("screens the bundled sample without a lawful-basis confirmation, and marks it", async () => {
    const read = await readScreeningForm(form({ cv: new File([sampleBytes], "sample.pdf", { type: "application/pdf" }), jobText: SAMPLE_ROLE, sample: "true" }));
    expect(read.error).toBeUndefined();
    expect(read.input.sample).toBe(true);
  });

  it("still asks for a lawful basis for any other CV sent as a sample", async () => {
    const other = new File(["%PDF-1.4 someone real"], "sample.pdf", { type: "application/pdf" });
    const read = await readScreeningForm(form({ cv: other, jobText: SAMPLE_ROLE, sample: "true" }));
    expect(read.status).toBe(400);
  });

  it("doesn't mark the sample file as a sample unless asked", async () => {
    const read = await readScreeningForm(
      form({ cv: new File([sampleBytes], "sample.pdf", { type: "application/pdf" }), jobText: SAMPLE_ROLE, lawfulBasisConfirmed: "true" }),
    );
    expect(read.input.sample).toBe(false);
  });
});
