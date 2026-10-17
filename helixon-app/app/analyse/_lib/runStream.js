// Reads /api/run's answer. Asked for with X-Run-Progress: ndjson, it arrives
// as lines of JSON - progress as the analysis goes, then the result (see
// app/api/run/route.js). Anything else (a platform error page, an older
// deployment) is read as the plain JSON answer. Either way the caller gets
// { status, data } as if it had been one ordinary response.

export const RUN_PROGRESS_HEADERS = { "X-Run-Progress": "ndjson" };

export async function readRunResponse(response, onProgress) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("ndjson") || !response.body) {
    return { status: response.status, data: await response.json().catch(() => null) };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = null;
  const handle = (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.type === "progress") onProgress?.(msg.step);
    else if (msg.type === "done") done = msg;
  };

  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    lines.forEach(handle);
  }
  handle(buffer + decoder.decode());

  // A stream cut off before its last line: the connection dropped.
  if (!done) return { status: 502, data: null };
  return { status: done.status, data: done.body };
}
