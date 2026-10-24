"use client";

import { useState, ReactNode } from "react";
import { Menu } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNav, type NavEntry, type NavItem } from "./SidebarNav";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";

export type ShellUser = {
  name: string;
  role: string;
  initials: string;
};

function Sidebar({
  entries,
  footerEntries,
  user,
  brandHref,
  onNavigate,
}: {
  entries: NavEntry[];
  footerEntries?: NavEntry[];
  user: ShellUser;
  brandHref: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Logo variant="full" size="md" href={brandHref} priority />
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav entries={entries} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-sidebar-border p-3">
        {footerEntries&&<SidebarNav entries={footerEntries} onNavigate={onNavigate} className="p-0 pb-2"/>}
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="w-9 h-9">
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {user.role}
            </div>
          </div>
          <SignOutButton variant="icon" />
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  entries,
  footerEntries,
  user,
  brandHref,
  mobileNav,
  children,
}: {
  entries: NavEntry[];
  footerEntries?: NavEntry[];
  user: ShellUser;
  brandHref: string;
  mobileNav?: ReactNode; // optional bottom nav for mobile
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const profileEntry=footerEntries?.find((entry):entry is NavItem=>"href" in entry&&entry.href.endsWith("/profile"));

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 border-r border-sidebar-border">
        <Sidebar entries={entries} footerEntries={footerEntries} user={user} brandHref={brandHref} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-2 bg-surface border-b border-border px-3 h-14">
          {!mobileNav&&<Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Sidebar
                entries={entries}
                footerEntries={footerEntries}
                user={user}
                brandHref={brandHref}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>}
          <Logo variant="full" size="sm" href={brandHref} priority />
          {mobileNav&&<div className="ml-auto flex items-center gap-2">{profileEntry&&<Button variant="ghost" size="icon" asChild><Link href={profileEntry.href} aria-label="My Profile"><Avatar className="size-8"><AvatarFallback className="text-xs">{user.initials}</AvatarFallback></Avatar></Link></Button>}<SignOutButton variant="icon"/></div>}
        </header>

        <main
          className={`flex-1 min-w-0 p-4 sm:p-6 lg:p-8 ${mobileNav ? "pb-24 lg:pb-8" : ""}`}
        >
          {children}
        </main>

        {mobileNav}
      </div>
    </div>
  );
}
