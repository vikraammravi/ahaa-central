"use client";

import { ReactNode } from "react";
import { navigationIcons as icons } from "@/lib/navigation-icons";
import { AppShell } from "@/components/shared/AppShell";
import type { NavEntry } from "@/components/shared/SidebarNav";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { userInitials } from "@/lib/auth";

const entries: NavEntry[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: icons.dashboard,
  },
  {
    label: "Inventory Management",
    items: [
      { label: "Daily Stock", href: "/admin/stock", icon: icons.stock },
      { label: "Branch Stock", href: "/admin/branch-stock", icon: icons.branches },
      { label: "Catalog", href: "/admin/catalog", icon: icons.catalog },
    ],
  },
  {
    label: "Order Management",
    items: [
      { label: "Branch Orders", href: "/admin/orders", icon: icons.orders },
      { label: "Catering", href: "/admin/catering", icon: icons.catering },
    ],
  },
  {
    label: "Branch Management",
    items: [
      { label: "Branch List", href: "/admin/branches", icon: icons.branches },
      { label: "Users & Access", href: "/admin/users", icon: icons.users },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Invoices", href: "/admin/invoices", icon: icons.invoices },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { profile, loading } = useCurrentUser();
  const name = profile?.full_name || profile?.email || (loading ? "Loading…" : "Central Admin");
  return (
    <AppShell
      entries={entries}
      footerEntries={[{label:"My Profile",href:"/admin/profile",icon:icons.profile}]}
      brandHref="/admin/dashboard"
      user={{ name, role: "Central Admin", initials: loading ? "…" : userInitials(name) }}
    >
      {children}
    </AppShell>
  );
}
