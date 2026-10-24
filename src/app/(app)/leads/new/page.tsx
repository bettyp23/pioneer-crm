import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { listClientOptions } from "@/features/clients/server/queries";
import { listContactOptions } from "@/features/contacts/server/queries";
import { LeadForm } from "@/features/leads/components/lead-form";
import { listMemberOptions, listStages } from "@/features/leads/server/queries";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "New lead" };

export default async function NewLeadPage({ searchParams }: PageProps<"/leads/new">) {
  const { member } = await requirePagePermission("records.write");
  const [clients, contacts, stages, members] = await Promise.all([
    listClientOptions(),
    listContactOptions(),
    listStages(),
    listMemberOptions(),
  ]);
  const requested = z.uuid().safeParse((await searchParams).client);
  const preselected = requested.success && clients.some((c) => c.id === requested.data);
  const openStages = stages.filter((s) => s.kind === "open");

  if (clients.length === 0) {
    return (
      <>
        <PageHeader title="New lead" />
        <EmptyState title="Add a client first">
          A lead is an opportunity with a client.{" "}
          <Link href="/clients/new" className="underline underline-offset-2">
            Create a client
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="New lead" description="An opportunity with an existing client." />
      <LeadForm
        clientId={preselected ? requested.data : undefined}
        clients={clients}
        contacts={contacts}
        stages={openStages}
        members={members}
        defaultValues={{
          title: "",
          primary_contact_id: "",
          source: "",
          stage_id: openStages[0]?.id ?? "",
          estimated_value: "",
          expected_close_on: "",
          owner_user_id: members.some((m) => m.id === member.userId) ? member.userId : "",
        }}
      />
    </>
  );
}
