"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addPackageLine } from "@/features/catalog/server/actions";

export function AddPackageLine({
  packageId,
  services,
}: {
  packageId: string;
  services: { id: string; name: string }[];
}) {
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [pending, startTransition] = useTransition();

  if (services.length === 0) {
    return <p className="text-muted-foreground text-sm">Every active service is included.</p>;
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await addPackageLine({
            package_id: packageId,
            service_id: serviceId,
            quantity,
          });
          if (result.ok) {
            toast.success("Service added");
            setServiceId("");
            setQuantity("1");
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      <NativeSelect
        aria-label="Service to add"
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
        className="w-full sm:w-64"
      >
        <option value="">Choose a service…</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </NativeSelect>
      <Input
        aria-label="Quantity"
        type="number"
        min={1}
        max={1000}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="w-24"
      />
      <Button type="submit" disabled={pending || !serviceId}>
        Add service
      </Button>
    </form>
  );
}
