"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markInvoicePaid } from "@/features/operations/server/actions";

export function MarkPaid({
  invoiceId,
  number,
  today,
}: {
  invoiceId: string;
  number: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(today);
  const [pending, startTransition] = useTransition();
  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Mark ${number} paid`}
      >
        Mark paid
      </Button>
    );
  }
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await markInvoicePaid(invoiceId, paidOn);
          if (result.ok) toast.success(`${number} marked paid`);
          else toast.error(result.error);
        });
      }}
    >
      <Input
        type="date"
        aria-label={`Paid date for ${number}`}
        value={paidOn}
        max={today}
        onChange={(e) => setPaidOn(e.target.value)}
        className="h-8 w-36 text-xs"
      />
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
