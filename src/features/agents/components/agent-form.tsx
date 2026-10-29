"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  agentFormSchema,
  PROVIDER_LABELS,
  AGENT_PROVIDERS,
  WORK_TYPE_LABELS,
  WORK_TYPES,
  type AgentFormInput,
} from "@/features/agents/schemas";
import { updateAgent } from "@/features/agents/server/actions";

export function AgentForm({
  agentId,
  defaultValues,
}: {
  agentId: string;
  defaultValues: AgentFormInput;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<AgentFormInput, unknown, z.output<typeof agentFormSchema>>({
    resolver: zodResolver(agentFormSchema),
    defaultValues,
  });
  const { errors } = form.formState;
  const types = useWatch({ control: form.control, name: "allowed_work_types" });

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await updateAgent(agentId, form.getValues());
      if (result && !result.ok) setServerError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="provider">Runs on</FieldLabel>
            <NativeSelect id="provider" {...form.register("provider")}>
              {AGENT_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="role_summary">Role</FieldLabel>
            <Input id="role_summary" {...form.register("role_summary")} />
          </Field>
          <Field data-invalid={!!errors.instructions} className="sm:col-span-2">
            <FieldLabel htmlFor="instructions">Saved instructions</FieldLabel>
            <Textarea id="instructions" rows={10} {...form.register("instructions")} />
            <FieldDescription>
              The role&apos;s standing instructions. They start every prompt, and Hermes will use
              them once it is connected. Don&apos;t include passwords or keys.
            </FieldDescription>
            <FieldError errors={[errors.instructions]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="model">Model (optional)</FieldLabel>
            <Input
              id="model"
              placeholder="Leave empty to use the default"
              {...form.register("model")}
            />
          </Field>
          <Field orientation="horizontal" className="items-center self-end">
            <input
              id="is_active"
              type="checkbox"
              className="accent-primary size-4"
              {...form.register("is_active")}
            />
            <FieldLabel htmlFor="is_active">Active</FieldLabel>
          </Field>
        </div>
        <FieldSet>
          <FieldLegend variant="label">Kinds of work it takes</FieldLegend>
          <div className="grid gap-2 sm:grid-cols-3">
            {WORK_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={types.includes(t)}
                  onChange={(e) =>
                    form.setValue(
                      "allowed_work_types",
                      e.target.checked ? [...types, t] : types.filter((x) => x !== t),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                />
                {WORK_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          <FieldError errors={[errors.allowed_work_types as { message?: string } | undefined]} />
        </FieldSet>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save agent"}
        </Button>
      </FieldGroup>
    </form>
  );
}
