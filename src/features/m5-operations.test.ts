import { describe, expect, it } from "vitest";

import {
  describeCadence,
  effectiveInvoiceStatus,
  invoiceFormSchema,
  issueStatusSchema,
  routineFormSchema,
} from "@/features/operations/schemas";

const UUID = "6f1c2e3a-1b2c-4d5e-8f90-123456789abc";

describe("routines", () => {
  it("describes cadences in plain words", () => {
    expect(describeCadence("weekly", 1)).toBe("Every week");
    expect(describeCadence("monthly", 3)).toBe("Every 3 months");
  });

  it("validates interval and https runbooks", () => {
    const base = {
      name: "Backup check",
      description: "",
      client_id: "",
      cadence: "weekly",
      interval_count: "1",
      anchor_on: "2026-10-20",
      owner_user_id: "",
      runbook_url: "",
      is_active: true,
    };
    expect(routineFormSchema.safeParse(base).success).toBe(true);
    expect(routineFormSchema.safeParse({ ...base, interval_count: "0" }).success).toBe(false);
    expect(routineFormSchema.safeParse({ ...base, interval_count: "53" }).success).toBe(false);
    expect(routineFormSchema.safeParse({ ...base, runbook_url: "http://x.example" }).success).toBe(
      false,
    );
  });
});

describe("issues", () => {
  it("requires a resolution when closing", () => {
    expect(
      issueStatusSchema.safeParse({ issue_id: UUID, status: "resolved", resolution: "" }).success,
    ).toBe(false);
    expect(
      issueStatusSchema.safeParse({
        issue_id: UUID,
        status: "wont_fix",
        resolution: "Out of scope",
      }).success,
    ).toBe(true);
    expect(
      issueStatusSchema.safeParse({ issue_id: UUID, status: "triaged", resolution: "" }).success,
    ).toBe(true);
  });
});

describe("invoices (metadata only)", () => {
  const base = {
    client_id: UUID,
    project_id: "",
    external_system: "quickbooks",
    external_number: "INV-1",
    external_url: "",
    issued_on: "2026-10-01",
    due_on: "2026-10-31",
    amount: "1,234.56",
    status: "sent",
    paid_on: "",
    notes: "",
  };

  it("parses the amount to minor units", () => {
    expect(invoiceFormSchema.parse(base).amount).toBe(123_456);
  });

  it("requires an amount, a paid date when paid, and due ≥ issued", () => {
    expect(invoiceFormSchema.safeParse({ ...base, amount: "" }).success).toBe(false);
    expect(invoiceFormSchema.safeParse({ ...base, status: "paid" }).success).toBe(false);
    expect(
      invoiceFormSchema.safeParse({ ...base, status: "paid", paid_on: "2026-10-15" }).success,
    ).toBe(true);
    expect(invoiceFormSchema.safeParse({ ...base, due_on: "2026-09-30" }).success).toBe(false);
  });

  it("shows sent invoices past due as overdue", () => {
    expect(effectiveInvoiceStatus("sent", "2026-10-19", "2026-10-20")).toBe("overdue");
    expect(effectiveInvoiceStatus("sent", "2026-10-20", "2026-10-20")).toBe("sent");
    expect(effectiveInvoiceStatus("paid", "2026-01-01", "2026-10-20")).toBe("paid");
    expect(effectiveInvoiceStatus("sent", null, "2026-10-20")).toBe("sent");
  });
});
