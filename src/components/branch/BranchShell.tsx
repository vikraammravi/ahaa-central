"use client";

import { ReactNode } from "react";
import {
  Home,
  ShoppingBag,
  CalendarDays,
  FileText,
  MoreHorizontal,
  Bell,
} from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { BottomNav, type BottomNavItem } from "@/components/shared/BottomNav";
import type { NavEntry } from "@/components/shared/SidebarNav";

const entries: NavEntry[] = [
  { label: "Home", href: "/branch/home", icon: Home },
  { label: "New Kitchen Order", href: "/branch/order", icon: ShoppingBag },
  { label: "Kitchen Orders", href: "/branch/invoices", icon: FileText },
  { label: "Catering", href: "/branch/catering", icon: CalendarDays },
  { label: "Notifications", href: "/branch/notifications", icon: Bell },
  { label: "Profile", href: "/branch/profile", icon: MoreHorizontal },
];

const bottomItems: BottomNavItem[] = [
  { label: "Home", href: "/branch/home", icon: Home },
  { label: "Order", href: "/branch/order", icon: ShoppingBag },
  { label: "Kitchen", href: "/branch/invoices", icon: FileText },
  { label: "Catering", href: "/branch/catering", icon: CalendarDays },
  { label: "More", href: "/branch/profile", icon: MoreHorizontal },
];

export function BranchShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      entries={entries}
      brandHref="/branch/home"
      user={{ name: "Arun R.", role: "Branch Manager · Aaha Oshawa", initials: "AR" }}
      mobileNav={<BottomNav items={bottomItems} />}
    >
      {children}
    </AppShell>
  );
}
