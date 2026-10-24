import { z } from "zod";

import { isoDate, optionalUuid, requiredText } from "@/lib/zod-helpers";

export const followUpFormSchema = z.object({
  client_id: z.uuid(),
  lead_id: optionalUuid,
  contact_id: optionalUuid,
  title: requiredText("what needs to happen", 200),
  due_on: isoDate,
  assignee_user_id: optionalUuid,
});
export type FollowUpFormInput = z.input<typeof followUpFormSchema>;

export const followUpStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["open", "done", "cancelled"]),
});

export const followUpScopeSchema = z.enum(["mine", "all"]).catch("mine");

// Groups open follow-ups relative to "today" in the workspace timezone.
export function followUpBucket(dueOn: string, today: string): "overdue" | "today" | "upcoming" {
  if (dueOn < today) return "overdue";
  if (dueOn === today) return "today";
  return "upcoming";
}
