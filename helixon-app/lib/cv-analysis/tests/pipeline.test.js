import { describe, it, expect, vi, beforeEach } from "vitest";

// --- askClaude: retries a malformed response once, not forever ---

const create = vi.fn();
vi.mock("../anthropic.js", () => ({ anthropic: { messages: { create: (...a) => create(...a) } } }));

const reply = (text) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });

const { default: askClaude } = await import("../anthropic/askClaude.js");

describe("askClaude", () => {
  beforeEach(() => create.mockReset());

  it("retries once when the response isn't valid JSON", async () => {
    create.mockResolvedValueOnce(reply("{not json")).mockResolvedValueOnce(reply('{"ok":true}'));
    await expect(askClaude("x")).resolves.toEqual({ ok: true });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("gives up after the one retry", async () => {
    create.mockResolvedValue(reply("{not json"));
    await expect(askClaude("x")).rejects.toThrow("invalid JSON");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("does not retry a refusal", async () => {
    create.mockResolvedValue({ stop_reason: "refusal", content: [] });
    await expect(askClaude("x")).rejects.toThrow("declined");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("sends the requested effort", async () => {
    create.mockResolvedValue(reply("{}"));
    await askClaude("x", { effort: "medium" });
    expect(create.mock.calls[0][0].output_config).toEqual({ effort: "medium" });
  });
});

// --- validateCandidate: years fallback ---

const { default: validateCandidate } = await import("../validators/validateCandidate.js");

describe("validateCandidate years_experience", () => {
  it("derives years from dated positions when extraction returned 0", () => {
    const c = validateCandidate({
      years_experience: 0,
      positions: [
        { start_year: 2015, end_year: 2019 },
        { start_year: 2018, end_year: 2020 }, // overlaps - counted once
        { start_year: 2021, end_year: 2023 },
      ],
    });
    expect(c.years_experience).toBe(7);
  });

  it("keeps an explicit value", () => {
    expect(validateCandidate({ years_experience: 4, positions: [] }).years_experience).toBe(4);
  });
});
