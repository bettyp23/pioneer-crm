import { describe, expect, it } from "vitest";

import {
  addDays,
  dateInZone,
  formatIsoDate,
  isIsoDate,
  localDateTimeInZone,
  zonedLocalToUtc,
} from "./dates";

const NY = "America/New_York";

describe("dateInZone", () => {
  it("uses the workspace timezone, not UTC", () => {
    // 2026-10-21 02:30 UTC is still Oct 20 in New York (EDT, UTC-4).
    expect(dateInZone(new Date("2026-10-21T02:30:00Z"), NY)).toBe("2026-10-20");
    expect(dateInZone(new Date("2026-10-21T04:30:00Z"), NY)).toBe("2026-10-21");
  });
});

describe("zonedLocalToUtc", () => {
  it("converts New York wall time in summer (EDT) and winter (EST)", () => {
    expect(zonedLocalToUtc("2026-07-01T09:00", NY)?.toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedLocalToUtc("2026-12-01T09:00", NY)?.toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });

  it("round-trips with localDateTimeInZone", () => {
    const local = "2026-10-20T16:45";
    expect(localDateTimeInZone(zonedLocalToUtc(local, NY)!, NY)).toBe(local);
  });

  it("handles the spring-forward gap and fall-back overlap", () => {
    // 2026-03-08 02:30 does not exist in New York; it resolves to 03:30 EDT (07:30Z).
    expect(zonedLocalToUtc("2026-03-08T02:30", NY)?.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    // 2026-11-01 01:30 happens twice; we take the first (EDT, 05:30Z).
    expect(zonedLocalToUtc("2026-11-01T01:30", NY)?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("works for UTC and rejects malformed input", () => {
    expect(zonedLocalToUtc("2026-10-20T08:00", "UTC")?.toISOString()).toBe(
      "2026-10-20T08:00:00.000Z",
    );
    expect(zonedLocalToUtc("2026-10-20 08:00", NY)).toBeNull();
    expect(zonedLocalToUtc("yesterday", NY)).toBeNull();
  });
});

describe("date-only helpers", () => {
  it("validates real calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-1")).toBe(false);
  });

  it("formats without timezone shifts and adds days across months", () => {
    expect(formatIsoDate("2026-10-20")).toBe("Oct 20, 2026");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
