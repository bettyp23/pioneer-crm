import Link from "next/link";

import { cn } from "@/lib/utils";

export type Tab = { key: string; label: string; href: string; disabledLabel?: string };

// Server-rendered tab links (state lives in the URL, e.g. ?tab=contacts).
export function TabNav({ tabs, active, label }: { tabs: Tab[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        if (tab.disabledLabel) {
          return (
            <span
              key={tab.key}
              title={tab.disabledLabel}
              className="text-muted-foreground/60 -mb-px border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap"
            >
              {tab.label}
            </span>
          );
        }
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              isActive
                ? "border-primary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
