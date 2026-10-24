import type { Metadata } from "next";
import Link from "next/link";

import { NativeSelect } from "@/components/forms/native-select";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUSES,
  clientListParamsSchema,
} from "@/features/clients/schemas";
import { CLIENT_PAGE_SIZE, listClients } from "@/features/clients/server/queries";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const { member } = await requireMember();
  const params = clientListParamsSchema.parse(await searchParams);
  const { clients, total } = await listClients(params);
  const lastPage = Math.max(1, Math.ceil(total / CLIENT_PAGE_SIZE));
  const pageHref = (page: number) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status) sp.set("status", params.status);
    if (params.archived) sp.set("archived", "1");
    sp.set("page", String(page));
    return `/clients?${sp}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Clients"
          description={`${total} ${params.archived ? "archived " : ""}client${total === 1 ? "" : "s"}`}
        />
        {can(member.role, "records.write") ? (
          <Button asChild>
            <Link href="/clients/new">New client</Link>
          </Button>
        ) : null}
      </div>

      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input
          name="q"
          defaultValue={params.q}
          placeholder="Search by name"
          aria-label="Search clients by name"
          className="w-full sm:w-64"
        />
        <NativeSelect
          name="status"
          defaultValue={params.status ?? ""}
          aria-label="Filter by status"
          className="w-full sm:w-40"
        >
          <option value="">All statuses</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLIENT_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="archived"
            value="1"
            defaultChecked={params.archived}
            className="accent-primary size-4"
          />
          Archived
        </label>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      {clients.length === 0 ? (
        <EmptyState title={params.q || params.status ? "No matching clients" : "No clients yet"}>
          {can(member.role, "records.write") && !params.q ? (
            <Link href="/clients/new" className="underline underline-offset-2">
              Add your first client
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Industry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clients/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <ClientStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="hidden capitalize sm:table-cell">{c.kind}</TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {c.industry ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {lastPage > 1 ? (
        <nav aria-label="Client pages" className="flex items-center gap-2 text-sm">
          {params.page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(params.page - 1)}>Previous</Link>
            </Button>
          ) : null}
          <span className="text-muted-foreground">
            Page {params.page} of {lastPage}
          </span>
          {params.page < lastPage ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(params.page + 1)}>Next</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
