import type { Metadata } from "next";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { PortalNav } from "@/features/portal/components/portal-nav";
import { countPendingApprovals } from "@/features/portal/server/queries";
import { requireClient } from "@/server/auth/session";

export const metadata: Metadata = {
  title: { default: "Client portal", template: "%s · Pioneer Digital AI" },
};

// Client portal shell. Not an authorization boundary on its own: every page, query and
// action also calls requireClient(), and RLS limits the data to the client's own records.
export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { user } = await requireClient();
  const pendingApprovals = await countPendingApprovals();

  return (
    <div className="bg-muted/30 flex min-h-svh flex-col">
      <header className="bg-[#0a0a0a] pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Pioneer Digital AI</p>
            <p className="truncate text-xs text-white/70">{user.client.name}</p>
          </div>
          <SignOutButton variant="secondary" size="sm" />
        </div>
        <PortalNav pendingApprovals={pendingApprovals} />
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
      <footer className="text-muted-foreground mx-auto w-full max-w-3xl px-4 pb-6 text-xs">
        Questions? Send us a request any time. Signed in as {user.email ?? user.displayName}.
      </footer>
    </div>
  );
}
