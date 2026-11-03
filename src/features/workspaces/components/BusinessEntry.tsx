"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Banner } from "@/components/shared/Banner";
import { LoadingState } from "@/components/shared/Spinner";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { USER_ROLE_LABELS } from "@/features/users/domain";
import { userHome } from "@/lib/auth";
import { useAsyncData } from "@/lib/useAsyncData";
import { chooseWorkspace, fetchWorkspaceChoices } from "../data";

export default function BusinessEntry({ slug }: { slug: string }) {
  const router = useRouter();
  const choices = useAsyncData(fetchWorkspaceChoices);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const business = choices.data?.find(choice => choice.slug === slug && choice.status === "active" && choice.business_status === "active" && choice.isolation_ready);
  async function open() {
    if (!business) return;
    setBusy(true); setError("");
    try { const selected = await chooseWorkspace(business.business_id); router.replace(userHome(selected.profile.role)); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to open this business."); setBusy(false); }
  }
  return <main className="mx-auto min-h-screen w-full max-w-lg space-y-5 px-4 py-10 sm:px-6">
    <div><h1 className="text-2xl font-semibold">Open business</h1><p className="mt-1 text-sm text-muted-foreground">Your account must have access to this business.</p></div>
    {(error || choices.error) && <Banner tone="danger">{error || choices.error}</Banner>}
    {choices.loading ? <LoadingState label="Checking access…" /> : business ? <Card><CardContent className="space-y-4 p-4">
      <div className="flex items-start gap-3"><Building2 className="mt-1 size-5 shrink-0 text-primary" /><div><h2 className="text-lg font-semibold">{business.name}</h2><p className="text-sm text-muted-foreground">{USER_ROLE_LABELS[business.role]}</p></div></div>
      <Button className="w-full" disabled={busy} onClick={() => void open()}>{busy ? "Opening…" : "Open business"}</Button>
    </CardContent></Card> : !choices.error && <p className="text-sm text-muted-foreground">This business is unavailable for your account. Contact your administrator.</p>}
    <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/workspaces">My workspaces</Link></Button><SignOutButton variant="compact" /></div>
  </main>;
}
