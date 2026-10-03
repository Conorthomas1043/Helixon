import { describe, expect, it } from "vitest";
import { CANDIDATE_COLUMNS, defaultColumns, parseColumns } from "./list-columns";

describe("list columns", () => {
  it("defaults to the columns marked default", () => {
    expect(defaultColumns(CANDIDATE_COLUMNS)).toEqual(["skills", "recruiter", "stage", "nextAction", "score"]);
  });

  it("keeps a saved choice, dropping unknown and duplicate keys", () => {
    expect(parseColumns(JSON.stringify(["stage", "source", "gone", "stage", 4]), CANDIDATE_COLUMNS)).toEqual(["stage", "source"]);
  });

  it("falls back to the defaults for nothing, junk or an empty choice", () => {
    const d = defaultColumns(CANDIDATE_COLUMNS);
    expect(parseColumns(null, CANDIDATE_COLUMNS)).toEqual(d);
    expect(parseColumns("{not json", CANDIDATE_COLUMNS)).toEqual(d);
    expect(parseColumns('{"a":1}', CANDIDATE_COLUMNS)).toEqual(d);
    expect(parseColumns("[]", CANDIDATE_COLUMNS)).toEqual(d);
  });
});
