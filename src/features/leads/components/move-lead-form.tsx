"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moveLead } from "@/features/leads/server/actions";
import { cn } from "@/lib/utils";

type Stage = { id: string; name: string; kind: "open" | "won" | "lost" };

// Accessible stage change (instead of drag-and-drop). A lost stage asks for a reason.
export function MoveLeadForm({
  leadId,
  leadTitle,
  currentStageId,
  stages,
  compact = false,
}: {
  leadId: string;
  leadTitle: string;
  currentStageId: string;
  stages: Stage[];
  compact?: boolean;
}) {
  const [stageId, setStageId] = useState(currentStageId);
  const [lostReason, setLostReason] = useState("");
  const [pending, startTransition] = useTransition();
  const target = stages.find((s) => s.id === stageId);
  const needsReason = target?.kind === "lost" && stageId !== currentStageId;
  const changed = stageId !== currentStageId;

  const submit = () =>
    startTransition(async () => {
      const result = await moveLead({
        lead_id: leadId,
        stage_id: stageId,
        lost_reason: lostReason,
      });
      if (result.ok) {
        toast.success(`Moved to ${target?.name ?? "stage"}`);
        setLostReason("");
      } else {
        toast.error(result.error);
      }
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn("flex flex-col gap-2", compact ? "" : "sm:max-w-sm")}
    >
      <div className="flex gap-2">
        <NativeSelect
          aria-label={`Stage for ${leadTitle}`}
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          className={compact ? "h-8 text-xs" : ""}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="submit"
          size={compact ? "sm" : "default"}
          variant={compact ? "outline" : "default"}
          disabled={!changed || pending || (needsReason && !lostReason.trim())}
        >
          {pending ? "Moving…" : "Move"}
        </Button>
      </div>
      {needsReason ? (
        <Input
          aria-label="Lost reason"
          placeholder="Why was it lost? (required)"
          value={lostReason}
          maxLength={1000}
          onChange={(e) => setLostReason(e.target.value)}
          className={compact ? "h-8 text-xs" : ""}
        />
      ) : null}
    </form>
  );
}
