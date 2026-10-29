"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  MAX_MESSAGE_LENGTH,
  RECIPIENT_LABELS,
  RECIPIENTS,
  type Recipient,
} from "@/features/chat/schemas";
import { sendMessage } from "@/features/chat/server/actions";

// Plain textarea on purpose: the iPhone keyboard's dictation button works in it.
export function ChatComposer() {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState<Recipient>("auto");
  const [warnings, setWarnings] = useState<string[]>([]);

  const send = (confirmFlagged: boolean) =>
    startTransition(async () => {
      const result = await sendMessage({ body, recipient, confirmFlagged });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!result.data?.sent) {
        setWarnings(result.data?.warnings ?? []);
        return;
      }
      setBody("");
      setWarnings([]);
    });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
    >
      <label htmlFor="chat-body" className="sr-only">
        Message
      </label>
      <Textarea
        id="chat-body"
        value={body}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder="Write to Pioneer…"
        onChange={(e) => {
          setBody(e.target.value);
          setWarnings([]);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send(false);
          }
        }}
      />
      {warnings.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Check before sending</AlertTitle>
          <AlertDescription>
            <p>This message leaves Pioneer and contains: {warnings.join(", ")}.</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" disabled={pending} onClick={() => send(true)}>
                Send anyway
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setWarnings([])}
              >
                Edit message
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="chat-recipient" className="text-muted-foreground text-sm">
          Send to
        </label>
        <NativeSelect
          id="chat-recipient"
          className="w-auto"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value as Recipient)}
        >
          {RECIPIENTS.map((r) => (
            <option key={r} value={r}>
              {RECIPIENT_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" className="ml-auto" disabled={pending || body.trim() === ""}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
