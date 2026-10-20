import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PackageForm } from "@/features/catalog/components/package-form";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "New package" };

export default async function NewPackagePage() {
  await requirePagePermission("catalog.manage");
  return (
    <>
      <PageHeader title="New package" description="Add services after creating it." />
      <PackageForm />
    </>
  );
}
