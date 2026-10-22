"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkStatus } from "@/features/agents/schemas";
import { transitionWorkItem } from "@/features/agents/server/actions";
import type { ActionResult } from "@/lib/action-result";

// The work item's lifecycle buttons (FR-AGT-2…4). The database enforces who may do what.
export function WorkItemPanel({
  id,
  status,
  version,
  flagged,
  prompt,
  canDispatch,
}: {
  id: string;
  status: WorkStatus;
  version: number;
  flagged: boolean;
  prompt: string;
  canDispatch: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [output, setOutput] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [note, setNote] = useState("");
  const base = {
    id,
    expected_version: version,
    override_reason: "",
    output_text: "",
    output_url: "",
    review_note: "",
  };
  const run = (action: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  const go = (to: string, extra: Partial<typeof base> = {}, success = "Updated") =>
    run(() => transitionWorkItem({ ...base, ...extra, to }), success);

  return (
    <div className="flex flex-col gap-3">
      {status === "draft" ? (
        <>
          {flagged ? (
            <Textarea
              aria-label="Reason to send flagged content"
              placeholder="Flagged content is included. Why is it needed? (recorded in the audit log)"
              rows={2}
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending || (flagged && !reason.trim())}
              onClick={() => go("ready", { override_reason: reason }, "Ready to send")}
            >
              Mark ready
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/agents/queue/${id}/edit`}>Edit draft</Link>
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => go("cancelled", {}, "Cancelled")}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : null}

      {status === "ready" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard
                .writeText(prompt)
                .then(() => toast.success("Prompt copied — paste it into Claude or ChatGPT"))
                .catch(() => toast.error("Couldn't copy; select the prompt text instead"))
            }
          >
            Copy prompt
          </Button>
          {canDispatch ? (
            <Button disabled={pending} onClick={() => go("dispatched", {}, "Marked as sent")}>
              Mark as sent
            </Button>
          ) : null}
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => go("draft", {}, "Back to draft")}
          >
            Back to draft
          </Button>
        </div>
      ) : null}

      {status === "dispatched" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go("returned", { output_text: output, output_url: outputUrl }, "Output saved");
          }}
        >
          <Textarea
            aria-label="Agent output"
            placeholder="Paste the agent's reply here"
            rows={8}
            value={output}
            onChange={(e) => setOutput(e.target.value)}
          />
          <Input
            aria-label="Output link (optional)"
            type="url"
            placeholder="Or a link to it (https://…)"
            value={outputUrl}
            onChange={(e) => setOutputUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || (!output.trim() && !outputUrl.trim())}>
              Save output
            </Button>
            {canDispatch ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => go("cancelled", {}, "Cancelled")}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {status === "returned" && canDispatch ? (
        <div className="flex flex-col gap-2">
          <Input
            aria-label="Review note"
            placeholder="Review note (required to reject)"
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() => go("accepted", { review_note: note }, "Output accepted")}
            >
              Accept output
            </Button>
            <Button
              variant="outline"
              disabled={pending || !note.trim()}
              onClick={() => go("rejected", { review_note: note }, "Output rejected")}
            >
              Reject
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Accepting changes nothing in the CRM. To send, deploy, price or sign, propose an action
            below.
          </p>
        </div>
      ) : null}
    </div>
  );
}
