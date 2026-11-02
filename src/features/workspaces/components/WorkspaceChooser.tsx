"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { Banner } from "@/components/shared/Banner";
import { LoadingState } from "@/components/shared/Spinner";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { USER_ROLE_LABELS } from "@/features/users/domain";
import { useAsyncData } from "@/lib/useAsyncData";
import { userHome } from "@/lib/auth";
import { chooseWorkspace, fetchWorkspaceChoices } from "../data";

export default function WorkspaceChooser() {
  const router = useRouter();
  const list = useAsyncData(fetchWorkspaceChoices);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function open(id: string) {
    setBusy(id); setError("");
    try { const workspace = await chooseWorkspace(id); router.replace(userHome(workspace.profile.role)); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to open workspace."); setBusy(null); }
  }
  return <main className="mx-auto min-h-screen w-full max-w-4xl space-y-5 px-4 py-8 sm:px-6">
    <PageHeader title="Choose your workspace" subtitle="Your role and locations are specific to each business." />
    {(error || list.error) && <Banner tone="danger">{error || list.error}</Banner>}
    {list.loading ? <LoadingState label="Loading workspaces…" /> : <div className="grid gap-3 sm:grid-cols-2">
      {list.data?.map(choice => {
        const available = choice.status === "active" && choice.business_status === "active" && choice.isolation_ready;
        return <Card key={choice.business_id} className="min-w-0"><CardContent className="space-y-4 p-4">
          <div className="flex items-start gap-3"><Building2 className="mt-1 size-5 shrink-0 text-primary" /><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{choice.name}</h2><p className="text-sm text-muted-foreground">{USER_ROLE_LABELS[choice.role]}</p></div></div>
          {!available && <p className="text-sm text-muted-foreground">Access is not available. Contact your administrator.</p>}
          <Button className="w-full" disabled={!available || busy !== null} onClick={() => void open(choice.business_id)}>{busy === choice.business_id ? "Opening…" : "Open workspace"}</Button>
        </CardContent></Card>;
      })}
      {!list.data?.length && <p className="text-sm text-muted-foreground">No workspaces are assigned to this account. Contact your administrator.</p>}
    </div>}
    <SignOutButton variant="compact" />
  </main>;
}
