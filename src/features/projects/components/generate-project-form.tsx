"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { generateProjectSchema, type GenerateProjectInput } from "@/features/projects/schemas";
import { generateProject } from "@/features/projects/server/actions";

type Option = { id: string; name: string };
type ClientOption = Option & { clientId: string };

// One-page wizard: client → SOW (or pilot reason) → published blueprint → name/start.
// The idempotency key is created when the page renders, so double-submits and retries
// return the same project (FR-PRJ-2).
export function GenerateProjectForm({
  idempotencyKey,
  defaultClientId,
  clients,
  sows,
  versions,
  leads,
  today,
}: {
  idempotencyKey: string;
  defaultClientId: string;
  clients: Option[];
  sows: ClientOption[];
  versions: Option[];
  leads: ClientOption[];
  today: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<GenerateProjectInput, unknown, z.output<typeof generateProjectSchema>>({
    resolver: zodResolver(generateProjectSchema),
    defaultValues: {
      idempotency_key: idempotencyKey,
      client_id: defaultClientId,
      blueprint_version_id: versions[0]?.id ?? "",
      name: "",
      start_on: today,
      sow_id: "",
      pilot: false,
      no_sow_reason: "",
      lead_id: "",
    },
  });
  const { errors } = form.formState;
  const clientId = useWatch({ control: form.control, name: "client_id" });
  const pilot = useWatch({ control: form.control, name: "pilot" });
  const clientSows = sows.filter((s) => s.clientId === clientId);
  const clientLeads = leads.filter((l) => l.clientId === clientId);

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await generateProject(form.getValues());
      if (result && !result.ok) setServerError(result.error);
    }),
  );

  if (versions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Publish a blueprint version first —{" "}
        <Link href="/blueprints" className="underline underline-offset-2">
          go to Blueprints
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <Field data-invalid={!!errors.client_id}>
          <FieldLabel htmlFor="client_id">1. Client</FieldLabel>
          <NativeSelect
            id="client_id"
            {...form.register("client_id", {
              onChange: () => {
                form.setValue("sow_id", "");
                form.setValue("lead_id", "");
              },
            })}
          >
            <option value="">Choose a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.client_id]} />
        </Field>

        <Field data-invalid={!!errors.sow_id || !!errors.no_sow_reason}>
          <FieldLabel htmlFor="sow_id">2. Signed SOW</FieldLabel>
          {!pilot ? (
            <>
              <NativeSelect id="sow_id" disabled={!clientId} {...form.register("sow_id")}>
                <option value="">
                  {clientSows.length === 0
                    ? "No signed SOWs for this client"
                    : "Choose a signed SOW…"}
                </option>
                {clientSows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
              <FieldDescription>
                Record SOWs on the client&apos;s SOWs tab. Only signed ones appear here.
              </FieldDescription>
              <FieldError errors={[errors.sow_id]} />
            </>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary size-4" {...form.register("pilot")} />
            Internal / pilot project without a signed SOW
          </label>
          {pilot ? (
            <>
              <Textarea
                id="no_sow_reason"
                aria-label="Reason for running without a signed SOW"
                rows={2}
                placeholder="Why is there no signed SOW? (recorded in the audit log)"
                {...form.register("no_sow_reason")}
              />
              <FieldError errors={[errors.no_sow_reason]} />
            </>
          ) : null}
        </Field>

        <Field data-invalid={!!errors.blueprint_version_id}>
          <FieldLabel htmlFor="blueprint_version_id">3. Blueprint version</FieldLabel>
          <NativeSelect id="blueprint_version_id" {...form.register("blueprint_version_id")}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </NativeSelect>
          <FieldDescription>
            Tasks, dependencies, client inputs and approvals are copied from this published version.
          </FieldDescription>
          <FieldError errors={[errors.blueprint_version_id]} />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.name} className="sm:col-span-2">
            <FieldLabel htmlFor="name">4. Project name</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.start_on}>
            <FieldLabel htmlFor="start_on">Start date</FieldLabel>
            <Input id="start_on" type="date" {...form.register("start_on")} />
            <FieldDescription>Task due dates count from here.</FieldDescription>
            <FieldError errors={[errors.start_on]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="lead_id">From lead (optional)</FieldLabel>
            <NativeSelect id="lead_id" disabled={!clientId} {...form.register("lead_id")}>
              <option value="">None</option>
              {clientLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Generating…" : "Generate project"}
        </Button>
      </FieldGroup>
    </form>
  );
}
