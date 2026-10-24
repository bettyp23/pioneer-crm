import { describe, expect, it } from "vitest";

import { activityFormSchema } from "@/features/activities/schemas";
import { clientFormSchema, clientListParamsSchema } from "@/features/clients/schemas";
import { contactFormSchema } from "@/features/contacts/schemas";
import { followUpBucket, followUpFormSchema } from "@/features/follow-ups/schemas";
import { leadFormSchema, moveLeadSchema } from "@/features/leads/schemas";

const UUID = "6f1c2e3a-1b2c-4d5e-8f90-123456789abc";

const client = {
  name: "Synthetic Co",
  legal_name: "",
  kind: "organization",
  status: "prospect",
  industry: "",
  website_url: "",
  drive_folder_url: "",
  notes: "",
};

describe("clientFormSchema", () => {
  it("turns empty optional fields into null", () => {
    const parsed = clientFormSchema.parse(client);
    expect(parsed.legal_name).toBeNull();
    expect(parsed.drive_folder_url).toBeNull();
  });

  it("only accepts https websites and Google Drive/Docs folder links", () => {
    expect(clientFormSchema.safeParse({ ...client, website_url: "http://x.example" }).success).toBe(
      false,
    );
    expect(
      clientFormSchema.safeParse({ ...client, website_url: "https://x.example" }).success,
    ).toBe(true);
    for (const url of ["https://evil.example/drive.google.com", "http://drive.google.com/x"]) {
      expect(clientFormSchema.safeParse({ ...client, drive_folder_url: url }).success).toBe(false);
    }
    for (const url of [
      "https://drive.google.com/drive/folders/abc",
      "https://docs.google.com/document/d/x",
    ]) {
      expect(clientFormSchema.safeParse({ ...client, drive_folder_url: url }).success).toBe(true);
    }
  });

  it("rejects unknown statuses and blank names", () => {
    expect(clientFormSchema.safeParse({ ...client, status: "vip" }).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...client, name: "  " }).success).toBe(false);
  });

  it("re-parses its own raw input on the server (no transformed values needed)", () => {
    // Forms send raw input; the server must accept exactly that shape.
    expect(clientFormSchema.safeParse(client).success).toBe(true);
  });
});

describe("clientListParamsSchema", () => {
  it("falls back safely on bad query params", () => {
    expect(clientListParamsSchema.parse({ status: "nope", page: "-1", archived: "yes" })).toEqual({
      q: "",
      status: undefined,
      archived: false,
      page: 1,
    });
  });
});

describe("contactFormSchema", () => {
  it("lower-cases email and allows it to be empty", () => {
    const base = {
      first_name: "Ada",
      last_name: "",
      phone: "",
      job_title: "",
      is_primary: false,
      notes: "",
    };
    expect(contactFormSchema.parse({ ...base, email: "Ada@Example.TEST" }).email).toBe(
      "ada@example.test",
    );
    expect(contactFormSchema.parse({ ...base, email: "" }).email).toBeNull();
    expect(contactFormSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
  });
});

describe("leadFormSchema", () => {
  const lead = {
    title: "Rebuild",
    primary_contact_id: "",
    source: "",
    stage_id: UUID,
    estimated_value: "12,500.50",
    expected_close_on: "",
    owner_user_id: "",
  };

  it("converts the estimate to minor units and blanks to null", () => {
    const parsed = leadFormSchema.parse(lead);
    expect(parsed.estimated_value).toBe(1_250_050);
    expect(parsed.primary_contact_id).toBeNull();
    expect(parsed.expected_close_on).toBeNull();
  });

  it("rejects malformed amounts, dates and ids", () => {
    expect(leadFormSchema.safeParse({ ...lead, estimated_value: "12.345" }).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...lead, expected_close_on: "2026-02-30" }).success).toBe(
      false,
    );
    expect(leadFormSchema.safeParse({ ...lead, owner_user_id: "x" }).success).toBe(false);
  });

  it("move: lost reason is optional at the schema level (the database enforces it)", () => {
    expect(
      moveLeadSchema.parse({ lead_id: UUID, stage_id: UUID, lost_reason: "" }).lost_reason,
    ).toBeNull();
  });
});

describe("activity and follow-up schemas", () => {
  it("requires a wall-clock time for activities", () => {
    const activity = {
      client_id: UUID,
      lead_id: "",
      contact_id: "",
      type: "call",
      subject: "Intro",
      body: "",
      occurred_at_local: "2026-10-20T09:30",
    };
    expect(activityFormSchema.safeParse(activity).success).toBe(true);
    expect(activityFormSchema.safeParse({ ...activity, occurred_at_local: "now" }).success).toBe(
      false,
    );
    expect(activityFormSchema.safeParse({ ...activity, type: "sms" }).success).toBe(false);
  });

  it("requires a real due date for follow-ups", () => {
    const fu = {
      client_id: UUID,
      lead_id: "",
      contact_id: "",
      title: "Call",
      due_on: "2026-10-20",
      assignee_user_id: "",
    };
    expect(followUpFormSchema.safeParse(fu).success).toBe(true);
    expect(followUpFormSchema.safeParse({ ...fu, due_on: "" }).success).toBe(false);
  });

  it("buckets follow-ups relative to today", () => {
    expect(followUpBucket("2026-10-19", "2026-10-20")).toBe("overdue");
    expect(followUpBucket("2026-10-20", "2026-10-20")).toBe("today");
    expect(followUpBucket("2026-11-01", "2026-10-20")).toBe("upcoming");
  });
});
