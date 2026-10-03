// Unpacks a .zip of CVs for Bulk analyse: the PDF and Word files inside
// (any folder depth) as File objects, plus what was skipped and why.
// Nothing larger than a single CV may be (10 MB) is ever decompressed, and
// the number of files taken is capped, so a hostile archive can't exhaust
// the browser's memory.

import { unzip } from "fflate";

const MAX_ENTRY_BYTES = 10 * 1024 * 1024;
const TYPES = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function isZipFile(file) {
  const name = (file?.name || "").toLowerCase();
  return name.endsWith(".zip") || file?.type === "application/zip" || file?.type === "application/x-zip-compressed";
}

function extensionOf(path) {
  const m = /\.[a-z0-9]+$/i.exec(path);
  return m ? m[0].toLowerCase() : "";
}

function baseName(path) {
  return path.split("/").pop();
}

// Mac Finder's "Compress" adds a __MACOSX/ shadow copy of every file, and
// dot-files are never CVs.
function isJunk(path) {
  return path.startsWith("__MACOSX/") || path.includes("/__MACOSX/") || baseName(path).startsWith(".");
}

// bytes: Uint8Array of the archive. limit: most CVs to take.
// Resolves { files: File[], skipped: string[] }; rejects if it isn't a zip.
export function unzipCvs(bytes, { limit = Infinity } = {}) {
  const skipped = [];
  let taken = 0;
  return new Promise((resolve, reject) => {
    unzip(
      bytes,
      {
        filter(entry) {
          const path = entry.name;
          if (path.endsWith("/") || isJunk(path)) return false;
          if (!TYPES[extensionOf(path)]) {
            skipped.push(`${baseName(path)} (not a PDF or DOCX)`);
            return false;
          }
          if (entry.originalSize > MAX_ENTRY_BYTES) {
            skipped.push(`${baseName(path)} (over 10 MB)`);
            return false;
          }
          if (taken >= limit) {
            skipped.push(`${baseName(path)} (over the ${limit}-CV limit)`);
            return false;
          }
          taken += 1;
          return true;
        },
      },
      (err, entries) => {
        if (err) {
          reject(new Error("That zip file couldn't be opened."));
          return;
        }
        const files = Object.entries(entries)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([path, data]) => new File([data], baseName(path), { type: TYPES[extensionOf(path)] }));
        resolve({ files, skipped });
      }
    );
  });
}
