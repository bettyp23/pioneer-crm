"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTION_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  type ActionType,
} from "@/features/agents/schemas";
import { decideAction, markActionExecuted } from "@/features/agents/server/actions";
import type { ActionResult } from "@/lib/action-result";

type Status = keyof typeof ACTION_STATUS_LABELS;

// One proposed action in the Approval Center: what exactly will happen, and the decision.
export function ActionCard({
  action,
  canDecide,
  isOwner,
}: {
  action: {
    id: string;
    title: string;
    action_type: ActionType;
    status: Status;
    target: string | null;
    details: string;
    version: number;
    decision_note: string | null;
    execution_note: string | null;
    client: { id: string; name: string } | null;
    work_item: { id: string; title: string } | null;
  };
  canDecide: boolean;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const ownerOnly = action.action_type === "price_quote" || action.action_type === "sign_contract";
  const run = (fn: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  const decide = (decision: "approved" | "rejected" | "cancelled") =>
    run(
      () => decideAction({ id: action.id, decision, expected_version: action.version, note }),
      `“${action.title}” ${decision}`,
    );

  return (
    <li className="flex flex-col gap-2 rounded-md border p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{action.title}</span>
        <Badge variant="secondary">{ACTION_TYPE_LABELS[action.action_type]}</Badge>
        <Badge
          variant={
            action.status === "pending"
              ? "outline"
              : action.status === "rejected"
                ? "destructive"
                : "default"
          }
        >
          {ACTION_STATUS_LABELS[action.status]}
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs">
        {action.target ? `To: ${action.target}` : "No target given"}
        {action.client ? (
          <>
            {" · "}
            <Link href={`/clients/${action.client.id}`} className="underline underline-offset-2">
              {action.client.name}
            </Link>
          </>
        ) : null}
        {action.work_item ? (
          <>
            {" · from "}
            <Link
              href={`/agents/queue/${action.work_item.id}`}
              className="underline underline-offset-2"
            >
              {action.work_item.title}
            </Link>
          </>
        ) : null}
      </p>
      <pre className="bg-muted/50 max-h-64 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
        {action.details}
      </pre>
      {action.decision_note ? (
        <p className="text-muted-foreground text-xs">Decision: {action.decision_note}</p>
      ) : null}
      {action.execution_note ? (
        <p className="text-muted-foreground text-xs">Done: {action.execution_note}</p>
      ) : null}

      {canDecide && action.status === "pending" ? (
        <div className="flex flex-col gap-2">
          <Input
            aria-label={`Note for ${action.title}`}
            placeholder="Note (required to reject)"
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending || (ownerOnly && !isOwner)}
              title={
                ownerOnly && !isOwner ? "Only the owner approves pricing and contracts" : undefined
              }
              onClick={() => decide("approved")}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !note.trim()}
              onClick={() => decide("rejected")}
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => decide("cancelled")}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {canDecide && action.status === "approved" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`What was done for ${action.title}`}
            placeholder="How it was done (e.g. sent from Gmail)"
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            className="max-w-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => markActionExecuted(action.id, action.version, note), "Marked as done")
            }
          >
            Mark done
          </Button>
        </div>
      ) : null}
    </li>
  );
}
