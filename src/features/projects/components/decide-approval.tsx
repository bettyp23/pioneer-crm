"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { decideApproval } from "@/features/projects/server/actions";

// Records a decision (D-16): client approvals need the client contact and an evidence link
// (e.g. a Drive copy of the approval email). Decided approvals cannot be changed.
export function DecideApproval({
  approvalId,
  title,
  version,
  approverType,
  contacts,
  canDecide,
}: {
  approvalId: string;
  title: string;
  version: number;
  approverType: "internal" | "client";
  contacts: { id: string; name: string }[];
  canDecide: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");

  if (!canDecide) {
    return (
      <p className="text-muted-foreground text-xs">
        {approverType === "internal" ? "An owner or admin decides internal approvals." : ""}
      </p>
    );
  }
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Record decision
      </Button>
    );
  }

  const decide = (decision: "approved" | "rejected" | "withdrawn") =>
    startTransition(async () => {
      const result = await decideApproval({
        approval_id: approvalId,
        decision,
        expected_version: version,
        note,
        evidence_url: evidence,
        client_contact_id: approverType === "client" ? contactId : "",
      });
      if (result.ok) {
        toast.success(`“${title}” ${decision}`);
        setOpen(false);
      } else toast.error(result.error);
    });
  const clientReady = approverType !== "client" || (contactId && evidence.trim());

  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-md p-3">
      {approverType === "client" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`contact-${approvalId}`}>Client contact</FieldLabel>
            <NativeSelect
              id={`contact-${approvalId}`}
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              <option value="">Choose…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`evidence-${approvalId}`}>Evidence link</FieldLabel>
            <Input
              id={`evidence-${approvalId}`}
              type="url"
              placeholder="https://drive.google.com/…"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
            <FieldDescription>E.g. a Drive copy of the approval email.</FieldDescription>
          </Field>
        </div>
      ) : null}
      <Field>
        <FieldLabel htmlFor={`note-${approvalId}`}>Note</FieldLabel>
        <Input
          id={`note-${approvalId}`}
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending || !clientReady} onClick={() => decide("approved")}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !clientReady}
          onClick={() => decide("rejected")}
        >
          Reject
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("withdrawn")}>
          Withdraw
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
