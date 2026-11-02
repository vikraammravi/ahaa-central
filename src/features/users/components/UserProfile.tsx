"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/PageHeader";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { ChangePasswordDialog } from "@/features/users/components/ChangePasswordDialog";
import { Banner } from "@/components/shared/Banner";
import { LoadingState } from "@/components/shared/Spinner";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useAsyncData } from "@/lib/useAsyncData";
import { supabase } from "@/lib/supabase/client";
import { userInitials } from "@/lib/auth";
import { USER_ROLE_LABELS } from "@/features/users/domain";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";

export function UserProfile() {
  const { profile, loading, error } = useCurrentUser();
  const branchId = profile?.location_id;
  const loadBranch = useCallback(async (signal: AbortSignal) => {
    const { data, error } = await supabase.from("locations").select("name")
      .eq("id", branchId!).abortSignal(signal).single();
    if (error) throw new Error(error.message);
    return data as { name: string };
  }, [branchId]);
  const branch = useAsyncData(loadBranch, { enabled: !!branchId });
  const name = profile?.full_name || "—";

  return <div className="max-w-[600px] mx-auto space-y-5">
    <PageHeader title="My Profile" subtitle="Your account details and password." />
    {(error || branch.error) && <Banner tone="danger">{error || branch.error}</Banner>}
    {loading ? <LoadingState label="Loading profile…" /> : <>
      <Card><CardContent className="p-5 flex items-center gap-4">
        <Avatar className="w-14 h-14 shrink-0"><AvatarFallback className="bg-accent text-accent-foreground text-sm font-semibold">{userInitials(profile?.full_name || "")}</AvatarFallback></Avatar>
        <div className="min-w-0"><p className="text-base font-semibold text-forest break-words">{name}</p><p className="text-xs text-muted-foreground">{profile ? USER_ROLE_LABELS[profile.role] : "—"}</p></div>
      </CardContent></Card>
      <Card><CardContent className="p-5">
        <dl className="space-y-4 text-sm">
          <div><dt className="text-xs text-muted-foreground">Name</dt><dd className="mt-1 font-medium break-words">{name}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-1 break-all">{profile?.email || "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Role</dt><dd className="mt-1">{profile ? USER_ROLE_LABELS[profile.role] : "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Branch</dt><dd className="mt-1">{profile?.role === "CENTRAL_ADMIN" ? "Central Kitchen" : branch.loading ? "Loading branch…" : branch.data?.name || "No branch assigned"}</dd></div>
        </dl>
      </CardContent></Card>
      <Card><CardContent className="p-2">{businessWorkspacesEnabled() && <Button variant="ghost" asChild className="w-full justify-start"><Link href="/workspaces">Switch workspace</Link></Button>}<ChangePasswordDialog /><SignOutButton /></CardContent></Card>
    </>}
  </div>;
}
