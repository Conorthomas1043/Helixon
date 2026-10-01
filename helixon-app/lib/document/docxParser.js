import mammoth from "mammoth";

// Plain text from a Word (.docx) file's bytes. mammoth reads from
// { buffer } - given { path } it tries to open a file on disk, which is
// why every .docx upload used to fail.
export default async function parseDOCX(buffer) {
  if (!buffer || !buffer.length) {
    throw new Error("No DOCX buffer supplied");
  }
  const result = await mammoth.extractRawText({ buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer) });
  return result.value;
}
