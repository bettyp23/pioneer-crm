"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addStage, deleteStage, moveStage, renameStage } from "@/features/leads/server/actions";
import type { ActionResult } from "@/lib/action-result";

type Stage = { id: string; name: string; kind: "open" | "won" | "lost"; leadCount: number };

export function StageSettings({ stages }: { stages: Stage[] }) {
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const run = (action: () => Promise<ActionResult>, success: string, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        after?.();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <ol className="divide-y rounded-md border">
        {stages.map((stage, index) => (
          <li key={stage.id} className="flex flex-wrap items-center gap-2 p-3">
            <form
              className="flex min-w-48 flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = new FormData(e.currentTarget).get("name");
                run(() => renameStage(stage.id, name), "Stage renamed");
              }}
            >
              <Input
                name="name"
                defaultValue={stage.name}
                aria-label={`Name of stage ${index + 1}`}
                maxLength={60}
              />
              <Button type="submit" variant="outline" disabled={pending}>
                Rename
              </Button>
            </form>
            <div className="flex items-center gap-1">
              {stage.kind !== "open" ? (
                <Badge variant="secondary">{stage.kind === "won" ? "Won" : "Lost"}</Badge>
              ) : null}
              <span className="text-muted-foreground w-16 text-right text-xs">
                {stage.leadCount} lead{stage.leadCount === 1 ? "" : "s"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Move ${stage.name} up`}
                disabled={pending || index === 0}
                onClick={() => run(() => moveStage(stage.id, -1), "Stage moved")}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Move ${stage.name} down`}
                disabled={pending || index === stages.length - 1}
                onClick={() => run(() => moveStage(stage.id, 1), "Stage moved")}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${stage.name}`}
                disabled={pending || stage.kind !== "open" || stage.leadCount > 0}
                title={
                  stage.kind !== "open"
                    ? "Won and Lost stages can't be deleted"
                    : stage.leadCount > 0
                      ? "Move or archive its leads first"
                      : undefined
                }
                onClick={() => {
                  if (window.confirm(`Delete the stage “${stage.name}”?`)) {
                    run(() => deleteStage(stage.id), "Stage deleted");
                  }
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => addStage(newName),
            "Stage added",
            () => setNewName(""),
          );
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New stage name"
          aria-label="New stage name"
          maxLength={60}
        />
        <Button type="submit" disabled={pending || !newName.trim()}>
          Add stage
        </Button>
      </form>
      <p className="text-muted-foreground text-xs">
        New stages are added before Won and Lost. Stage changes are recorded in the audit log.
      </p>
    </div>
  );
}
