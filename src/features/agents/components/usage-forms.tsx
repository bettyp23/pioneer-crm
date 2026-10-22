"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PROVIDER_LABELS,
  SELECTABLE_PROVIDERS,
  type SelectableProvider,
} from "@/features/agents/schemas";
import { recordUsage, setBudget } from "@/features/agents/server/actions";

export function BudgetForm({
  provider,
  capDollars,
}: {
  provider: SelectableProvider;
  capDollars: string;
}) {
  const [cap, setCap] = useState(capDollars);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await setBudget({ provider, cap });
          if (result.ok) toast.success(`${PROVIDER_LABELS[provider]} cap saved`);
          else toast.error(result.error);
        });
      }}
    >
      <span className="text-muted-foreground text-sm">$</span>
      <Input
        aria-label={`Monthly cap for ${PROVIDER_LABELS[provider]}`}
        inputMode="decimal"
        value={cap}
        onChange={(e) => setCap(e.target.value)}
        className="h-8 w-24"
      />
      {cap !== capDollars ? (
        <Button size="sm" type="submit" disabled={pending}>
          Save
        </Button>
      ) : null}
    </form>
  );
}

export function UsageForm({ workItemId }: { workItemId?: string }) {
  const [provider, setProvider] = useState<SelectableProvider>("openrouter");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await recordUsage({
            provider,
            cost,
            note,
            work_item_id: workItemId ?? "",
          });
          if (result.ok) {
            toast.success("Cost recorded");
            setCost("");
            setNote("");
          } else toast.error(result.error);
        });
      }}
    >
      <NativeSelect
        aria-label="Provider"
        value={provider}
        onChange={(e) => setProvider(e.target.value as SelectableProvider)}
        className="h-8 w-44 text-xs"
      >
        {SELECTABLE_PROVIDERS.filter((p) => p !== "manual").map((p) => (
          <option key={p} value={p}>
            {PROVIDER_LABELS[p]}
          </option>
        ))}
      </NativeSelect>
      <Input
        aria-label="Cost in dollars"
        placeholder="Cost, e.g. 0.42"
        inputMode="decimal"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        className="h-8 w-32"
      />
      <Input
        aria-label="Cost note"
        placeholder="Note (optional)"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        className="h-8 w-48"
      />
      <Button size="sm" type="submit" variant="outline" disabled={pending || !cost.trim()}>
        Record cost
      </Button>
    </form>
  );
}
