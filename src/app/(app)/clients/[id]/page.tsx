import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { ActionButton } from "@/components/forms/action-button";
import { EmptyState } from "@/components/layout/empty-state";
import { TabNav, type Tab } from "@/components/layout/tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityForm } from "@/features/activities/components/activity-form";
import { ActivityList } from "@/features/activities/components/activity-list";
import { listActivities } from "@/features/activities/server/queries";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import { setClientArchived } from "@/features/clients/server/actions";
import { getClient } from "@/features/clients/server/queries";
import { contactName } from "@/features/contacts/schemas";
import { setContactArchived } from "@/features/contacts/server/actions";
import { listClientContacts } from "@/features/contacts/server/queries";
import { FollowUpForm } from "@/features/follow-ups/components/follow-up-form";
import { FollowUpList } from "@/features/follow-ups/components/follow-up-list";
import { listOpenFollowUps } from "@/features/follow-ups/server/queries";
import { LeadTable } from "@/features/leads/components/lead-table";
import { listLeads, listMemberOptions, listStages } from "@/features/leads/server/queries";
import { ProjectTable } from "@/features/projects/components/project-table";
import { SowPanel } from "@/features/projects/components/sow-panel";
import { listClientSows, listProjects } from "@/features/projects/server/queries";
import { listMembers } from "@/features/workspace/server/queries";
import { addDays, dateInZone, localDateTimeInZone } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Client" };

