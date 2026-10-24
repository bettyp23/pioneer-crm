import { describe, expect, it } from "vitest";

import {
  inputTemplateFormSchema,
  taskTemplateFormSchema,
  toTemplateKey,
} from "@/features/blueprints/schemas";
import { serviceFormSchema } from "@/features/catalog/schemas";

const UUID = "6f1c2e3a-1b2c-4d5e-8f90-123456789abc";

describe("toTemplateKey", () => {
  it.each([
    ["Kick-off Call!", "kick_off_call"],
    ["  Sitemap & Wireframes ", "sitemap_wireframes"],
    ["Café launch", "cafe_launch"],
    ["", ""],
  ])("%j → %j", (title, key) => {
    expect(toTemplateKey(title)).toBe(key);
  });
});

describe("taskTemplateFormSchema", () => {
  const task = {
    version_id: UUID,
    key: "build",
    title: "Build",
    description: "",
    phase: "",
    position: "2",
    estimated_hours: "",
    due_offset_days: "",
    approval: "none",
    depends_on: [],
  };

  it("maps the approval choice onto the two database columns", () => {
    expect(taskTemplateFormSchema.parse(task)).toMatchObject({
      requires_approval: false,
      approval_approver: null,
      position: 2,
      estimated_hours: null,
      due_offset_days: null,
    });
    expect(taskTemplateFormSchema.parse({ ...task, approval: "client" })).toMatchObject({
      requires_approval: true,
      approval_approver: "client",
    });
  });

  it("validates key, hours and due offset", () => {
    expect(taskTemplateFormSchema.safeParse({ ...task, key: "Build Now" }).success).toBe(false);
    expect(taskTemplateFormSchema.safeParse({ ...task, estimated_hours: "1.234" }).success).toBe(
      false,
    );
    expect(taskTemplateFormSchema.safeParse({ ...task, estimated_hours: "7.5" }).success).toBe(
      true,
    );
    expect(taskTemplateFormSchema.safeParse({ ...task, due_offset_days: "-1" }).success).toBe(
      false,
    );
    expect(taskTemplateFormSchema.safeParse({ ...task, due_offset_days: "731" }).success).toBe(
      false,
    );
    expect(taskTemplateFormSchema.safeParse({ ...task, depends_on: ["nope"] }).success).toBe(false);
  });
});

describe("inputTemplateFormSchema and serviceFormSchema", () => {
  it("accepts access confirmations and normalizes empty blockers", () => {
    const parsed = inputTemplateFormSchema.parse({
      version_id: UUID,
      key: "hosting_access",
      label: "Hosting access",
      description: "",
      input_kind: "access_confirmation",
      required: true,
      blocks_task_template_id: "",
    });
    expect(parsed.blocks_task_template_id).toBeNull();
  });

  it("lower-cases service codes and rejects invalid ones", () => {
    const base = { name: "Build", category: "", description: "", list_price: "", is_active: true };
    expect(serviceFormSchema.parse({ ...base, code: "Website-Build" }).code).toBe("website-build");
    expect(serviceFormSchema.safeParse({ ...base, code: "a" }).success).toBe(false);
    expect(serviceFormSchema.safeParse({ ...base, code: "has space" }).success).toBe(false);
  });
});
