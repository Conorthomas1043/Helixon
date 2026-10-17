// The sample screening a new account can run before it has a CV of its own:
// a fictional CV (public/samples/helixon-sample-cv.pdf) and a role to score
// it against. It runs the real pipeline, so the recruiter sees a real report
// and the candidate lands in their pipeline, labelled as a sample.
//
// The server knows the sample by its bytes, not by a form flag alone: only
// this exact file skips the lawful-basis confirmation (it's no one's personal
// data) and is labelled "Sample CV". sample.test.js keeps the hash in step
// with the file.

export const SAMPLE_CV_PATH = "/samples/helixon-sample-cv.pdf";
export const SAMPLE_CV_NAME = "Amy Clarke - sample CV.pdf";
export const SAMPLE_CV_SHA256 = "989d5722da183c04c3c3972ffdb32945ef8fc2f18578cbdd84de579c0edd56dd";
export const SAMPLE_SOURCE_DETAIL = "Sample CV";

export const SAMPLE_ROLE = `Warehouse Team Leader - nights, Leeds distribution centre
£13-£14 an hour, 4 nights on / 4 off.

Lead a night shift of 12-15 pickers and packers in a busy e-commerce warehouse. Hit pick-rate and accuracy targets, train new starters on the scanners and WMS, plan the shift rota and run the shift's health and safety checks.

Must have:
- At least two years leading a warehouse team

Nice to have:
- WMS experience (Manhattan or similar)
- IOSH or first aid at work`;

// Sent as the recruiter's extra must-haves, so the run shows them being
// checked and the report marks each one.
export const SAMPLE_REQUIREMENTS = ["Right to work in the UK", "Available for night shifts", "Counterbalance forklift licence"];

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// True only for the bundled sample CV, byte for byte.
export async function isSampleCv(file) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size > 64 * 1024) return false;
  return (await sha256Hex(await file.arrayBuffer())) === SAMPLE_CV_SHA256;
}
