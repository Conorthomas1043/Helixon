import mammoth from "mammoth";
import { Unzip, UnzipInflate } from "fflate";

// A .docx is a zip, and a few kilobytes of zip can inflate to gigabytes.
// mammoth inflates every part in memory, so the archive is first
// decompressed in a streaming pass that stops as soon as the real output
// (not the sizes the zip declares about itself, which it can lie about)
// passes this. A real CV is well under a megabyte of XML.
export const MAX_DOCX_EXPANDED_BYTES = 50 * 1024 * 1024;
const MAX_DOCX_ENTRIES = 2000;
const SLICE = 64 * 1024;

export function assertDocxExpandsWithin(bytes, limit = MAX_DOCX_EXPANDED_BYTES) {
  let total = 0;
  let entries = 0;
  let tooBig = false;
  const unzip = new Unzip((file) => {
    entries += 1;
    if (entries > MAX_DOCX_ENTRIES) {
      tooBig = true;
      return;
    }
    file.ondata = (err, chunk) => {
      if (err || tooBig) return;
      total += chunk.length;
      if (total > limit) {
        tooBig = true;
        file.terminate();
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  // Fed in slices, so one push can only inflate so much before the check.
  for (let i = 0; i < bytes.length && !tooBig; i += SLICE) {
    unzip.push(bytes.subarray(i, i + SLICE), i + SLICE >= bytes.length);
  }
  if (tooBig) throw new Error("Unable to extract text from DOCX: the file is far larger than a CV once opened.");
}

// Plain text from a Word (.docx) file's bytes. mammoth reads from
// { buffer } - given { path } it tries to open a file on disk, which an
// upload doesn't have.
export default async function parseDOCX(buffer) {
  if (!buffer || !buffer.length) {
    throw new Error("No DOCX buffer supplied");
  }
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  try {
    assertDocxExpandsWithin(bytes);
  } catch (err) {
    if (/far larger/.test(err?.message || "")) throw err;
    // Not a readable zip: mammoth gives its own error below.
  }
  const result = await mammoth.extractRawText({ buffer: bytes });
  return result.value;
}
