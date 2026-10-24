import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-md border border-dashed p-8 text-center text-sm">
      <p className="text-foreground font-medium">{title}</p>
      {children}
    </div>
  );
}
