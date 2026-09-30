import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { detectDocumentFormat, detectFileFormat } from "./fileSignature.js";
import parseDocx from "./docxParser.js";
import extractCvText, { CV_READ_ERRORS, MAX_EXTRACTED_CHARS } from "../cv-analysis/extraction/cvTextExtractor.js";

const docx = readFileSync(new URL("./fixtures/sample.docx", import.meta.url));

describe("detectDocumentFormat", () => {
  it("recognises PDFs and DOCX by their bytes", () => {
    expect(detectDocumentFormat(Buffer.from("%PDF-1.7\n..."))).toBe("pdf");
    // PDF readers allow junk before the header.
    expect(detectDocumentFormat(Buffer.from("\n\n%PDF-1.4"))).toBe("pdf");
    expect(detectDocumentFormat(docx)).toBe("docx");
  });

  it("returns null for anything else", () => {
    expect(detectDocumentFormat(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectDocumentFormat(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))).toBeNull(); // legacy .doc
    expect(detectDocumentFormat(Buffer.alloc(0))).toBeNull();
    expect(detectDocumentFormat(null)).toBeNull();
  });

  it("reads an uploaded File", async () => {
    expect(await detectFileFormat(new File([docx], "cv.pdf", { type: "application/pdf" }))).toBe("docx");
    expect(await detectFileFormat(new File(["hello"], "cv.pdf"))).toBeNull();
    expect(await detectFileFormat("not a file")).toBeNull();
  });
});

describe("DOCX CVs", () => {
  it("parses the file's bytes (it used to pass them to mammoth as a path)", async () => {
    expect((await parseDocx(docx)).trim()).toBe("Jane Doe Python engineer");
  });

  it("are read by content, whatever the file is called", async () => {
    const renamed = new File([docx], "Jane_Doe.pdf", { type: "application/pdf" });
    expect(await extractCvText(renamed)).toBe("Jane Doe Python engineer");
  });

  it("refuses files that are neither PDF nor DOCX", async () => {
    await expect(extractCvText(new File(["plain text"], "cv.docx"))).rejects.toThrow(CV_READ_ERRORS.unsupported);
    await expect(extractCvText(new File([Buffer.from([0xd0, 0xcf, 0x11, 0xe0])], "cv.doc"))).rejects.toThrow(CV_READ_ERRORS.doc);
  });

  it("reports an unreadable DOCX with a known message", async () => {
    const broken = new File([Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)])], "cv.docx");
    await expect(extractCvText(broken)).rejects.toThrow(CV_READ_ERRORS.docx);
  });

  it("bounds how much text is kept", () => {
    expect(MAX_EXTRACTED_CHARS).toBeGreaterThan(34000); // more than any prompt reads
  });
});
