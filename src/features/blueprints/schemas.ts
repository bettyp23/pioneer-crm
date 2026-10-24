import { z } from "zod";

import { optionalText, optionalUuid, requiredText } from "@/lib/zod-helpers";

export const INPUT_KINDS = ["file", "text", "access_confirmation", "decision"] as const;
export type InputKind = (typeof INPUT_KINDS)[number];
export const INPUT_KIND_LABELS: Record<InputKind, string> = {
  file: "File (Drive link)",
  text: "Text answer",
  access_confirmation: "Access confirmation",
  decision: "Decision",
};

export const blueprintFormSchema = z.object({
  name: requiredText("a blueprint name", 200),
  description: optionalText(5000),
  service_id: optionalUuid,
});
export type BlueprintFormInput = z.input<typeof blueprintFormSchema>;

const templateKey = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{1,60}$/, "Use lowercase letters, numbers and underscores (e.g. kickoff_call)");

const optionalInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && +v >= min && +v <= max), message)
    .transform((v) => (v === "" ? null : Number(v)));

export const taskTemplateFormSchema = z
  .object({
    version_id: z.uuid(),
    key: templateKey,
    title: requiredText("a task title", 200),
    description: optionalText(5000),
    phase: optionalText(80),
    position: z.coerce.number().int().min(1).max(10_000),
    estimated_hours: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && +v <= 1000),
        "Hours between 0 and 1000 (up to 2 decimals)",
      )
      .transform((v) => (v === "" ? null : Number(v))),
    due_offset_days: optionalInt(0, 730, "Days after project start, 0–730"),
    approval: z.enum(["none", "internal", "client"]),
    depends_on: z.array(z.uuid()).max(200),
  })
  .transform(({ approval, ...rest }) => ({
    ...rest,
    requires_approval: approval !== "none",
    approval_approver: approval === "none" ? null : approval,
  }));
export type TaskTemplateFormInput = z.input<typeof taskTemplateFormSchema>;

export const inputTemplateFormSchema = z.object({
  version_id: z.uuid(),
  key: templateKey,
  label: requiredText("a label", 200),
  description: optionalText(5000),
  input_kind: z.enum(INPUT_KINDS),
  required: z.boolean(),
  blocks_task_template_id: optionalUuid,
});
export type InputTemplateFormInput = z.input<typeof inputTemplateFormSchema>;

export const publishSchema = z.object({
  version_id: z.uuid(),
  change_summary: optionalText(2000),
});

// "Kick-off Call!" → "kick_off_call"
export function toTemplateKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
