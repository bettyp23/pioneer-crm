"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateWorkspaceSchema, type UpdateWorkspaceInput } from "@/features/workspace/schemas";
import { updateWorkspace } from "@/features/workspace/server/actions";

export function WorkspaceSettingsForm({
  defaultValues,
  timeZones,
}: {
  defaultValues: UpdateWorkspaceInput;
  timeZones: string[];
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues,
  });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateWorkspace(values);
      if (result.ok) {
        toast.success("Workspace settings saved");
        form.reset(values);
      } else {
        toast.error(result.error);
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md">
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
          <Input id="workspace-name" aria-invalid={!!errors.name} {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.timezone}>
          <FieldLabel htmlFor="workspace-timezone">Timezone</FieldLabel>
          <select
            id="workspace-timezone"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
            aria-invalid={!!errors.timezone}
            {...form.register("timezone")}
          >
            {timeZones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <FieldDescription>Dates and due times are shown in this timezone.</FieldDescription>
          <FieldError errors={[errors.timezone]} />
        </Field>
        <Button type="submit" disabled={pending || !isDirty} className="self-start">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </FieldGroup>
    </form>
  );
}
