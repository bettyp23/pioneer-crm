"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Textarea } from "@/components/forms/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MAX_MESSAGE_LENGTH } from "@/features/chat/schemas";
import { sendMessage } from "@/features/chat/server/actions";

// Plain textarea on purpose: the iPhone keyboard's dictation button works in it.
// Every message goes straight to Michael Scott (Grok).
export function ChatComposer() {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const send = (confirmFlagged: boolean) =>
    startTransition(async () => {
      const result = await sendMessage({ body, recipient: "michael_scott", confirmFlagged });
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
        placeholder="Message Michael…"
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
            <p>This message goes to Michael Scott and contains: {warnings.join(", ")}.</p>
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
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground hidden text-xs sm:inline">⌘ + Enter to send</span>
        <Button type="submit" className="ml-auto" disabled={pending || body.trim() === ""}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
