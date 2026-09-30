// What a CV upload actually is, from its first bytes rather than the name
// or MIME type the browser sent (both are just labels the client chose).
// Parsing, storage and the content type a stored file is later served with
// all follow this, so a file renamed to .pdf can't be kept and handed back
// to recruiters as something it isn't.

// PDF readers accept the header anywhere in the first 1 KB.
const PDF_HEADER = Buffer.from("%PDF-");
// A .docx is a ZIP archive (local file header "PK\x03\x04").
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** "pdf", "docx" or null. */
export function detectDocumentFormat(bytes) {
    if (!bytes || !bytes.length) return null;
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);

    if (buffer.subarray(0, 1024).includes(PDF_HEADER)) return "pdf";
    if (buffer.subarray(0, 4).equals(ZIP_HEADER)) return "docx";
    return null;
}

/** detectDocumentFormat for an uploaded File/Blob. */
export async function detectFileFormat(file) {
    if (!file || typeof file !== "object" || typeof file.slice !== "function") return null;
    return detectDocumentFormat(Buffer.from(await file.slice(0, 1024).arrayBuffer()));
}
