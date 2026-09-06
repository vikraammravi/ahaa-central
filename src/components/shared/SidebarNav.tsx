"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

export type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

export function SidebarNav({
  entries,
  onNavigate,
  className,
}: {
  entries: NavEntry[];
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  const initialOpen: Record<string, boolean> = {};
  entries.forEach((e) => {
    if (isGroup(e)) initialOpen[e.label] = e.defaultOpen ?? true;
  });
  const [open, setOpen] = useState(initialOpen);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className={cn("py-3 px-2 text-sm", className)}>
      {entries.map((e) => {
        if (!isGroup(e)) {
          const active = isActive(e.href);
          const Icon = e.icon;
          return (
            <Link
              key={e.href}
              href={e.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[14px] transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {Icon && <Icon className="size-4" />}
              {e.label}
            </Link>
          );
        }
        const isOpen = open[e.label] ?? false;
        return (
          <div key={e.label} className="mt-1">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [e.label]: !isOpen }))}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <span>{e.label}</span>
              <span
                className={cn(
                  "text-[10px] transition-transform",
                  isOpen && "rotate-90",
                )}
              >
                ›
              </span>
            </button>
            {isOpen && (
              <div className="mt-0.5">
                {e.items.map((it) => {
                  const active = isActive(it.href);
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 pl-6 pr-3 py-2 rounded-lg text-[14px] transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {Icon && <Icon className="size-4" />}
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
