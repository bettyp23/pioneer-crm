"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPES,
  activityFormSchema,
  type ActivityFormInput,
} from "@/features/activities/schemas";
import { logActivity } from "@/features/activities/server/actions";

type Option = { id: string; name: string };

export function ActivityForm({
  clientId,
  leadId,
  leads,
  contacts,
  nowLocal,
  timezone,
}: {
  clientId: string;
  leadId?: string; // fixed lead (lead page)
  leads?: Option[]; // optional lead picker (client page)
  contacts: Option[];
  nowLocal: string; // "YYYY-MM-DDTHH:mm" in the workspace timezone
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaults: ActivityFormInput = {
    client_id: clientId,
    lead_id: leadId ?? "",
    contact_id: "",
    type: "note",
    subject: "",
    body: "",
    occurred_at_local: nowLocal,
  };
  const form = useForm<ActivityFormInput, unknown, z.output<typeof activityFormSchema>>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        Log activity
      </Button>
    );
  }

  // Client-side validation only gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await logActivity(form.getValues());
      if (result.ok) {
        toast.success("Activity logged");
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
        <Field>
          <FieldLabel htmlFor="activity-type">Type</FieldLabel>
          <NativeSelect id="activity-type" {...form.register("type")}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field data-invalid={!!errors.occurred_at_local}>
          <FieldLabel htmlFor="activity-when">When ({timezone})</FieldLabel>
          <Input id="activity-when" type="datetime-local" {...form.register("occurred_at_local")} />
          <FieldError errors={[errors.occurred_at_local]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="activity-contact">Contact</FieldLabel>
          <NativeSelect id="activity-contact" {...form.register("contact_id")}>
            <option value="">None</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {leads ? (
          <Field className="sm:col-span-3">
            <FieldLabel htmlFor="activity-lead">Lead</FieldLabel>
            <NativeSelect id="activity-lead" {...form.register("lead_id")}>
              <option value="">None</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        <Field data-invalid={!!errors.subject} className="sm:col-span-3">
          <FieldLabel htmlFor="activity-subject">Subject</FieldLabel>
          <Input
            id="activity-subject"
            aria-invalid={!!errors.subject}
            {...form.register("subject")}
          />
          <FieldError errors={[errors.subject]} />
        </Field>
        <Field data-invalid={!!errors.body} className="sm:col-span-3">
          <FieldLabel htmlFor="activity-body">Details</FieldLabel>
          <Textarea id="activity-body" rows={3} {...form.register("body")} />
          <FieldError errors={[errors.body]} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save activity"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
