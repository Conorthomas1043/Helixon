import { describe, expect, it } from "vitest";
import { parseBody } from "./body";
import { fields, flag, ids, nested, num, str, text } from "./schemas";

const req = (body) => new Request("http://x.test/api/thing", { method: "POST", body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });

const Note = fields({ body: text(10), pinned: flag, tags: ids(2), count: num, title: str(5), extra: nested });

describe("parseBody with a field schema", () => {
  it("keeps only the fields the schema names", async () => {
    const { body } = await parseBody(req({ body: "hi", agency_id: "someone-else", pinned: true }), Note);
    expect(body).toEqual({ body: "hi", pinned: true });
  });

  it("leaves absent fields absent, so handlers can tell 'not sent' from 'cleared'", async () => {
    const { body } = await parseBody(req({ body: null }), Note);
    expect(body).toEqual({ body: null });
    expect("pinned" in body).toBe(false);
  });

  it("accepts numbers typed as text where the cleaners do", async () => {
    const { body } = await parseBody(req({ count: "12", body: 7 }), Note);
    expect(body).toEqual({ count: "12", body: 7 });
  });

  it.each([
    ["an over-long text field", { body: "x".repeat(11) }, /^body: /],
    ["a list that's too long", { tags: ["a", "b", "c"] }, /^tags: /],
    ["a non-boolean flag", { pinned: "yes" }, /^pinned: /],
    ["a number where only text works", { title: 5 }, /^title: /],
  ])("refuses %s, naming the field", async (_label, input, message) => {
    const { response } = await parseBody(req(input), Note);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(message);
  });

  it("treats an empty body as {} only when allowed", async () => {
    expect((await parseBody(req(), Note, { allowEmpty: true })).body).toEqual({});
    expect((await parseBody(req(), Note)).response.status).toBe(400);
    expect((await parseBody(req("not json"), Note, { allowEmpty: true })).response.status).toBe(400);
  });

  it("lets a caller shape its own error response", async () => {
    const { response } = await parseBody(req("nope"), Note, { respond: (status, message) => Response.json({ error: { status, message } }, { status }) });
    expect(await response.json()).toEqual({ error: { status: 400, message: "The request body must be JSON." } });
  });
});
