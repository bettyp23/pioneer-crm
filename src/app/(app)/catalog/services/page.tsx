import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TabNav } from "@/components/layout/tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { catalogTabs } from "@/features/catalog/schemas";
import { listServices } from "@/features/catalog/server/queries";
import { formatMoney } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const { member } = await requireMember();
  const services = await listServices();
  const canManage = can(member.role, "catalog.manage");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Service catalog" description="What you offer. Prices are optional." />
        {canManage ? (
          <Button asChild>
            <Link href="/catalog/services/new">New service</Link>
          </Button>
        ) : null}
      </div>
      <TabNav tabs={catalogTabs} active="services" label="Catalog sections" />
      {services.length === 0 ? (
        <EmptyState title="No services yet" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="hidden sm:table-cell">Code</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">List price</TableHead>
                <TableHead>Status</TableHead>
                {canManage ? <TableHead className="sr-only">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.name}
                    {s.description ? (
                      <span className="text-muted-foreground block max-w-md truncate text-xs font-normal">
                        {s.description}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">{s.code}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.category ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(s.list_price_minor, s.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "secondary" : "outline"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/catalog/services/${s.id}/edit`} aria-label={`Edit ${s.name}`}>
                          Edit
                        </Link>
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
