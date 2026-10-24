"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { ISSUE_STATUS_LABELS, ISSUE_STATUSES } from "@/features/operations/schemas";
import { setIssueStatus } from "@/features/operations/server/actions";

type Status = (typeof ISSUE_STATUSES)[number];

export function IssueStatusControl({ issueId, status }: { issueId: string; status: Status }) {
  const [next, setNext] = useState<Status>(status);
  const [resolution, setResolution] = useState("");
  const [pending, startTransition] = useTransition();
  const closing = next === "resolved" || next === "wont_fix";

  return (
    <form
      className="flex max-w-md flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await setIssueStatus({ issue_id: issueId, status: next, resolution });
          if (result.ok) toast.success(`Issue ${ISSUE_STATUS_LABELS[next].toLowerCase()}`);
          else toast.error(result.error);
        });
      }}
    >
      <div className="flex gap-2">
        <NativeSelect
          aria-label="Issue status"
          value={next}
          onChange={(e) => setNext(e.target.value as Status)}
        >
          {ISSUE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ISSUE_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="submit"
          disabled={pending || next === status || (closing && !resolution.trim())}
        >
          Update
        </Button>
      </div>
      {closing && next !== status ? (
        <Textarea
          aria-label="Resolution"
          placeholder="How was it resolved (or why won't it be fixed)?"
          rows={2}
          value={resolution}
          maxLength={5000}
          onChange={(e) => setResolution(e.target.value)}
        />
      ) : null}
    </form>
  );
}
