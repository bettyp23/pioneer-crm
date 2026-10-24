"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/features/agents/schemas";
import { commandJob } from "@/features/agents/server/actions";

export function JobControls({ id, status }: { id: string; status: JobStatus }) {
  const [pending, startTransition] = useTransition();
  const run = (command: "retry" | "cancel") =>
    startTransition(async () => {
      const result = await commandJob({ id, command });
      if (result.ok) toast.success(command === "retry" ? "Job queued again" : "Job cancelled");
      else toast.error(result.error);
    });
  if (status === "queued" || status === "running") {
    return (
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("cancel")}>
        Cancel
      </Button>
    );
  }
  if (status === "failed" || status === "dead" || status === "cancelled") {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("retry")}>
        Retry
      </Button>
    );
  }
  return null;
}
