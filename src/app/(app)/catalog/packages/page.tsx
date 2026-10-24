import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TabNav } from "@/components/layout/tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { catalogTabs } from "@/features/catalog/schemas";
import { listPackages } from "@/features/catalog/server/queries";
import { formatMoney } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Packages" };

export default async function PackagesPage() {
  const { member } = await requireMember();
  const packages = await listPackages();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Service catalog" description="Packages bundle services together." />
        {can(member.role, "catalog.manage") ? (
          <Button asChild>
            <Link href="/catalog/packages/new">New package</Link>
          </Button>
        ) : null}
      </div>
      <TabNav tabs={catalogTabs} active="packages" label="Catalog sections" />
      {packages.length === 0 ? (
        <EmptyState title="No packages yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {packages.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link href={`/catalog/packages/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </CardTitle>
                  {p.is_active ? null : <Badge variant="outline">Inactive</Badge>}
                </div>
                <CardDescription>{formatMoney(p.list_price_minor, p.currency)}</CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {p.lines.length === 0
                  ? "No services yet"
                  : p.lines
                      .map(
                        (l) =>
                          `${l.service?.name ?? "?"}${l.quantity > 1 ? ` ×${l.quantity}` : ""}`,
                      )
                      .join(" · ")}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
