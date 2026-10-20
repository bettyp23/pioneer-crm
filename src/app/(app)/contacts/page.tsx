import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

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
import { contactName } from "@/features/contacts/schemas";
import { CONTACT_PAGE_SIZE, listAllContacts } from "@/features/contacts/server/queries";

export const metadata: Metadata = { title: "Contacts" };

const paramsSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const params = paramsSchema.parse(await searchParams);
  const { contacts, total } = await listAllContacts(params);
  const lastPage = Math.max(1, Math.ceil(total / CONTACT_PAGE_SIZE));
  const pageHref = (page: number) =>
    `/contacts?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), page: String(page) })}`;

  return (
    <>
      <PageHeader
        title="Contacts"
        description="People across all clients. Add contacts from a client's page."
      />
      <form className="flex gap-2" role="search">
        <Input
          name="q"
          defaultValue={params.q}
          placeholder="Search name or email"
          aria-label="Search contacts"
          className="w-full sm:w-72"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {contacts.length === 0 ? (
        <EmptyState title={params.q ? "No matching contacts" : "No contacts yet"} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {contactName(c)}{" "}
                    {c.is_primary ? <Badge variant="secondary">Primary</Badge> : null}
                    {c.job_title ? (
                      <span className="text-muted-foreground block text-xs font-normal">
                        {c.job_title}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {c.client ? (
                      <Link
                        href={`/clients/${c.client.id}?tab=contacts`}
                        className="hover:underline"
                      >
                        {c.client.name}
                      </Link>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{c.email ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{c.phone ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {lastPage > 1 ? (
        <nav aria-label="Contact pages" className="flex items-center gap-2 text-sm">
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
