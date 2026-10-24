import { z } from "zod";

import {
  optionalIsoDate,
  optionalMoney,
  optionalText,
  optionalUuid,
  requiredText,
} from "@/lib/zod-helpers";

export const leadFormSchema = z.object({
  title: requiredText("a title", 200),
  primary_contact_id: optionalUuid,
  source: optionalText(120),
  stage_id: z.uuid("Choose a stage"),
  estimated_value: optionalMoney,
  expected_close_on: optionalIsoDate,
  owner_user_id: optionalUuid,
});
export type LeadFormInput = z.input<typeof leadFormSchema>;

export const moveLeadSchema = z.object({
  lead_id: z.uuid(),
  stage_id: z.uuid(),
  lost_reason: optionalText(1000),
});
export type MoveLeadInput = z.input<typeof moveLeadSchema>;

export const stageNameSchema = requiredText("a stage name", 60);

export const pipelineViewSchema = z.enum(["board", "list"]).catch("board");
