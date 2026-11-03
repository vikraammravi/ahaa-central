"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Building2, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Banner } from "@/components/shared/Banner";
import { LoadingState } from "@/components/shared/Spinner";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchBusinesses, registerBusiness, type PlatformBusiness } from "../data";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
import { InitialAdminDialog } from "./InitialAdminDialog";

export default function PlatformConsole({ registrationEnabled = false, newOwnerEnabled = false }: { registrationEnabled?: boolean; newOwnerEnabled?: boolean }) {
  const list = useAsyncData(fetchBusinesses);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ownerBusiness, setOwnerBusiness] = useState<PlatformBusiness | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await registerBusiness(String(values.get("name")), String(values.get("slug")));
      setOpen(false); setNotice("Business registered. Owner setup and activation are still required before users can access it.");
      await list.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to register business."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" />Platform administration</p><h1 className="mt-1 text-2xl font-semibold">Superadmin dashboard</h1></div>
      <div className="flex flex-wrap gap-2">{businessWorkspacesEnabled() && <Button asChild variant="outline"><Link href="/workspaces">My workspaces</Link></Button>}<SignOutButton variant="compact" /></div>
    </header>
    <p className="text-sm text-muted-foreground">Each business has its own users and operations. Platform access manages business setup; it does not open customer orders or invoices.</p>
    {!list.loading && list.data && <section aria-label="Business overview" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[["Registered businesses", list.data.length], ["In setup", list.data.filter(business => !business.isolation_ready || business.status === "provisioning").length], ["Suspended", list.data.filter(business => business.status === "suspended").length]].map(([label, count]) => <Card key={label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{count}</p></CardContent></Card>)}
    </section>}
    {!registrationEnabled && <Banner tone="info">Business registration is coming next. You can review the business directory here.</Banner>}
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Business directory</h2>{registrationEnabled && <Button onClick={() => { setError(""); setOpen(true); }}><Plus />Add business</Button>}</div>
    {notice && <Banner tone="success">{notice}</Banner>}
    {list.error && <Banner tone="danger">{list.error}<Button variant="ghost" onClick={() => void list.refresh()}>Retry</Button></Banner>}
    {list.loading ? <LoadingState label="Loading businesses…" /> : <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {list.data?.map(business => <Card key={business.id}><CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3"><Building2 className="mt-1 size-5 shrink-0 text-primary" /><div className="min-w-0"><h3 className="break-words text-lg font-semibold">{business.name}</h3><p className="break-all text-sm text-muted-foreground">{business.slug}</p></div></div>
        <dl className="space-y-2 text-sm"><div className="flex justify-between gap-2"><dt>Status</dt><dd className="capitalize">{business.status}</dd></div><div className="flex justify-between gap-2"><dt>Business access</dt><dd>{business.isolation_ready && business.status === "active" ? "Available to members" : "Setup pending"}</dd></div></dl>
        {business.status === "provisioning" && <p className="text-sm text-muted-foreground">First admin: {business.owner_assigned ? "Assigned" : "Not assigned"}</p>}
        {registrationEnabled && business.status === "provisioning" && !business.isolation_ready && !business.owner_assigned && <Button variant="outline" className="w-full" onClick={() => setOwnerBusiness(business)}>Assign first admin</Button>}
      </CardContent></Card>)}
      {!list.data?.length && !list.error && <p className="text-sm text-muted-foreground">No businesses registered yet.</p>}
    </div>}
    {!!list.data && list.data.length === 100 && <p className="text-sm text-muted-foreground">Showing the first 100 businesses. Summary counts reflect this list.</p>}
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add business</DialogTitle><DialogDescription>Register a separate customer business. It stays in setup until owner provisioning and isolation checks are complete.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={submit}>{error && <Banner tone="danger">{error}</Banner>}<div className="space-y-2"><Label htmlFor="business-name">Business name</Label><Input id="business-name" name="name" required maxLength={200} disabled={busy} /></div><div className="space-y-2"><Label htmlFor="business-slug">Business address</Label><Input id="business-slug" name="slug" required minLength={2} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="example-business" disabled={busy} /><p className="text-xs text-muted-foreground">A unique identifier using lowercase letters, numbers and hyphens.</p></div><Button className="w-full" type="submit" disabled={busy}>{busy ? "Registering…" : "Register business"}</Button></form>
    </DialogContent></Dialog>
    <InitialAdminDialog business={ownerBusiness} allowNewAccount={newOwnerEnabled} onClose={() => setOwnerBusiness(null)} onAssigned={() => {
      const assignedId = ownerBusiness?.id;
      list.mutate(current => current?.map(business => business.id === assignedId ? { ...business, owner_assigned: true } : business) ?? []);
      setOwnerBusiness(null); setNotice("Admin assigned. The business remains in setup until activation is available."); void list.refresh(true);
    }} />
  </main>;
}
