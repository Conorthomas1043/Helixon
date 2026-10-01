import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import parseDOCX from "@/lib/document/docxParser";
import extractCvText from "@/lib/cv-analysis/extraction/cvTextExtractor";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// A minimal real .docx: the three parts Word needs, with two paragraphs.
async function makeDocx(paragraphs) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  );
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("parseDOCX", () => {
  it("reads the text from a .docx buffer", async () => {
    const text = await parseDOCX(await makeDocx(["Jane Doe", "Senior Data Engineer at Acme"]));
    expect(text).toContain("Jane Doe");
    expect(text).toContain("Senior Data Engineer at Acme");
  });

  it("refuses an empty buffer", async () => {
    await expect(parseDOCX(Buffer.alloc(0))).rejects.toThrow(/No DOCX/);
  });
});

describe("extractCvText with Word files", () => {
  it("reads an uploaded .docx CV", async () => {
    const bytes = await makeDocx(["Jane Doe", "Python, SQL, Airflow"]);
    const file = new File([bytes], "Jane_Doe_CV.docx", { type: DOCX_MIME });
    expect(await extractCvText(file)).toBe("Jane Doe\n\nPython, SQL, Airflow");
  });

  it("works when the browser gives no file type, going by the name", async () => {
    const file = new File([await makeDocx(["Sam Lee"])], "cv.DOCX", { type: "" });
    expect(await extractCvText(file)).toBe("Sam Lee");
  });

  it("says plainly when a file named .docx isn't really one", async () => {
    const file = new File([Buffer.from("this is an old .doc, renamed")], "old.docx", { type: DOCX_MIME });
    await expect(extractCvText(file)).rejects.toThrow("Unable to extract text from DOCX");
  });

  it("says when a .docx has no text", async () => {
    const file = new File([await makeDocx([])], "blank.docx", { type: DOCX_MIME });
    await expect(extractCvText(file)).rejects.toThrow("DOCX contained no readable text");
  });
});
