"use client";

import { ReactNode } from "react";
import { navigationIcons as icons } from "@/lib/navigation-icons";
import { AppShell } from "@/components/shared/AppShell";
import { BottomNav, type BottomNavItem } from "@/components/shared/BottomNav";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { userInitials } from "@/lib/auth";
import type { NavEntry } from "@/components/shared/SidebarNav";

const entries: NavEntry[] = [
  { label: "Home", href: "/branch/home", icon: icons.dashboard },
  { label: "Place Order", href: "/branch/order", icon: icons.placeOrder },
  { label: "Orders", href: "/branch/invoices", icon: icons.orders },
  { label: "Inventory", href: "/branch/inventory", icon: icons.stock },
  { label: "Catering", href: "/branch/catering", icon: icons.catering },
];

const bottomItems: BottomNavItem[] = [
  { label: "Home", href: "/branch/home", icon: icons.dashboard },
  { label: "Place Order", href: "/branch/order", icon: icons.placeOrder },
  { label: "Orders", href: "/branch/invoices", icon: icons.orders },
  { label: "Inventory", href: "/branch/inventory", icon: icons.stock },
  { label: "Catering", href: "/branch/catering", icon: icons.catering },
];

export function BranchShell({ children }: { children: ReactNode }) {
  const {profile}=useCurrentUser();
  const name=profile?.full_name??"Branch Manager";
  return (
    <AppShell
      entries={entries}
      footerEntries={[{label:"My Profile",href:"/branch/profile",icon:icons.profile}]}
      brandHref="/branch/home"
      user={{ name, role: "Branch Manager", initials: userInitials(name) }}
      mobileNav={<BottomNav items={bottomItems} />}
    >
      {children}
    </AppShell>
  );
}
