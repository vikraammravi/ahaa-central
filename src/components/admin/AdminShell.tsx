"use client";

import { ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  BookOpen,
  ShoppingCart,
  Truck,
  Building2,
  Users,
  Receipt,
  BarChart3,
  Bell,
  Settings,
} from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import type { NavEntry } from "@/components/shared/SidebarNav";

const entries: NavEntry[] = [
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
      { label: "Dispatch", href: "/admin/dispatch", icon: Truck },
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
      { label: "Reports", href: "/admin/reports", icon: BarChart3 },
    ],
  },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      entries={entries}
      brandHref="/admin/dashboard"
      user={{ name: "Vikram K.", role: "Central Admin", initials: "VK" }}
    >
      {children}
    </AppShell>
  );
}
