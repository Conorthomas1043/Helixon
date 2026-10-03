// Keeps a Bulk analyse run in this browser (IndexedDB), CV files included,
// so closing the tab or losing the connection part-way through doesn't
// lose the run: next time /analyse?mode=bulk opens it offers to pick up
// where it stopped. Files already analysed aren't kept - only their result.
//
// Browser storage can be missing or refuse (private windows, full disk),
// so every call fails soft: the run still works, it just can't be resumed.

const DB_NAME = "helixon-bulk";
const STORE = "runs";
const KEY = "current";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("No IndexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadSavedRun() {
  try {
    return (await withStore("readonly", (s) => s.get(KEY))) || null;
  } catch {
    return null;
  }
}

export async function saveRun(run) {
  try {
    await withStore("readwrite", (s) => s.put(run, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function clearSavedRun() {
  try {
    await withStore("readwrite", (s) => s.delete(KEY));
  } catch {
    // Nothing stored, or storage unavailable - either way nothing to clear.
  }
}

// What's worth keeping of the queue. A CV mid-analysis when the tab closed
// may or may not have finished on the server, so it comes back as queued
// (a second analysis of it is flagged as a duplicate, never lost).
export function serialiseQueue(queue) {
  return queue.map((it) => {
    const done = it.status === "done";
    return {
      id: it.id,
      // Blob for anything still to analyse; just the name/size once done.
      file: done ? { name: it.file.name, size: it.file.size } : it.file,
      status: it.status === "processing" ? "queued" : it.status,
      candidateId: it.candidateId ?? null,
      score: it.score ?? null,
      name: it.name ?? null,
      errorMessage: it.errorMessage ?? null,
      duplicate: it.duplicate ?? null,
    };
  });
}

export function pendingInRun(run) {
  return (run?.queue || []).filter((it) => it.status !== "done").length;
}

// The run's results as CSV rows, best score first.
export function bulkResultRows(queue, origin = "") {
  return [...queue]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .map((it, i) => ({
      Rank: it.status === "done" ? i + 1 : "",
      Candidate: it.name || "",
      File: it.file?.name || "",
      Score: it.score ?? "",
      Status: { done: "Scored", failed: "Failed", rate_limited: "Paused", queued: "Not analysed", processing: "Not analysed" }[it.status] || it.status,
      Note: it.status === "done"
        ? it.duplicate?.sameJobCandidateId
          ? "Already in this job's pipeline"
          : it.duplicate
            ? "Already on file"
            : ""
        : it.errorMessage || "",
      Link: it.candidateId ? `${origin}/dashboard/candidates/${it.candidateId}` : "",
    }));
}
