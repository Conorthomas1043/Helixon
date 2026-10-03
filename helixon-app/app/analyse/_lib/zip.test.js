import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { isZipFile, unzipCvs } from "./zip";

const archive = () =>
  zipSync({
    "cvs/ana.pdf": strToU8("%PDF-1.4 ana"),
    "cvs/nested/ben.docx": strToU8("docx ben"),
    "cvs/notes.txt": strToU8("hello"),
    "__MACOSX/cvs/._ana.pdf": strToU8("junk"),
    "cvs/.DS_Store": strToU8("junk"),
    "cat.PDF": strToU8("%PDF cat"),
  });

describe("unzipCvs", () => {
  it("takes the PDFs and Word files at any depth and skips the rest", async () => {
    const { files, skipped } = await unzipCvs(archive());
    expect(files.map((f) => f.name)).toEqual(["cat.PDF", "ana.pdf", "ben.docx"]);
    expect(files[1].type).toBe("application/pdf");
    expect(files[2].type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(await files[1].text()).toBe("%PDF-1.4 ana");
    expect(skipped).toEqual(["notes.txt (not a PDF or DOCX)"]);
  });

  it("stops at the limit and says how many were left out", async () => {
    const { files, skipped } = await unzipCvs(archive(), { limit: 1 });
    expect(files).toHaveLength(1);
    expect(skipped.filter((s) => s.includes("limit"))).toHaveLength(2);
  });

  it("rejects something that isn't a zip", async () => {
    await expect(unzipCvs(strToU8("not a zip"))).rejects.toThrow("couldn't be opened");
  });
});

describe("isZipFile", () => {
  it("spots zips by name or type", () => {
    expect(isZipFile({ name: "CVs.ZIP", type: "" })).toBe(true);
    expect(isZipFile({ name: "x", type: "application/x-zip-compressed" })).toBe(true);
    expect(isZipFile({ name: "cv.pdf", type: "application/pdf" })).toBe(false);
  });
});
