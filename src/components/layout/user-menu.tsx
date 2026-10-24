"use client";

import { ChevronsUpDown, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function UserMenu({
  displayName,
  email,
  roleLabel,
}: {
  displayName: string;
  email: string | null;
  roleLabel: string;
}) {
  const signOutForm = useRef<HTMLFormElement>(null);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <form ref={signOutForm} action="/auth/sign-out" method="post" hidden />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label="Account menu">
              <span className="bg-muted flex size-8 items-center justify-center rounded-full text-xs font-medium">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium">{displayName}</span>
                <span className="text-muted-foreground truncate text-xs">{roleLabel}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{displayName}</span>
              {email ? <span className="text-muted-foreground block text-xs">{email}</span> : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/security">
                <ShieldCheck /> Security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => signOutForm.current?.requestSubmit()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
