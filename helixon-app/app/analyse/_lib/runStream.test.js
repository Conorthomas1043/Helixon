import { describe, expect, it } from "vitest";
import { readRunResponse } from "./runStream";

function ndjson(chunks) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      chunks.forEach((s) => c.enqueue(encoder.encode(s)));
      c.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
}

describe("readRunResponse", () => {
  it("reports progress and returns the final answer, across split chunks", async () => {
    const steps = [];
    const res = ndjson(['{"type":"progress","step":1}\n{"type":"pro', 'gress","step":2}\n', '{"type":"done","status":200,"body":{"ok":true}}\n']);
    expect(await readRunResponse(res, (s) => steps.push(s))).toEqual({ status: 200, data: { ok: true } });
    expect(steps).toEqual([1, 2]);
  });

  it("passes on a refusal carried in the stream", async () => {
    const res = ndjson(['{"type":"done","status":429,"body":{"ok":false,"error":"Slow down"}}']);
    expect(await readRunResponse(res)).toEqual({ status: 429, data: { ok: false, error: "Slow down" } });
  });

  it("treats a stream that ends early as a failed connection", async () => {
    expect((await readRunResponse(ndjson(['{"type":"progress","step":1}\n']))).status).toBe(502);
  });

  it("reads a plain JSON answer too", async () => {
    const res = new Response(JSON.stringify({ error: "Too large" }), { status: 413, headers: { "Content-Type": "application/json" } });
    expect(await readRunResponse(res)).toEqual({ status: 413, data: { error: "Too large" } });
  });
});
