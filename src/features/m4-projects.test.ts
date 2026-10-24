import { describe, expect, it } from "vitest";

import { decideApprovalSchema, generateProjectSchema } from "@/features/projects/schemas";
import { allowedTransitions, canTransition, TASK_STATUSES } from "@/features/projects/transitions";

const UUID = "6f1c2e3a-1b2c-4d5e-8f90-123456789abc";

describe("task transition graph (mirrors private.transition_task)", () => {
  it.each([
    ["todo", "in_progress", true],
    ["todo", "done", false],
    ["in_progress", "in_review", true],
    ["in_review", "done", true],
    ["in_review", "in_progress", true],
    ["on_hold", "in_progress", true],
    ["done", "todo", false],
    ["cancelled", "todo", false],
  ] as const)("%s → %s is %s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });

  it("done and cancelled are terminal; every open status can be cancelled", () => {
    expect(allowedTransitions("done")).toEqual([]);
    expect(allowedTransitions("cancelled")).toEqual([]);
    for (const s of TASK_STATUSES.filter((s) => s !== "done" && s !== "cancelled")) {
      expect(canTransition(s, "cancelled")).toBe(true);
    }
  });
});

describe("generateProjectSchema (D-6)", () => {
  const base = {
    idempotency_key: UUID,
    client_id: UUID,
    blueprint_version_id: UUID,
    name: "Project",
    start_on: "2026-11-02",
    sow_id: "",
    pilot: false,
    no_sow_reason: "",
    lead_id: "",
  };

  it("requires a signed SOW unless it is a pilot with a reason", () => {
    expect(generateProjectSchema.safeParse(base).success).toBe(false);
    expect(generateProjectSchema.safeParse({ ...base, sow_id: UUID }).success).toBe(true);
    expect(generateProjectSchema.safeParse({ ...base, pilot: true }).success).toBe(false);
    expect(
      generateProjectSchema.safeParse({ ...base, pilot: true, no_sow_reason: "Pilot" }).success,
    ).toBe(true);
  });

  it("rejects a missing idempotency key", () => {
    expect(
      generateProjectSchema.safeParse({ ...base, sow_id: UUID, idempotency_key: "" }).success,
    ).toBe(false);
  });
});

describe("decideApprovalSchema", () => {
  it("requires https evidence links", () => {
    const base = {
      approval_id: UUID,
      decision: "approved",
      expected_version: 1,
      note: "",
      client_contact_id: "",
    };
    expect(
      decideApprovalSchema.safeParse({ ...base, evidence_url: "http://x.example" }).success,
    ).toBe(false);
    expect(
      decideApprovalSchema.safeParse({ ...base, evidence_url: "https://drive.google.com/x" })
        .success,
    ).toBe(true);
    expect(decideApprovalSchema.safeParse({ ...base, evidence_url: "" }).success).toBe(true);
  });
});
