"use client";

import { ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  BookOpen,
  ShoppingCart,
  Building2,
  Users,
  Receipt,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import type { NavEntry } from "@/components/shared/SidebarNav";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { userInitials } from "@/lib/auth";

const entries: NavEntry[] = [
  { label: "My Profile", href: "/admin/profile", icon: UserRound },
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Inventory Management",
    items: [
      { label: "Daily Stock", href: "/admin/stock", icon: Package },
      { label: "Catalog", href: "/admin/catalog", icon: BookOpen },
    ],
  },
  {
    label: "Order Management",
    items: [
      { label: "Branch Orders", href: "/admin/orders", icon: ShoppingCart },
    ],
  },
  {
    label: "Branch Management",
    items: [
      { label: "Branch List", href: "/admin/branches", icon: Building2 },
      { label: "Users & Access", href: "/admin/users", icon: Users },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Invoices", href: "/admin/invoices", icon: Receipt },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { profile, loading } = useCurrentUser();
  const name = profile?.full_name || profile?.email || (loading ? "Loading…" : "Central Admin");
  return (
    <AppShell
      entries={entries}
      brandHref="/admin/dashboard"
      user={{ name, role: "Central Admin", initials: loading ? "…" : userInitials(name) }}
    >
      {children}
    </AppShell>
  );
}