const TABS = [
  "overview",
  "contacts",
  "leads",
  "activity",
  "follow-ups",
  "projects",
  "sows",
] as const;
const tabSchema = z.enum(TABS).catch("overview");

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const { member } = await requireMember();
  const client = await getClient((await params).id);
  const tab = tabSchema.parse((await searchParams).tab);
  const canWrite = can(member.role, "records.write") && !client.archived_at;
  const tz = member.workspaceTimezone;

  const [contacts, leads, stages, followUps] = await Promise.all([
    listClientContacts(client.id, tab === "contacts"),
    listLeads({ clientId: client.id }),
    listStages(),
    listOpenFollowUps({ clientId: client.id }),
  ]);
  const activeContacts = contacts.filter((c) => !c.archived_at);
  const contactOptions = activeContacts.map((c) => ({ id: c.id, name: contactName(c) }));
  const primary = activeContacts.find((c) => c.is_primary);

  const href = (t: string) => `/clients/${client.id}${t === "overview" ? "" : `?tab=${t}`}`;
  const tabs: Tab[] = [
    { key: "overview", label: "Overview", href: href("overview") },
    { key: "contacts", label: `Contacts (${activeContacts.length})`, href: href("contacts") },
    { key: "leads", label: `Leads (${leads.length})`, href: href("leads") },
    { key: "activity", label: "Activity", href: href("activity") },
    {
      key: "follow-ups",
      label: `Follow-ups (${followUps.followUps.length})`,
      href: href("follow-ups"),
    },
    { key: "projects", label: "Projects", href: href("projects") },
    { key: "sows", label: "SOWs", href: href("sows") },
    { key: "invoices", label: "Invoices", href: "", disabledLabel: "Coming in M5" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            <Link href="/clients" className="hover:underline">
              Clients
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ClientStatusBadge status={client.status} />
            <span className="text-muted-foreground capitalize">{client.kind}</span>
            {client.industry ? (
              <span className="text-muted-foreground">· {client.industry}</span>
            ) : null}
            {client.archived_at ? <Badge variant="outline">Archived</Badge> : null}
          </div>
        </div>
        {can(member.role, "records.write") ? (
          <div className="flex flex-wrap gap-2">
            {canWrite ? (
              <Button variant="outline" asChild>
                <Link href={`/clients/${client.id}/edit`}>Edit</Link>
              </Button>
            ) : null}
            <ActionButton
              variant="ghost"
              action={setClientArchived.bind(null, client.id, !client.archived_at)}
              successMessage={client.archived_at ? "Client restored" : "Client archived"}
              confirmMessage={
                client.archived_at ? undefined : `Archive ${client.name}? You can restore it later.`
              }
            >
              {client.archived_at ? "Restore" : "Archive"}
            </ActionButton>
          </div>
        ) : null}
      </div>

      <TabNav tabs={tabs} active={tab} label="Client sections" />

      {tab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <h2 className="font-medium">Details</h2>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Legal name</dt>
              <dd>{client.legal_name ?? "—"}</dd>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="truncate">
                {client.website_url ? (
                  <a
                    href={client.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {client.website_url.replace(/^https:\/\//, "")}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Drive folder</dt>
              <dd>
                {client.drive_folder_url ? (
                  <a
                    href={client.drive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    Open in Google Drive <ExternalLink className="size-3" />
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Primary contact</dt>
              <dd>
                {primary
                  ? `${contactName(primary)}${primary.email ? ` · ${primary.email}` : ""}`
                  : "—"}
              </dd>
            </dl>
            {client.notes ? (
              <p className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap">
                {client.notes}
              </p>
            ) : null}
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="font-medium">Open follow-ups</h2>
            <FollowUpList
              followUps={followUps.followUps.slice(0, 5)}
              today={followUps.today}
              canWrite={canWrite}
              showClient={false}
            />
          </section>
        </div>
      ) : null}

      {tab === "contacts" ? (
        <section className="flex flex-col gap-4">
          {canWrite ? (
            <Button asChild className="self-start">
              <Link href={`/clients/${client.id}/contacts/new`}>Add contact</Link>
            </Button>
          ) : null}
          {contacts.length === 0 ? (
            <EmptyState title="No contacts yet" />
          ) : (
            <ul className="divide-y rounded-md border">
              {contacts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {contactName(c)}{" "}
                      {c.is_primary ? <Badge variant="secondary">Primary</Badge> : null}{" "}
                      {c.archived_at ? <Badge variant="outline">Archived</Badge> : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {[c.job_title, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  {canWrite ? (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/contacts/${c.id}/edit`}>Edit</Link>
                      </Button>
                      <ActionButton
                        size="sm"
                        variant="ghost"
                        action={setContactArchived.bind(null, c.id, !c.archived_at)}
                        successMessage={c.archived_at ? "Contact restored" : "Contact archived"}
                      >
                        {c.archived_at ? "Restore" : "Archive"}
                      </ActionButton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "leads" ? (
        <section className="flex flex-col gap-4">
          {canWrite ? (
            <Button asChild className="self-start">
              <Link href={`/leads/new?client=${client.id}`}>New lead</Link>
            </Button>
          ) : null}
          <LeadTable leads={leads} stages={stages} showClient={false} />
        </section>
      ) : null}

      {tab === "activity" ? (
        <ActivityTab
          clientId={client.id}
          canWrite={canWrite}
          timezone={tz}
          contacts={contactOptions}
          leads={leads.map((l) => ({ id: l.id, name: l.title }))}
        />
      ) : null}

      {tab === "projects" ? (
        <section className="flex flex-col gap-4">
          {can(member.role, "projects.generate") && !client.archived_at ? (
            <Button asChild className="self-start">
              <Link href={`/projects/new?client=${client.id}`}>Generate project</Link>
            </Button>
          ) : null}
          <ProjectTable projects={await listProjects({ clientId: client.id })} showClient={false} />
        </section>
      ) : null}

      {tab === "sows" ? (
        <SowPanel
          clientId={client.id}
          sows={await listClientSows(client.id)}
          canWrite={canWrite}
          canSign={can(member.role, "sow.record_signed")}
          today={dateInZone(new Date(), tz)}
        />
      ) : null}

      {tab === "follow-ups" ? (
        <FollowUpsTab
          clientId={client.id}
          canWrite={canWrite}
          today={followUps.today}
          userId={member.userId}
          followUps={followUps.followUps}
        />
      ) : null}
    </>
  );
}

async function ActivityTab({
  clientId,
  canWrite,
  timezone,
  contacts,
  leads,
}: {
  clientId: string;
  canWrite: boolean;
  timezone: string;
  contacts: { id: string; name: string }[];
  leads: { id: string; name: string }[];
}) {
  const [activities, members] = await Promise.all([listActivities({ clientId }), listMembers()]);
  const names = new Map(members.map((m) => [m.user_id, m.profile?.display_name ?? "Unknown"]));
  return (
    <section className="flex flex-col gap-4">
      {canWrite ? (
        <ActivityForm
          clientId={clientId}
          leads={leads}
          contacts={contacts}
          nowLocal={localDateTimeInZone(new Date(), timezone)}
          timezone={timezone}
        />
      ) : null}
      <ActivityList activities={activities} timezone={timezone} names={names} />
    </section>
  );
}

async function FollowUpsTab({
  clientId,
  canWrite,
  today,
  userId,
  followUps,
}: {
  clientId: string;
  canWrite: boolean;
  today: string;
  userId: string;
  followUps: Awaited<ReturnType<typeof listOpenFollowUps>>["followUps"];
}) {
  const members = await listMemberOptions();
  return (
    <section className="flex flex-col gap-4">
      {canWrite ? (
        <FollowUpForm
          clientId={clientId}
          members={members}
          defaultAssignee={members.some((m) => m.id === userId) ? userId : ""}
          defaultDueOn={addDays(today, 1)}
        />
      ) : null}
      <FollowUpList followUps={followUps} today={today} canWrite={canWrite} showClient={false} />
    </section>
  );
}
