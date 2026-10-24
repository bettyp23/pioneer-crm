// Role → permission matrix. Single source of truth in TypeScript (docs/security.md §3).
// The database enforces the same rules independently through RLS.
// Pure module (no server-only) so it can be unit-tested.

export const ROLES = ["owner", "admin", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

const PERMISSIONS = {
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
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};
