"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_FILE_BYTES } from "@/features/client-admin/schemas";
import { prepareFileUpload, recordFileUpload } from "@/features/client-admin/server/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

// Shares a file with a client: get a one-time upload URL from the server, send the bytes
// straight to Supabase Storage, then record the file so it shows in the client's portal.
export function FileUploadForm({
  clientId,
  projects,
}: {
  clientId: string;
  projects: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const file = form.get("file");
        const projectId = String(form.get("projectId") ?? "");
        if (!(file instanceof File) || file.size === 0) {
          toast.error("Choose a file to share.");
          return;
        }
        if (file.size > MAX_FILE_BYTES) {
          toast.error("Files can be up to 50 MB.");
          return;
        }
        startTransition(async () => {
          const prepared = await prepareFileUpload({ clientId, fileName: file.name });
          if (!prepared.ok || !prepared.data) {
            toast.error(prepared.ok ? "Could not start the upload." : prepared.error);
            return;
          }
          const supabase = createSupabaseBrowserClient();
          const { error } = await supabase.storage
            .from("client-files")
            .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, {
              contentType: file.type || "application/octet-stream",
            });
          if (error) {
            toast.error("The upload failed. Try again.");
            return;
          }
          const recorded = await recordFileUpload({
            clientId,
            projectId,
            title: title.trim() || file.name,
            path: prepared.data.path,
            fileName: file.name,
            contentType: file.type || undefined,
            size: file.size,
          });
          if (!recorded.ok) {
            toast.error(recorded.error);
            return;
          }
          toast.success("Shared with the client.");
          setTitle("");
          formRef.current?.reset();
        });
      }}
    >
      <label htmlFor="file-input" className="text-sm font-medium">
        File (up to 50 MB)
      </label>
      <Input id="file-input" name="file" type="file" required disabled={pending} />
      <label htmlFor="file-title" className="text-sm font-medium">
        Title the client sees
      </label>
      <Input
        id="file-title"
        value={title}
        maxLength={200}
        placeholder="Defaults to the file name"
        disabled={pending}
        onChange={(e) => setTitle(e.target.value)}
      />
      {projects.length > 0 ? (
        <>
          <label htmlFor="file-project" className="text-sm font-medium">
            Project
          </label>
          <NativeSelect id="file-project" name="projectId" defaultValue="" disabled={pending}>
            <option value="">General</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </>
      ) : null}
      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? "Uploading…" : "Share file"}
      </Button>
    </form>
  );
}
