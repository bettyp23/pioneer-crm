import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
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
import { createClientRecord } from "@/features/client-admin/server/actions";
import { listClientsOverview } from "@/features/client-admin/server/queries";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const { member } = await requirePagePermission("records.read");
  const clients = await listClientsOverview();
  const canWrite = can(member.role, "records.write");

  return (
    <>
      <PageHeader
        title="Clients"
        description="Each client sees only their own project, approvals, files and requests in the client portal (/login/portal)."
      />

      {canWrite ? (
        <ActionForm action={createClientRecord} className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-56 flex-1 flex-col gap-1">
            <label htmlFor="new-client-name" className="text-sm font-medium">
              New client
            </label>
            <Input
              id="new-client-name"
              name="name"
              required
              maxLength={120}
              placeholder="Business name"
            />
          </div>
          <Button type="submit">Add client</Button>
        </ActionForm>
      ) : null}

      {clients.length === 0 ? (
        <EmptyState title="No clients yet" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Portal users</TableHead>
                <TableHead className="text-right">Waiting approvals</TableHead>
                <TableHead className="text-right">Open requests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="font-medium underline"
                    >
                      {client.name}
                    </Link>
                    {client.archived_at ? (
                      <Badge variant="secondary" className="ml-2">
                        Archived
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">{client.portalUsers}</TableCell>
                  <TableCell className="text-right">{client.pendingApprovals}</TableCell>
                  <TableCell className="text-right">
                    {client.openRequests > 0 ? (
                      <Badge>{client.openRequests}</Badge>
                    ) : (
                      client.openRequests
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
