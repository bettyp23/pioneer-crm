import { z } from "zod";

// Shared by the portal forms and Server Actions. Server Actions re-validate everything.

const optionalUuid = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.uuid().optional(),
);

export const respondToApprovalSchema = z.object({
  approvalId: z.uuid(),
  decision: z.enum(["approved", "rejected"], { message: "Choose yes or no" }),
  comment: z.string().trim().max(2000, "Keep the comment under 2,000 characters").optional(),
});

export const submitRequestSchema = z.object({
  kind: z.enum(["change", "question"], { message: "Choose a change request or a question" }),
  projectId: optionalUuid,
  subject: z
    .string()
    .trim()
    .min(1, "Add a short title")
    .max(200, "Keep the title under 200 characters"),
  body: z.string().trim().min(1, "Tell us a bit more").max(5000, "Keep it under 5,000 characters"),
});

// Plain-language labels shown to clients.
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "In progress",
  on_hold: "Paused",
  completed: "Finished",
  cancelled: "Stopped",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "Not started",
  in_progress: "In progress",
  in_review: "Being checked",
  on_hold: "Paused",
  done: "Done",
  cancelled: "Dropped",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "Received",
  in_progress: "Working on it",
  done: "Done",
  declined: "Not going ahead",
};

export const REQUEST_KIND_LABELS: Record<string, string> = {
  change: "Change request",
  question: "Question",
};

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for you",
  approved: "You said yes",
  rejected: "You said no",
  withdrawn: "No longer needed",
};
