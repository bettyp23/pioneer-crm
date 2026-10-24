import { describe, expect, it } from "vitest";

import { scanForSensitiveContent } from "./sensitivity";

const kinds = (text: string) => scanForSensitiveContent(text).map((f) => f.kind);

describe("scanForSensitiveContent", () => {
  it("passes plain business information", () => {
    expect(
      kinds("Northwind Example Bakery, a bakery in Ohio. Wants online ordering. Budget discussed."),
    ).toEqual([]);
  });

  it("flags emails and phone numbers, masked", () => {
    const flags = scanForSensitiveContent("Call Ada at (614) 555-0142 or ada@example.test");
    expect(flags.map((f) => f.kind).sort()).toEqual(["email", "phone"]);
    expect(flags.find((f) => f.kind === "email")?.sample).toBe("ada@…st");
    expect(JSON.stringify(flags)).not.toContain("ada@example.test");
  });

  it("flags secrets and links carrying tokens", () => {
    expect(kinds("key: sk-ant-api03-abcdefghijklmnop")).toContain("secret_key");
    expect(kinds("xai-AbCdEfGhIjKlMnOpQrSt")).toContain("secret_key");
    expect(kinds("https://example.test/reset?token=abc123")).toContain("token_url");
    expect(kinds("-----BEGIN RSA PRIVATE KEY-----")).toContain("secret_key");
  });

  it("flags only card numbers that pass the Luhn check", () => {
    expect(kinds("4111 1111 1111 1111")).toContain("card_number");
    expect(kinds("order 1234 5678 9012 3456")).not.toContain("card_number");
  });

  it("flags SSN-like numbers and health terms", () => {
    expect(kinds("SSN 123-45-6789")).toContain("ssn");
    expect(kinds("Patient intake automation")).toContain("health_term");
    expect(kinds("Their date of birth is on file")).toContain("health_term");
    expect(kinds("We improve the website diagnosis page")).toContain("health_term");
  });

  it("reports each distinct match once", () => {
    expect(kinds("a@b.test a@b.test A@B.TEST")).toEqual(["email"]);
  });
});
