import { describe, expect, it } from "vitest";
import { anonymiseDeletedUser, FORMER_MEMBER } from "./anonymise-user";

// Records every update so the test can check what was cleared and where.
function fakeSupabase(profiles) {
  const updates = [];
  return {
    updates,
    from(table) {
      const q = { table, filters: [], patch: null };
      const builder = {
        select: () => builder,
        update: (patch) => ((q.patch = patch), updates.push(q), builder),
        eq: (col, val) => (q.filters.push([col, val]), builder),
        in: (col, val) => (q.filters.push([col, val]), builder),
        then: (resolve) => resolve(table === "profiles" && !q.patch ? { data: profiles } : table === "candidates" && !q.patch ? { data: [{ id: "c1" }] } : { data: null }),
      };
      return builder;
    },
  };
}

describe("anonymiseDeletedUser", () => {
  it("clears the profile and replaces their name in agency history", async () => {
    const sb = fakeSupabase([{ id: "abcdef12-3456", agency_id: "ag1", first_name: "Sam", last_name: "Rivera", username: "sam" }]);
    await anonymiseDeletedUser(sb, "user_9");

    const profile = sb.updates.find((u) => u.table === "profiles");
    expect(profile.patch).toMatchObject({ clerk_user_id: null, first_name: null, last_name: null, username: "deleted-abcdef12", last_seen_at: null });

    const notes = sb.updates.find((u) => u.table === "candidate_notes");
    expect(notes.patch).toEqual({ author_name: FORMER_MEMBER, author_id: null });
    expect(notes.filters).toContainEqual(["agency_id", "ag1"]);

    const activity = sb.updates.find((u) => u.table === "candidate_activity");
    expect(activity.patch).toEqual({ actor: FORMER_MEMBER });
    expect(activity.filters).toContainEqual(["actor", "Sam Rivera"]);
  });
});
