import { describe, expect, it } from "vitest";

import { formatMoney, minorToInput, parseMoneyToMinor } from "./money";

describe("parseMoneyToMinor", () => {
  it.each([
    ["12500", 1_250_000],
    ["12,500.50", 1_250_050],
    ["$12500.5", 1_250_050],
    ["0", 0],
    ["0.07", 7],
    ["  42 ", 4200],
  ])("parses %j", (input, expected) => {
    expect(parseMoneyToMinor(input)).toBe(expected);
  });

  it("treats empty input as no value", () => {
    expect(parseMoneyToMinor("")).toBeNull();
    expect(parseMoneyToMinor("   ")).toBeNull();
  });

  it.each(["-5", "1.234", "abc", "1e6", "12.", ".5", "99999999999999"])("rejects %j", (input) => {
    expect(parseMoneyToMinor(input)).toBeUndefined();
  });
});

describe("formatting", () => {
  it("formats whole and fractional amounts", () => {
    expect(formatMoney(1_250_000)).toBe("$12,500");
    expect(formatMoney(1_250_050)).toBe("$12,500.50");
    expect(formatMoney(null)).toBe("—");
  });

  it("round-trips through the input format", () => {
    expect(minorToInput(1_250_050)).toBe("12500.50");
    expect(minorToInput(1_250_000)).toBe("12500");
    expect(minorToInput(null)).toBe("");
    expect(parseMoneyToMinor(minorToInput(1_250_050))).toBe(1_250_050);
  });
});
