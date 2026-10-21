import { z } from "zod";

import {
  isoDate,
  optionalDriveUrl,
  optionalText,
  optionalUuid,
  requiredText,
} from "@/lib/zod-helpers";

import { TASK_STATUSES } from "./transitions";

export const sowFormSchema = z.object({
  client_id: z.uuid(),
  title: requiredText("a title", 200),
  version_label: optionalText(40),
  drive_url: optionalDriveUrl,
  status: z.enum(["draft", "sent"]),
  scope_summary: optionalText(10000),
  supersedes_id: optionalUuid,
});
export type SowFormInput = z.input<typeof sowFormSchema>;

export const signSowSchema = z.object({
  id: z.uuid(),
  signed_on: isoDate,
  client_signatory: requiredText("who signed", 200),
});

export const sowStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["sent", "superseded", "void"]),
});

export const generateProjectSchema = z
  .object({
    idempotency_key: z.uuid(),
    client_id: z.uuid("Choose a client"),
    blueprint_version_id: z.uuid("Choose a published blueprint version"),
    name: requiredText("a project name", 200),
    start_on: isoDate,
    sow_id: optionalUuid,
    pilot: z.boolean(),
    no_sow_reason: optionalText(1000),
    lead_id: optionalUuid,
  })
  .superRefine((v, ctx) => {
    if (v.pilot && !v.no_sow_reason) {
      ctx.addIssue({
        code: "custom",
        path: ["no_sow_reason"],
        message: "Explain why this project runs without a signed SOW",
      });
    }
    if (!v.pilot && !v.sow_id) {
      ctx.addIssue({ code: "custom", path: ["sow_id"], message: "Choose a signed SOW" });
    }
  });
export type GenerateProjectInput = z.input<typeof generateProjectSchema>;

export const transitionSchema = z.object({
  task_id: z.uuid(),
  to_status: z.enum(TASK_STATUSES),
  expected_version: z.number().int().min(1),
  reason: optionalText(1000),
  confirm_unblock: z.boolean(),
});

export const taskDetailsSchema = z.object({
  task_id: z.uuid(),
  assignee_user_id: optionalUuid,
  due_on: z
    .string()
    .refine((v) => v === "" || isoDate.safeParse(v).success, "Choose a valid date")
    .transform((v) => (v === "" ? null : v)),
});

export const inputStatusSchema = z.object({
  request_id: z.uuid(),
  to_status: z.enum(["received", "accepted", "rejected", "waived"]),
  expected_version: z.number().int().min(1),
  drive_url: optionalDriveUrl,
  response_text: optionalText(5000),
  waive_reason: optionalText(1000),
});

export const decideApprovalSchema = z.object({
  approval_id: z.uuid(),
  decision: z.enum(["approved", "rejected", "withdrawn"]),
  expected_version: z.number().int().min(1),
  note: optionalText(2000),
  evidence_url: optionalText(2000).refine(
    (v) => v === null || /^https:\/\/\S+$/.test(v),
    "Use a full https:// link (e.g. a Drive copy of the approval email)",
  ),
  client_contact_id: optionalUuid,
});

export const projectStatusSchema = z.object({
  project_id: z.uuid(),
  status: z.enum(["active", "on_hold", "completed", "cancelled"]),
});
