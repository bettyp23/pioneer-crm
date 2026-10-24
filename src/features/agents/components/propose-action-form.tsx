"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ACTION_TYPE_LABELS, ACTION_TYPES, type ActionType } from "@/features/agents/schemas";
import { proposeAction } from "@/features/agents/server/actions";

// Anything that leaves Pioneer OS (email, deploy, quote, contract, publish) is proposed here
// and waits in the Approval Center (D-20).
export function ProposeActionForm({
  workItemId,
  clientId,
  defaultDetails,
}: {
  workItemId?: string;
  clientId?: string | null;
  defaultDetails?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<ActionType>("send_email");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [details, setDetails] = useState(defaultDetails ?? "");

  if (!open) {
    return (
      <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
        Propose an action
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await proposeAction({
            work_item_id: workItemId ?? "",
            client_id: clientId ?? "",
            action_type: type,
            title,
            target,
            details,
            evidence_url: "",
          });
          if (result.ok) {
            toast.success("Sent to the Approval Center");
            setOpen(false);
          } else toast.error(result.error);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="action-type">Action</FieldLabel>
          <NativeSelect
            id="action-type"
            value={type}
            onChange={(e) => setType(e.target.value as ActionType)}
          >
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTION_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="action-target">To / where</FieldLabel>
          <Input
            id="action-target"
            placeholder="e.g. client email, site, document"
            value={target}
            maxLength={500}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="action-title">Title</FieldLabel>
          <Input
            id="action-title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="action-details">Exactly what will be sent or done</FieldLabel>
          <Textarea
            id="action-details"
            rows={6}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <FieldDescription>
            The approver sees this text. Nothing happens until it is approved.
          </FieldDescription>
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !title.trim() || !details.trim()}>
          Submit for approval
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
