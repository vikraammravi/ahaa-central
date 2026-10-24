"use client";
import { navigationIcons as icons } from "@/lib/navigation-icons";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { BottomNav } from "@/components/shared/BottomNav";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { userInitials } from "@/lib/auth";
const items=[{label:"Daily Inventory",href:"/employee/inventory",icon:icons.stock},{label:"Catering",href:"/employee/catering",icon:icons.catering},{label:"My Profile",href:"/employee/profile",icon:icons.profile}];
export function EmployeeShell({children}:{children:ReactNode}){const {profile}=useCurrentUser();const name=profile?.full_name??"Employee";return <AppShell entries={items.slice(0,2)} footerEntries={[items[2]]} brandHref="/employee/inventory" user={{name,role:"Branch Employee",initials:userInitials(name)}} mobileNav={<BottomNav items={items}/>}>{children}</AppShell>;}
