import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { listDiagnostics } from "@/features/operations/server/queries";
import { formatIsoDate } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Diagnostics" };

export default async function DiagnosticsPage() {
  const { member } = await requireMember();
  const diagnostics = await listDiagnostics();
  const canWrite = can(member.role, "records.write");
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Diagnostics"
          description="Audits and assessments performed for clients."
        />
        {canWrite ? (
          <Button asChild>
            <Link href="/diagnostics/new">Record diagnostic</Link>
          </Button>
        ) : null}
      </div>
      {diagnostics.length === 0 ? (
        <EmptyState title="No diagnostics yet" />
      ) : (
        <ul className="flex flex-col gap-3">
          {diagnostics.map((d) => (
            <li key={d.id} className="flex flex-col gap-1 rounded-md border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {d.diagnostic_type} ·{" "}
                  <Link href={`/clients/${d.client?.id}`} className="hover:underline">
                    {d.client?.name}
                  </Link>
                </p>
                <span className="text-muted-foreground text-xs">
                  {formatIsoDate(d.performed_on)}
                  {d.score !== null ? ` · score ${d.score}` : ""}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{d.summary}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                {d.report_url ? (
                  <a
                    href={d.report_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    Report <ExternalLink className="size-3" />
                  </a>
                ) : null}
                <Link href={`/issues?client=${d.client_id}`} className="underline">
                  {d.issues[0]?.count ?? 0} issue(s)
                </Link>
                {canWrite ? (
                  <Link href={`/issues/new?diagnostic=${d.id}`} className="underline">
                    Open an issue from this
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
