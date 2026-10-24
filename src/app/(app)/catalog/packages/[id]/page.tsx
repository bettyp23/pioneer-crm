import type { Metadata } from "next";
import Link from "next/link";

import { ActionButton } from "@/components/forms/action-button";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddPackageLine } from "@/features/catalog/components/add-package-line";
import { removePackageLine } from "@/features/catalog/server/actions";
import { getPackage, listServices } from "@/features/catalog/server/queries";
import { formatMoney } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Package" };

export default async function PackagePage({ params }: PageProps<"/catalog/packages/[id]">) {
  const { member } = await requireMember();
  const pkg = await getPackage((await params).id);
  const canManage = can(member.role, "catalog.manage");
  const services = canManage ? await listServices({ activeOnly: true }) : [];
  const included = new Set(pkg.lines.map((l) => l.service_id));
  const servicesTotal = pkg.lines.reduce(
    (sum, l) => sum + (l.service?.list_price_minor ?? 0) * l.quantity,
    0,
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            <Link href="/catalog/packages" className="hover:underline">
              Packages
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{pkg.name}</h1>
          <p className="text-muted-foreground text-sm">
            Package price {formatMoney(pkg.list_price_minor, pkg.currency)}
            {servicesTotal > 0 ? ` · services listed at ${formatMoney(servicesTotal)}` : ""}
            {pkg.is_active ? "" : " · inactive"}
          </p>
        </div>
        {canManage ? (
          <Button variant="outline" asChild>
            <Link href={`/catalog/packages/${pkg.id}/edit`}>Edit</Link>
          </Button>
        ) : null}
      </div>
      {pkg.description ? (
        <p className="max-w-2xl text-sm whitespace-pre-wrap">{pkg.description}</p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Included services</h2>
        {pkg.lines.length === 0 ? (
          <EmptyState title="No services in this package yet" />
        ) : (
          <ul className="divide-y rounded-md border">
            {pkg.lines.map((line) => (
              <li key={line.service_id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {line.service?.name}{" "}
                    {line.quantity > 1 ? <Badge variant="secondary">×{line.quantity}</Badge> : null}
                    {line.service && !line.service.is_active ? (
                      <Badge variant="outline">Inactive</Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">{line.service?.code}</p>
                </div>
                <span className="tabular-nums">
                  {formatMoney(line.service?.list_price_minor ?? null, line.service?.currency)}
                </span>
                {canManage ? (
                  <ActionButton
                    size="sm"
                    variant="ghost"
                    action={removePackageLine.bind(null, pkg.id, line.service_id)}
                    successMessage="Service removed"
                    aria-label={`Remove ${line.service?.name ?? "service"}`}
                  >
                    Remove
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <AddPackageLine
            packageId={pkg.id}
            services={services
              .filter((s) => !included.has(s.id))
              .map((s) => ({ id: s.id, name: s.name }))}
          />
        ) : null}
      </section>
    </>
  );
}
