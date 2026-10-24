import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { listContactOptions } from "@/features/contacts/server/queries";
import { LeadForm } from "@/features/leads/components/lead-form";
import { getLead, listMemberOptions, listStages } from "@/features/leads/server/queries";
import { minorToInput } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit lead" };

export default async function EditLeadPage({ params }: PageProps<"/leads/[id]/edit">) {
  await requirePagePermission("records.write");
  const lead = await getLead((await params).id);
  const [contacts, stages, members] = await Promise.all([
    listContactOptions(),
    listStages(),
    listMemberOptions(),
  ]);

  return (
    <>
      <PageHeader title={`Edit ${lead.title}`} description="Change the stage from the lead page." />
      <LeadForm
        leadId={lead.id}
        clientId={lead.client_id}
        contacts={contacts}
        stages={stages}
        members={members}
        defaultValues={{
          title: lead.title,
          primary_contact_id: lead.primary_contact_id ?? "",
          source: lead.source ?? "",
          stage_id: lead.stage_id,
          estimated_value: minorToInput(lead.estimated_value_minor),
          expected_close_on: lead.expected_close_on ?? "",
          owner_user_id: lead.owner_user_id ?? "",
        }}
      />
    </>
  );
}
