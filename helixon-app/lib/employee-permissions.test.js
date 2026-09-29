import { describe, expect, it } from "vitest";
import { can, cleanOverrides, effectivePermissions, overridesAfterRoleChange, overridesFor, rolePreset, SECTION_KEYS } from "./employee-permissions";

describe("role presets", () => {
  it("gives the default employee role full access, like before permissions existed", () => {
    for (const key of SECTION_KEYS) expect(can({ role: "employee" }, key, "edit")).toBe(true);
  });

  it("makes viewers read-only apart from their own tasks", () => {
    const viewer = { role: "viewer" };
    expect(can(viewer, "calendar", "view")).toBe(true);
    expect(can(viewer, "calendar", "edit")).toBe(false);
    expect(can(viewer, "tasks", "edit")).toBe(true);
  });

  it("treats unknown roles as read-only", () => {
    expect(rolePreset("mystery").files).toBe("view");
  });
});

describe("overrides", () => {
  it("apply on top of the role", () => {
    const e = { role: "employee", permissions: { cold_calls: "none", files: "view" } };
    expect(effectivePermissions(e).cold_calls).toBe("none");
    expect(can(e, "cold_calls", "view")).toBe(false);
    expect(can(e, "files", "view")).toBe(true);
    expect(can(e, "files", "edit")).toBe(false);
    expect(can(e, "goals", "edit")).toBe(true);
  });

  it("drops unknown sections and levels", () => {
    expect(cleanOverrides({ files: "edit", admin: "edit", goals: "owner" })).toEqual({ files: "edit" });
    expect(cleanOverrides("nope")).toBe(null);
    expect(cleanOverrides({})).toBe(null);
  });

  it("stores only what differs from the role", () => {
    const desired = { ...rolePreset("employee"), cold_calls: "none" };
    expect(overridesFor("employee", desired)).toEqual({ cold_calls: "none" });
    expect(overridesFor("employee", rolePreset("employee"))).toBe(null);
  });

  it("keep only customised sections through a role change", () => {
    // An employee with cold calls hidden becomes a viewer: still hidden,
    // and everything else is now read-only.
    const after = overridesAfterRoleChange({ cold_calls: "none" }, "viewer");
    expect(after).toEqual({ cold_calls: "none" });
    const e = { role: "viewer", permissions: after };
    expect(can(e, "calendar", "edit")).toBe(false);
    expect(can(e, "cold_calls", "view")).toBe(false);
    // A custom level equal to the new role's default isn't kept.
    expect(overridesAfterRoleChange({ cold_calls: "view" }, "support")).toBe(null);
    expect(overridesAfterRoleChange(null, "viewer")).toBe(null);
  });
});
