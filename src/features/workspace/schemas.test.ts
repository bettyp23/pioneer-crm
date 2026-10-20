import { describe, expect, it } from "vitest";

import { auditPageSchema, isValidTimeZone, updateWorkspaceSchema } from "./schemas";

describe("updateWorkspaceSchema", () => {
  it("trims the name and accepts IANA timezones", () => {
    const result = updateWorkspaceSchema.parse({ name: "  Demo  ", timezone: "America/New_York" });
    expect(result).toEqual({ name: "Demo", timezone: "America/New_York" });
  });
  it("rejects blank or long names", () => {
    expect(updateWorkspaceSchema.safeParse({ name: "   ", timezone: "UTC" }).success).toBe(false);
    expect(
      updateWorkspaceSchema.safeParse({ name: "x".repeat(121), timezone: "UTC" }).success,
    ).toBe(false);
  });
  it("rejects unknown timezones", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(
      updateWorkspaceSchema.safeParse({ name: "Demo", timezone: "Mars/Olympus" }).success,
    ).toBe(false);
  });
  it("ignores unexpected fields such as slug", () => {
    const result = updateWorkspaceSchema.parse({ name: "Demo", timezone: "UTC", slug: "x" });
    expect(result).not.toHaveProperty("slug");
  });
});

describe("auditPageSchema", () => {
  it.each([
    [undefined, 1],
    ["2", 2],
    ["0", 1],
    ["-5", 1],
    ["abc", 1],
    ["1.5", 1],
  ])("parses %j as page %i", (input, expected) => {
    expect(auditPageSchema.parse(input)).toBe(expected);
  });
});
