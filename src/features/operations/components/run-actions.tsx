"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setRoutineRunStatus } from "@/features/operations/server/actions";

// Close a routine occurrence. Skipped/failed ask for a note (kept with the run).
export function RunActions({ runId, label }: { runId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const close = (status: "done" | "skipped" | "failed") => {
    let notes = "";
    if (status !== "done") {
      const answer = window.prompt(
        status === "skipped" ? "Why was it skipped?" : "What went wrong?",
      );
      if (!answer?.trim()) return;
      notes = answer;
    }
    startTransition(async () => {
      const result = await setRoutineRunStatus({ run_id: runId, status, notes });
      if (result.ok) toast.success(`${label}: ${status}`);
      else toast.error(result.error);
    });
  };
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => close("done")}
        aria-label={`Done: ${label}`}
      >
        Done
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => close("skipped")}
        aria-label={`Skip: ${label}`}
      >
        Skip
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => close("failed")}
        aria-label={`Failed: ${label}`}
      >
        Failed
      </Button>
    </div>
  );
}
