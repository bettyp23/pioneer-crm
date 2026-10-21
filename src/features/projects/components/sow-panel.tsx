"use client";

import { ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createSow, setSowStatus, signSow } from "@/features/projects/server/actions";
import { SOW_STATUS_LABELS } from "@/features/projects/transitions";
import type { ActionResult } from "@/lib/action-result";

type Sow = {
  id: string;
  title: string;
  version_label: string | null;
  drive_url: string | null;
  status: keyof typeof SOW_STATUS_LABELS;
  signed_on: string | null;
  client_signatory: string | null;
  scope_summary: string | null;
  supersedes_id: string | null;
};

const VARIANT = {
  draft: "outline",
  sent: "secondary",
  signed: "default",
  superseded: "outline",
  void: "outline",
} as const;

export function SowPanel({
  clientId,
  sows,
  canWrite,
  canSign,
  today,
}: {
  clientId: string;
  sows: Sow[];
  canWrite: boolean;
  canSign: boolean;
  today: string;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [signing, setSigning] = useState<string | null>(null);
  const run = (action: () => Promise<ActionResult>, success: string, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        after?.();
      } else toast.error(result.error);
    });
  const titleOf = new Map(sows.map((s) => [s.id, s.title]));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        SOW references point to the signed document in Google Drive. Once signed they can only be
        superseded or voided.
      </p>
      {sows.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          No SOWs yet.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {sows.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.title}</span>
                {s.version_label ? (
                  <span className="text-muted-foreground">{s.version_label}</span>
                ) : null}
                <Badge variant={VARIANT[s.status]}>{SOW_STATUS_LABELS[s.status]}</Badge>
                {s.drive_url ? (
                  <a
                    href={s.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
                  >
                    Drive <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">
                {s.signed_on ? `Signed ${s.signed_on} by ${s.client_signatory}` : "Not signed"}
                {s.supersedes_id
                  ? ` · supersedes ${titleOf.get(s.supersedes_id) ?? "earlier SOW"}`
                  : ""}
              </p>
              {s.scope_summary ? <p className="whitespace-pre-wrap">{s.scope_summary}</p> : null}
              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  {s.status === "draft" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(() => setSowStatus({ id: s.id, status: "sent" }), "Marked as sent")
                      }
                    >
                      Mark sent
                    </Button>
                  ) : null}
                  {canSign && (s.status === "draft" || s.status === "sent") ? (
                    <Button size="sm" disabled={pending} onClick={() => setSigning(s.id)}>
                      Record signature
                    </Button>
                  ) : null}
                  {s.status === "signed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm("Mark this SOW as superseded? This can't be undone."))
                          run(
                            () => setSowStatus({ id: s.id, status: "superseded" }),
                            "Marked superseded",
                          );
                      }}
                    >
                      Supersede
                    </Button>
                  ) : null}
                  {s.status !== "superseded" && s.status !== "void" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm("Void this SOW? This can't be undone."))
                          run(() => setSowStatus({ id: s.id, status: "void" }), "SOW voided");
                      }}
                    >
                      Void
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {signing === s.id ? (
                <SignForm
                  pending={pending}
                  today={today}
                  onCancel={() => setSigning(null)}
                  onSubmit={(signedOn, signatory) =>
                    run(
                      () => signSow({ id: s.id, signed_on: signedOn, client_signatory: signatory }),
                      "Signature recorded",
                      () => setSigning(null),
                    )
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canWrite && !adding ? (
        <Button variant="outline" className="self-start" onClick={() => setAdding(true)}>
          Add SOW
        </Button>
      ) : null}
      {canWrite && adding ? (
        <form
          className="flex flex-col gap-4 rounded-md border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                createSow({
                  client_id: clientId,
                  title: f.get("title"),
                  version_label: f.get("version_label"),
                  drive_url: f.get("drive_url"),
                  status: f.get("status"),
                  scope_summary: f.get("scope_summary"),
                  supersedes_id: f.get("supersedes_id"),
                }),
              "SOW added",
              () => setAdding(false),
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="sow-title">Title</FieldLabel>
              <Input id="sow-title" name="title" required maxLength={200} />
            </Field>
            <Field>
              <FieldLabel htmlFor="sow-version">Version label</FieldLabel>
              <Input id="sow-version" name="version_label" placeholder="e.g. v2" maxLength={40} />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="sow-drive">Google Drive link</FieldLabel>
              <Input
                id="sow-drive"
                name="drive_url"
                type="url"
                placeholder="https://drive.google.com/…"
              />
              <FieldDescription>Keep Drive sharing restricted — no public links.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="sow-status">Status</FieldLabel>
              <NativeSelect id="sow-status" name="status" defaultValue="sent">
                <option value="draft">Draft</option>
                <option value="sent">Sent to client</option>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="sow-supersedes">Replaces</FieldLabel>
              <NativeSelect id="sow-supersedes" name="supersedes_id" defaultValue="">
                <option value="">Nothing</option>
                {sows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="sow-scope">Scope summary</FieldLabel>
              <Textarea id="sow-scope" name="scope_summary" rows={3} maxLength={10000} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              Save SOW
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function SignForm({
  pending,
  today,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  today: string;
  onSubmit: (signedOn: string, signatory: string) => void;
  onCancel: () => void;
}) {
  const [signedOn, setSignedOn] = useState(today);
  const [signatory, setSignatory] = useState("");
  return (
    <form
      className="bg-muted/40 flex flex-wrap items-end gap-2 rounded-md p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(signedOn, signatory);
      }}
    >
      <Field className="w-40">
        <FieldLabel htmlFor="signed-on">Signed on</FieldLabel>
        <Input
          id="signed-on"
          type="date"
          value={signedOn}
          max={today}
          onChange={(e) => setSignedOn(e.target.value)}
        />
      </Field>
      <Field className="min-w-48 flex-1">
        <FieldLabel htmlFor="signatory">Client signatory</FieldLabel>
        <Input
          id="signatory"
          value={signatory}
          maxLength={200}
          onChange={(e) => setSignatory(e.target.value)}
        />
      </Field>
      <Button type="submit" disabled={pending || !signatory.trim()}>
        Confirm signature
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
