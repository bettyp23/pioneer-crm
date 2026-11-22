"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/portal", label: "My project" },
  { href: "/portal/approvals", label: "Approvals" },
  { href: "/portal/files", label: "Files" },
  { href: "/portal/requests", label: "Requests" },
] as const;

export function PortalNav({ pendingApprovals }: { pendingApprovals: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Portal" className="mx-auto max-w-3xl overflow-x-auto px-2">
      <ul className="flex gap-1">
        {ITEMS.map((item) => {
          const active =
            item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap",
                  active
                    ? "border-white font-medium text-white"
                    : "border-transparent text-white/70 hover:text-white",
                )}
              >
                {item.label}
                {item.href === "/portal/approvals" && pendingApprovals > 0 ? (
                  <span className="rounded-full bg-white px-1.5 text-xs font-semibold text-black">
                    {pendingApprovals}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
