import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PackageForm } from "@/features/catalog/components/package-form";
import { getPackage } from "@/features/catalog/server/queries";
import { minorToInput } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit package" };

export default async function EditPackagePage({
  params,
}: PageProps<"/catalog/packages/[id]/edit">) {
  await requirePagePermission("catalog.manage");
  const pkg = await getPackage((await params).id);
  return (
    <>
      <PageHeader title={`Edit ${pkg.name}`} />
      <PackageForm
        packageId={pkg.id}
        defaultValues={{
          name: pkg.name,
          description: pkg.description ?? "",
          list_price: minorToInput(pkg.list_price_minor),
          is_active: pkg.is_active,
        }}
      />
    </>
  );
}
