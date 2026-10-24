import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { auditPageSchema } from "@/features/workspace/schemas";
import { AUDIT_PAGE_SIZE, listAuditEvents, listMembers } from "@/features/workspace/server/queries";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Audit log" };

// Renders `{column: [old, new]}` (updates) or `{column: value}` (snapshots). User ids are
// shown as member names when known.
function describeChanges(changes: unknown, names: Map<string, string>): string {
  if (!changes || typeof changes !== "object") return "";
  const show = (key: string, value: unknown) =>
    key === "user_id" && typeof value === "string"
      ? (names.get(value) ?? "former member")
      : String(value);
  return Object.entries(changes as Record<string, unknown>)
    .map(([key, value]) =>
      Array.isArray(value) && value.length === 2
        ? `${key === "user_id" ? "member" : key}: ${show(key, value[0])} → ${show(key, value[1])}`
        : `${key === "user_id" ? "member" : key}: ${show(key, value)}`,
    )
    .join(", ");
}

function PageLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export default async function AuditPage({ searchParams }: PageProps<"/settings/audit">) {
  const { member } = await requirePagePermission("audit.read");
  const page = auditPageSchema.parse((await searchParams).page);
  const [{ events, total }, members] = await Promise.all([listAuditEvents(page), listMembers()]);
  const names = new Map(members.map((m) => [m.user_id, m.profile?.display_name ?? "Unknown"]));
  const lastPage = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  const rows = events.map((event) => ({
    id: event.id,
    when: formatDateTime(event.occurred_at, member.workspaceTimezone),
    actor:
      event.actor_type === "user" && event.actor_user_id
        ? (names.get(event.actor_user_id) ?? "Former member")
        : event.actor_type === "system"
          ? "System"
          : "Agent",
    action: event.action,
    changes: describeChanges(event.changes, names),
  }));

  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Append-only record of consequential changes. {total} event{total === 1 ? "" : "s"}.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-md border p-4 text-center text-sm">
          No events yet.
        </p>
      ) : (
        <>
          {/* Phones: stacked list so every field is visible without sideways scrolling. */}
          <ul className="divide-y rounded-md border md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs break-all">{row.action}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{row.actor}</span>
                </div>
                <span className="text-muted-foreground text-xs">{row.when}</span>
                {row.changes ? <span className="text-xs break-words">{row.changes}</span> : null}
              </li>
            ))}
          </ul>

          <div className="hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{row.when}</TableCell>
                    <TableCell>{row.actor}</TableCell>
                    <TableCell className="font-mono text-xs">{row.action}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-normal">
                      {row.changes}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <nav aria-label="Audit log pages" className="flex items-center gap-2 text-sm">
        <PageLink href={`?page=${page - 1}`} disabled={page <= 1} label="Previous" />
        <span className="text-muted-foreground">
          Page {Math.min(page, lastPage)} of {lastPage}
        </span>
        <PageLink href={`?page=${page + 1}`} disabled={page >= lastPage} label="Next" />
      </nav>
    </section>
  );
}
