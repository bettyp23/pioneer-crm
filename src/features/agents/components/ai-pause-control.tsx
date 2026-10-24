"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAiPaused } from "@/features/agents/server/actions";

// Kill switch (D-26). Pausing stops dispatch, agent jobs and automated AI spending at once;
// the database enforces it, this is only the control.
export function AiPauseControl({
  pausedLabel,
  reason,
  canControl,
}: {
  pausedLabel: string | null;
  reason: string | null;
  canControl: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const run = (paused: boolean) =>
    startTransition(async () => {
      const result = await setAiPaused({ paused, reason: pauseReason });
      if (result.ok) {
        toast.success(paused ? "All agents paused" : "Agents resumed");
        setConfirming(false);
        setPauseReason("");
      } else toast.error(result.error);
    });

  if (pausedLabel) {
    return (
      <Alert variant="destructive">
        <AlertTitle>All agents are paused</AlertTitle>
        <AlertDescription>
          <p>
            Since {pausedLabel}
            {reason ? ` — ${reason}` : ""}. Nothing can be sent to an agent, agent jobs wait, and
            automated AI spending is blocked.
          </p>
          {canControl ? (
            <Button size="sm" className="mt-2" disabled={pending} onClick={() => run(false)}>
              Resume agents
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }
  if (!canControl) return null;
  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setConfirming(true)}
      >
        Pause all agents
      </Button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(true);
      }}
    >
      <Input
        aria-label="Why are you pausing the agents?"
        placeholder="Reason (optional, kept in the audit log)"
        value={pauseReason}
        maxLength={500}
        onChange={(e) => setPauseReason(e.target.value)}
        className="h-8 max-w-sm"
      />
      <Button size="sm" variant="destructive" type="submit" disabled={pending}>
        Pause now
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}
