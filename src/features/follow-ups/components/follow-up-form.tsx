"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { followUpFormSchema, type FollowUpFormInput } from "@/features/follow-ups/schemas";
import { createFollowUp } from "@/features/follow-ups/server/actions";

type Option = { id: string; name: string };

export function FollowUpForm({
  clientId,
  leadId,
  members,
  defaultAssignee,
  defaultDueOn,
}: {
  clientId: string;
  leadId?: string;
  members: Option[];
  defaultAssignee: string;
  defaultDueOn: string;
}) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaults: FollowUpFormInput = {
    client_id: clientId,
    lead_id: leadId ?? "",
    contact_id: "",
    title: "",
    due_on: defaultDueOn,
    assignee_user_id: defaultAssignee,
  };
  const form = useForm<FollowUpFormInput, unknown, z.output<typeof followUpFormSchema>>({
    resolver: zodResolver(followUpFormSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        Add follow-up
      </Button>
    );
  }

  // Client-side validation only gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await createFollowUp(form.getValues());
      if (result.ok) {
        toast.success("Follow-up added");
        form.reset(defaults);
        setOpen(false);
      } else {
        setServerError(result.error);
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-md border p-4">
      <FormError message={serverError} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field data-invalid={!!errors.title} className="sm:col-span-3">
          <FieldLabel htmlFor="follow-up-title">What needs to happen?</FieldLabel>
          <Input id="follow-up-title" aria-invalid={!!errors.title} {...form.register("title")} />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field data-invalid={!!errors.due_on}>
          <FieldLabel htmlFor="follow-up-due">Due</FieldLabel>
          <Input id="follow-up-due" type="date" {...form.register("due_on")} />
          <FieldError errors={[errors.due_on]} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="follow-up-assignee">Assignee</FieldLabel>
          <NativeSelect id="follow-up-assignee" {...form.register("assignee_user_id")}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save follow-up"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
