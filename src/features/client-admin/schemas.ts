import { z } from "zod";

// Admin (staff) forms for the client portal. Server Actions re-validate everything.

const emptyToUndefined = (v: unknown) => (v === "" || v == null ? undefined : v);
const optionalDate = z.preprocess(emptyToUndefined, z.iso.date().optional());
const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());
const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const createClientSchema = z.object({
  name: z.string().trim().min(1, "Enter a client name").max(120),
});

export const inviteClientUserSchema = z.object({
  clientId: z.uuid(),
  email: z.email("Enter a valid email address").max(320),
  displayName: z.string().trim().min(1, "Enter their name").max(120),
});

export const removeClientUserSchema = z.object({ userId: z.uuid() });

export const createProjectSchema = z.object({
  clientId: z.uuid(),
  name: z.string().trim().min(1, "Enter a project name").max(200),
  startOn: z.iso.date("Choose a start date"),
  launchOn: optionalDate,
});

export const PROJECT_STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;

export const updateProjectSchema = z.object({
  projectId: z.uuid(),
  status: z.enum(PROJECT_STATUSES),
  currentPhase: optionalText(120),
  nextSteps: optionalText(2000),
  launchOn: optionalDate,
});

export const addTaskSchema = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1, "Enter a step").max(200),
  phase: optionalText(120),
  dueOn: optionalDate,
});

export const TASK_STATUSES = ["todo", "in_progress", "in_review", "on_hold", "done"] as const;

// Moves allowed by the database (transition_task); cancelling needs a reason and stays
// out of this simple screen.
export const NEXT_TASK_STATUSES: Record<string, readonly (typeof TASK_STATUSES)[number][]> = {
  todo: ["in_progress", "on_hold"],
  in_progress: ["in_review", "todo", "on_hold"],
  in_review: ["done", "in_progress"],
  on_hold: ["todo", "in_progress"],
  done: [],
  cancelled: [],
};

export const moveTaskSchema = z.object({
  taskId: z.uuid(),
  version: z.coerce.number().int().positive(),
  status: z.enum(TASK_STATUSES),
});

export const createApprovalSchema = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1, "Say what needs approval").max(200),
  details: optionalText(2000),
});

export const withdrawApprovalSchema = z.object({
  approvalId: z.uuid(),
  version: z.coerce.number().int().positive(),
});

export const REQUEST_STATUSES = ["open", "in_progress", "done", "declined"] as const;

export const updateRequestSchema = z.object({
  requestId: z.uuid(),
  status: z.enum(REQUEST_STATUSES),
  reply: optionalText(5000),
});

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const prepareUploadSchema = z.object({
  clientId: z.uuid(),
  fileName: z.string().trim().min(1).max(255),
});

export const recordUploadSchema = z.object({
  clientId: z.uuid(),
  projectId: optionalUuid,
  title: z.string().trim().min(1, "Give the file a title").max(200),
  path: z.string().min(1).max(1024),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().max(200).optional(),
  size: z.number().int().min(0).max(MAX_FILE_BYTES),
});

export const deleteFileSchema = z.object({ fileId: z.uuid() });

// Storage object names: keep letters, digits, dot, dash and underscore.
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/-+/g, "-")
    .slice(-120);
  return cleaned || "file";
}

export const STAFF_TASK_STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  on_hold: "On hold",
  done: "Done",
  cancelled: "Cancelled",
};
