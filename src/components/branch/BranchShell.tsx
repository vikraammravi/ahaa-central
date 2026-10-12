"use client";

import { ReactNode } from "react";
import {
  Home,
  ShoppingBag,
  CalendarDays,
  FileText,
  MoreHorizontal,
  ClipboardList,
} from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { BottomNav, type BottomNavItem } from "@/components/shared/BottomNav";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { userInitials } from "@/lib/auth";
import type { NavEntry } from "@/components/shared/SidebarNav";

const entries: NavEntry[] = [
  { label: "Home", href: "/branch/home", icon: Home },
  { label: "Place Order", href: "/branch/order", icon: ShoppingBag },
  { label: "Orders", href: "/branch/invoices", icon: FileText },
  { label: "Inventory", href: "/branch/inventory", icon: ClipboardList },
  { label: "Catering", href: "/branch/catering", icon: CalendarDays },
  { label: "Profile", href: "/branch/profile", icon: MoreHorizontal },
];

const bottomItems: BottomNavItem[] = [
  { label: "Home", href: "/branch/home", icon: Home },
  { label: "Place Order", href: "/branch/order", icon: ShoppingBag },
  { label: "Orders", href: "/branch/invoices", icon: FileText },
  { label: "Catering", href: "/branch/catering", icon: CalendarDays },
  { label: "More", href: "/branch/profile", icon: MoreHorizontal },
];

export function BranchShell({ children }: { children: ReactNode }) {
  const {profile}=useCurrentUser();
  const name=profile?.full_name??"Branch Manager";
  return (
    <AppShell
      entries={entries}
      brandHref="/branch/home"
      user={{ name, role: "Branch Manager", initials: userInitials(name) }}
      mobileNav={<BottomNav items={bottomItems} />}
    >
      {children}
    </AppShell>
  );
}
