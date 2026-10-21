"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setInputStatus } from "@/features/projects/server/actions";
import type { ActionResult } from "@/lib/action-result";

type Status = "requested" | "received" | "accepted" | "rejected" | "waived";

export function InputRequestActions({
  requestId,
  label,
  status,
  version,
  kind,
  canWaive,
}: {
  requestId: string;
  label: string;
  status: Status;
  version: number;
  kind: "file" | "text" | "access_confirmation" | "decision";
  canWaive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [receiving, setReceiving] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");
  const [response, setResponse] = useState("");
  const run = (action: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        setReceiving(false);
      } else toast.error(result.error);
    });
  const base = {
    request_id: requestId,
    expected_version: version,
    drive_url: "",
    response_text: "",
    waive_reason: "",
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {status === "requested" ||
        status === "rejected" ||
        status === "received" ||
        status === "accepted" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setReceiving((v) => !v)}
          >
            {status === "requested" ? "Record received" : "Record new submission"}
          </Button>
        ) : null}
        {status === "received" ? (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => setInputStatus({ ...base, to_status: "accepted" }), `“${label}” accepted`)
              }
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(() => setInputStatus({ ...base, to_status: "rejected" }), `“${label}” rejected`)
              }
            >
              Reject
            </Button>
          </>
        ) : null}
        {canWaive && (status === "requested" || status === "rejected") ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt(`Why is “${label}” no longer needed?`);
              if (reason?.trim())
                run(
                  () => setInputStatus({ ...base, to_status: "waived", waive_reason: reason }),
                  "Input waived",
                );
            }}
          >
            Waive
          </Button>
        ) : null}
      </div>
      {receiving ? (
        <form
          className="bg-muted/40 flex flex-col gap-2 rounded-md p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                setInputStatus({
                  ...base,
                  to_status: "received",
                  drive_url: driveUrl,
                  response_text: response,
                }),
              `“${label}” recorded`,
            );
          }}
        >
          {kind === "file" ? (
            <Input
              aria-label={`Drive link for ${label}`}
              type="url"
              placeholder="https://drive.google.com/…"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
            />
          ) : (
            <Input
              aria-label={`Response for ${label}`}
              placeholder={
                kind === "access_confirmation"
                  ? "Where the credential is stored (e.g. 1Password: Client — Hosting). Never the password."
                  : "Answer or decision"
              }
              value={response}
              maxLength={5000}
              onChange={(e) => setResponse(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={pending || (kind === "file" ? !driveUrl : !response.trim())}
            >
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReceiving(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
