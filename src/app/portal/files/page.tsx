import { Download } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { listPortalFiles } from "@/features/portal/server/queries";
import { formatBytes, formatDate } from "@/lib/format";
import { publicPath } from "@/lib/mount";
import { requireClient } from "@/server/auth/session";

export const metadata: Metadata = { title: "Files" };

export default async function PortalFilesPage() {
  const { user } = await requireClient();
  const files = await listPortalFiles();

  return (
    <>
      <PageHeader title="Files" description="Everything we've shared with you, newest first." />
      {files.length === 0 ? (
        <EmptyState title="No files yet">
          <p>Designs, documents and reports we share will appear here.</p>
        </EmptyState>
      ) : (
        <ul className="bg-background divide-y rounded-md border">
          {files.map((file) => (
            <li key={file.id}>
              {/* Plain link (not <Link>): the route answers with a redirect to a download. */}
              <a
                href={publicPath(`/portal/files/${file.id}`)}
                className="hover:bg-muted/50 flex items-center gap-3 p-3"
              >
                <Download className="text-muted-foreground size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{file.title}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {[
                      file.file_name,
                      formatBytes(file.size_bytes),
                      file.project?.name,
                      formatDate(file.created_at, user.client.timezone),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-sm underline">Download</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
