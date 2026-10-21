"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  requestApproval,
  transitionTask,
  updateTaskDetails,
} from "@/features/projects/server/actions";
import {
  allowedTransitions,
  TRANSITION_LABELS,
  type TaskStatus,
} from "@/features/projects/transitions";

// Status buttons for one task. The database decides; blocked moves come back as a clear
// message ("Blocked by: …"). Cancelling asks for a reason and, if it unblocks other tasks,
// a second confirmation listing them (D-7).
export function TaskActions({
  taskId,
  title,
  status,
  version,
  canStart,
  needsApproval,
  hasPendingApproval,
  canCancel,
}: {
  taskId: string;
  title: string;
  status: TaskStatus;
  version: number;
  canStart: boolean;
  needsApproval: boolean;
  hasPendingApproval: boolean;
  canCancel: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const targets = allowedTransitions(status).filter((t) => t !== "cancelled" || canCancel);

  const move = (to: TaskStatus) =>
    startTransition(async () => {
      let reason: string | null = null;
      if (to === "cancelled") {
        reason = window.prompt(`Why is “${title}” being cancelled?`);
        if (!reason?.trim()) return;
      }
      let result = await transitionTask({
        task_id: taskId,
        to_status: to,
        expected_version: version,
        reason: reason ?? "",
        confirm_unblock: false,
      });
      if (!result.ok && result.needsConfirmation && window.confirm(result.error)) {
        result = await transitionTask({
          task_id: taskId,
          to_status: to,
          expected_version: version,
          reason: reason ?? "",
          confirm_unblock: true,
        });
      }
      if (result.ok) toast.success(`“${title}” updated`);
      else if (!result.needsConfirmation) toast.error(result.error);
    });

  return (
    <div className="flex flex-wrap gap-1">
      {targets.map((to) => (
        <Button
          key={to}
          size="sm"
          variant={to === "cancelled" || to === "todo" || to === "on_hold" ? "ghost" : "outline"}
          disabled={
            pending ||
            (to === "in_progress" && status === "todo" && !canStart) ||
            (to === "done" && needsApproval)
          }
          title={
            to === "in_progress" && status === "todo" && !canStart
              ? "Waiting on prerequisites or client inputs"
              : to === "done" && needsApproval
                ? "Needs an approved approval first"
                : undefined
          }
          onClick={() => move(to)}
          aria-label={`${TRANSITION_LABELS[to]}: ${title}`}
        >
          {TRANSITION_LABELS[to]}
        </Button>
      ))}
      {needsApproval && !hasPendingApproval && status !== "done" && status !== "cancelled" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await requestApproval(taskId);
              if (result.ok) toast.success("Approval requested");
              else toast.error(result.error);
            })
          }
        >
          Request approval
        </Button>
      ) : null}
    </div>
  );
}

export function TaskDetailsForm({
  taskId,
  title,
  assigneeId,
  dueOn,
  members,
}: {
  taskId: string;
  title: string;
  assigneeId: string | null;
  dueOn: string | null;
  members: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [assignee, setAssignee] = useState(assigneeId ?? "");
  const [due, setDue] = useState(dueOn ?? "");
  const changed = assignee !== (assigneeId ?? "") || due !== (dueOn ?? "");
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateTaskDetails({
            task_id: taskId,
            assignee_user_id: assignee,
            due_on: due,
          });
          if (result.ok) toast.success("Task updated");
          else toast.error(result.error);
        });
      }}
    >
      <NativeSelect
        aria-label={`Assignee for ${title}`}
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
        className="h-8 w-40 text-xs"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </NativeSelect>
      <Input
        aria-label={`Due date for ${title}`}
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        className="h-8 w-36 text-xs"
      />
      {changed ? (
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Save
        </Button>
      ) : null}
    </form>
  );
}
