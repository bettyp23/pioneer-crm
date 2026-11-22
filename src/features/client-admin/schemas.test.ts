import { describe, expect, it } from "vitest";

import { NEXT_TASK_STATUSES, safeFileName, updateProjectSchema } from "./schemas";

describe("safeFileName", () => {
  it("keeps ordinary names", () => {
    expect(safeFileName("brand-guide_v2.pdf")).toBe("brand-guide_v2.pdf");
  });
  it("removes path separators and traversal", () => {
    expect(safeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFileName("a/b\\c.txt")).toBe("a-b-c.txt");
  });
  it("replaces spaces and unusual characters", () => {
    expect(safeFileName("Home page (final).png")).toBe("Home-page-final-.png");
  });
  it("never returns an empty name", () => {
    expect(safeFileName("///")).toBe("file");
  });
});

describe("updateProjectSchema", () => {
  it("treats empty optional fields as unset", () => {
    const parsed = updateProjectSchema.parse({
      projectId: "3f0c8a6e-4b7a-4c1e-9b6a-2d3c4e5f6a7b",
      status: "active",
      currentPhase: "",
      nextSteps: "",
      launchOn: "",
    });
    expect(parsed.currentPhase).toBeUndefined();
    expect(parsed.launchOn).toBeUndefined();
  });
});

describe("NEXT_TASK_STATUSES", () => {
  it("never offers a finished step a new status", () => {
    expect(NEXT_TASK_STATUSES.done).toEqual([]);
    expect(NEXT_TASK_STATUSES.cancelled).toEqual([]);
  });
});
