// Task state graph (FR-TASK-1). Mirrors private.transition_task(); the database is the
// authority — this copy only decides which buttons to show.

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "in_review",
  "on_hold",
  "done",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  on_hold: "On hold",
  done: "Done",
  cancelled: "Cancelled",
};

const GRAPH: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["in_review", "todo", "on_hold", "cancelled"],
  in_review: ["done", "in_progress", "cancelled"],
  on_hold: ["todo", "in_progress", "cancelled"],
  done: [],
  cancelled: [],
};

export function allowedTransitions(from: TaskStatus): TaskStatus[] {
  return GRAPH[from];
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return GRAPH[from].includes(to);
}

// Button label for moving into a status.
export const TRANSITION_LABELS: Record<TaskStatus, string> = {
  todo: "Back to to-do",
  in_progress: "Start",
  in_review: "Send to review",
  on_hold: "Put on hold",
  done: "Mark done",
  cancelled: "Cancel task",
};

export const INPUT_STATUS_LABELS = {
  requested: "Requested",
  received: "Received",
  accepted: "Accepted",
  rejected: "Rejected",
  waived: "Waived",
} as const;

export const APPROVAL_STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} as const;

export const SOW_STATUS_LABELS = {
  draft: "Draft",
  sent: "Sent",
  signed: "Signed",
  superseded: "Superseded",
  void: "Void",
} as const;

export const PROJECT_STATUS_LABELS = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
} as const;
