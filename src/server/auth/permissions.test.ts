import { describe, expect, it } from "vitest";

import { can, isRole, ROLES, type Permission, type Role } from "./permissions";

// Mirrors the role matrix in docs/security.md §3. A change here must be a deliberate,
// reviewed change to that table (and to the matching RLS policies).
const EXPECTED: Record<Permission, Role[]> = {
  "records.read": ["owner", "admin", "member", "viewer"],
  "records.write": ["owner", "admin", "member"],
  "blueprints.publish": ["owner", "admin"],
  "projects.generate": ["owner", "admin"],
  "approvals.decide_internal": ["owner", "admin"],
  "sow.record_signed": ["owner"],
  "workspace.manage": ["owner"],
  "members.manage": ["owner"],
  "audit.read": ["owner", "admin"],
  "records.hard_delete": ["owner"],
  "agents.dispatch": ["owner", "admin"],
};

describe("permission matrix", () => {
  for (const [permission, allowed] of Object.entries(EXPECTED) as [Permission, Role[]][]) {
    for (const role of ROLES) {
      const expected = allowed.includes(role);
      it(`${role} ${expected ? "can" : "cannot"} ${permission}`, () => {
        expect(can(role, permission)).toBe(expected);
      });
    }
  }

  it("viewer is read-only", () => {
    const writable = (Object.keys(EXPECTED) as Permission[]).filter(
      (p) => p !== "records.read" && can("viewer", p),
    );
    expect(writable).toEqual([]);
  });

  it("owner has every permission", () => {
    for (const p of Object.keys(EXPECTED) as Permission[]) expect(can("owner", p)).toBe(true);
  });
});

describe("isRole", () => {
  it("accepts known roles only", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
