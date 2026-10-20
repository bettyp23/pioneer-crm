import { z } from "zod";

import { optionalText, optionalUuid, requiredText } from "@/lib/zod-helpers";

export const ACTIVITY_TYPES = ["note", "call", "email", "meeting"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
};

export const activityFormSchema = z.object({
  client_id: z.uuid(),
  lead_id: optionalUuid,
  contact_id: optionalUuid,
  type: z.enum(ACTIVITY_TYPES),
  subject: requiredText("a subject", 200),
  body: optionalText(20000),
  // Wall-clock time in the workspace timezone (datetime-local input).
  occurred_at_local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time"),
});
export type ActivityFormInput = z.input<typeof activityFormSchema>;
