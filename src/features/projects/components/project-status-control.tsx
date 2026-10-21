"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { setProjectStatus } from "@/features/projects/server/actions";
import { PROJECT_STATUS_LABELS } from "@/features/projects/transitions";

type Status = keyof typeof PROJECT_STATUS_LABELS;

export function ProjectStatusControl({ projectId, status }: { projectId: string; status: Status }) {
  const [pending, startTransition] = useTransition();
  return (
    <NativeSelect
      aria-label="Project status"
      value={status}
      disabled={pending}
      className="w-40"
      onChange={(e) => {
        const next = e.target.value as Status;
        if (
          (next === "cancelled" || next === "completed") &&
          !window.confirm(`Mark the project ${PROJECT_STATUS_LABELS[next].toLowerCase()}?`)
        ) {
          e.target.value = status;
          return;
        }
        startTransition(async () => {
          const result = await setProjectStatus({ project_id: projectId, status: next });
          if (result.ok) toast.success(`Project ${PROJECT_STATUS_LABELS[next].toLowerCase()}`);
          else toast.error(result.error);
        });
      }}
    >
      {(Object.keys(PROJECT_STATUS_LABELS) as Status[]).map((s) => (
        <option key={s} value={s}>
          {PROJECT_STATUS_LABELS[s]}
        </option>
      ))}
    </NativeSelect>
  );
}
