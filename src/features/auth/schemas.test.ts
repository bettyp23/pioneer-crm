import { describe, expect, it } from "vitest";

import { signInSchema, totpCodeSchema, verifyEnrollmentSchema } from "./schemas";

describe("signInSchema", () => {
  it("accepts an email and password", () => {
    expect(signInSchema.safeParse({ email: "a@example.test", password: "x" }).success).toBe(true);
  });
  it("rejects invalid email, empty password and oversized input", () => {
    expect(signInSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@example.test", password: "" }).success).toBe(false);
    expect(
      signInSchema.safeParse({ email: "a@example.test", password: "x".repeat(1025) }).success,
    ).toBe(false);
  });
  it("rejects non-object input (Server Actions receive unknown)", () => {
    expect(signInSchema.safeParse("a@example.test").success).toBe(false);
    expect(signInSchema.safeParse(null).success).toBe(false);
  });
});

describe("totpCodeSchema", () => {
  it.each(["123456", "000000"])("accepts %s", (code) => {
    expect(totpCodeSchema.safeParse({ code }).success).toBe(true);
  });
  it.each(["12345", "1234567", "12345a", " 123456", ""])("rejects %j", (code) => {
    expect(totpCodeSchema.safeParse({ code }).success).toBe(false);
  });
});

describe("verifyEnrollmentSchema", () => {
  it("requires a UUID factor id", () => {
    expect(
      verifyEnrollmentSchema.safeParse({ code: "123456", factorId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      verifyEnrollmentSchema.safeParse({
        code: "123456",
        factorId: "6f1c2e3a-1b2c-4d5e-8f90-123456789abc",
      }).success,
    ).toBe(true);
  });
});
