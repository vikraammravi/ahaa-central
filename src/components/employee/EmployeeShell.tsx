"use client";
import { ClipboardList,User } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { BottomNav } from "@/components/shared/BottomNav";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { userInitials } from "@/lib/auth";
const items=[{label:"Daily Inventory",href:"/employee/inventory",icon:ClipboardList},{label:"My Account",href:"/employee/profile",icon:User}];
export function EmployeeShell({children}:{children:ReactNode}){const {profile}=useCurrentUser();const name=profile?.full_name??"Employee";return <AppShell entries={items} brandHref="/employee/inventory" user={{name,role:"Branch Employee",initials:userInitials(name)}} mobileNav={<BottomNav items={items}/>}>{children}</AppShell>;}
