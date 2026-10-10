import { describe, expect, it } from "vitest";
import { fetchAll, inChunks } from "@/lib/fetch-all";

const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
const pager = (from, to) => Promise.resolve({ data: rows.slice(from, to + 1), error: null });

describe("fetchAll", () => {
  it("reads past the 1,000-row page", async () => {
    const { data, truncated } = await fetchAll(pager);
    expect(data).toHaveLength(2500);
    expect(truncated).toBe(false);
  });

  it("stops at the cap and says so", async () => {
    const { data, truncated } = await fetchAll(pager, { cap: 2000 });
    expect(data).toHaveLength(2000);
    expect(truncated).toBe(true);
  });

  it("passes an error back", async () => {
    const { data, error } = await fetchAll(() => Promise.resolve({ data: null, error: { message: "boom" } }));
    expect(data).toBeNull();
    expect(error.message).toBe("boom");
  });
});

describe("inChunks", () => {
  it("queries in chunks and joins the results", async () => {
    const seen = [];
    const { data } = await inChunks(Array.from({ length: 450 }, (_, i) => i), (chunk) => {
      seen.push(chunk.length);
      return Promise.resolve({ data: chunk.map((id) => ({ id })), error: null });
    });
    expect(seen).toEqual([200, 200, 50]);
    expect(data).toHaveLength(450);
  });
});
