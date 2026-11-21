"use client";
import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Clock, LayoutDashboard, MailPlus, Plus, RefreshCw, Search, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banner } from "@/components/shared/Banner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingState } from "@/components/shared/Spinner";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { useAsyncData } from "@/lib/useAsyncData";
import { cn } from "@/lib/utils";
import { activateBusiness, attentionItems, fetchBusinesses, invitationStatus, resolveBusinessInvitation, revokeBusinessInvitation, type AttentionReason, type PlatformBusiness } from "../data";
import { BusinessCard, StatusPill, type BusinessActions } from "./BusinessCard";
import { InitialAdminDialog, type AdminDialogRequest } from "./InitialAdminDialog";
import { PlatformBrand } from "./PlatformBrand";
import { RegisterBusinessDialog } from "./RegisterBusinessDialog";

type Flags = { registrationEnabled?: boolean; ownerAssignmentEnabled?: boolean; invitationsEnabled?: boolean; activationEnabled?: boolean; businessAppOrigin?: string | null };
type View = "overview" | "businesses";
type Filter = "all" | "active" | "setup" | "attention";

const NAV: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "overview", label: "Overview", icon: LayoutDashboard },
  { view: "businesses", label: "Businesses", icon: Building2 },
];
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "setup", label: "In setup" },
  { value: "attention", label: "Needs attention" },
];
const ATTENTION: Record<AttentionReason, { title: string; icon: typeof Clock; tone: string }> = {
  interrupted: { title: "Setup was interrupted", icon: AlertTriangle, tone: "text-red-600 bg-red-50" },
  ready: { title: "Admin ready — activate the business", icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
  expired: { title: "Invitation expired", icon: Clock, tone: "text-amber-600 bg-amber-50" },
  expiring: { title: "Invitation expires within 6 hours", icon: Clock, tone: "text-amber-600 bg-amber-50" },
  "no-admin": { title: "No admin invited yet", icon: UserPlus, tone: "text-indigo-600 bg-indigo-50" },
};

function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return <div className="rounded-xl border bg-card p-4 shadow-xs">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>;
}

function Panel({ title, description, action, children, id }: { title: string; description?: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return <section aria-label={title} id={id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
    {children}
  </section>;
}

export default function PlatformConsole({ registrationEnabled = false, ownerAssignmentEnabled = false, invitationsEnabled = false, activationEnabled = false, businessAppOrigin = null }: Flags) {
  const list = useAsyncData(fetchBusinesses);
  const businesses = list.data?.businesses;
  const statusUnknown = list.data?.invitationsUnavailable === true;
  const [view, setView] = useState<View>("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState("");
  const [adminRequest, setAdminRequest] = useState<AdminDialogRequest | null>(null);
  const [activating, setActivating] = useState<PlatformBusiness | null>(null);
  const [revoking, setRevoking] = useState<PlatformBusiness | null>(null);
  const [resolving, setResolving] = useState<PlatformBusiness | null>(null);

  const actions: BusinessActions = {
    inviteEnabled: registrationEnabled && invitationsEnabled,
    assignEnabled: registrationEnabled && ownerAssignmentEnabled,
    activationEnabled: registrationEnabled && activationEnabled,
    invitationStatusUnknown: statusUnknown,
    businessAppOrigin,
    onSetUpAdmin: business => setAdminRequest({ business }),
    onReissue: business => setAdminRequest({ business, name: business.invitation?.name, email: business.invitation?.email }),
    onRevoke: business => setRevoking(business),
    onActivate: business => setActivating(business),
    onResolve: business => setResolving(business),
  };

  const attention = useMemo(() => attentionItems(businesses ?? [], undefined, statusUnknown), [businesses, statusUnknown]);
  const attentionIds = useMemo(() => new Set(attention.map(item => item.business.id)), [attention]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (businesses ?? []).filter(business =>
      (!term || business.name.toLowerCase().includes(term) || business.slug.includes(term))
      && (filter === "all"
        || (filter === "active" && business.status === "active")
        || (filter === "setup" && business.status === "provisioning")
        || (filter === "attention" && attentionIds.has(business.id))));
  }, [businesses, query, filter, attentionIds]);
  const counts = useMemo(() => {
    const all = businesses ?? [];
    const inSetup = all.filter(business => business.status === "provisioning");
    return {
      total: all.length,
      active: all.filter(business => business.status === "active").length,
      inSetup: inSetup.length,
      awaitingAdmin: inSetup.filter(business => !business.owner_assigned).length,
      pendingInvites: statusUnknown ? 0 : all.filter(business => invitationStatus(business.invitation) === "pending").length,
    };
  }, [businesses, statusUnknown]);

  async function activate() {
    if (!activating) return;
    await activateBusiness(activating.id);
    setNotice(`${activating.name} is active. Its admin can now sign in to the business application.`);
    await list.refresh(true);
  }
  async function resolve() {
    if (!resolving) return;
    const outcome = await resolveBusinessInvitation(resolving.id);
    setNotice(outcome === "completed"
      ? `The admin account for ${resolving.name} was finished. Review it, then activate the business.`
      : `The interrupted invitation for ${resolving.name} was cancelled. Issue a new link to continue.`);
    await list.refresh(true);
  }
  async function revoke() {
    if (!revoking) return;
    await revokeBusinessInvitation(revoking.id);
    setNotice(`The invitation for ${revoking.name} no longer works.`);
    await list.refresh(true);
  }
  function attentionAction(item: { business: PlatformBusiness; reason: AttentionReason }) {
    const { business, reason } = item;
    if (reason === "interrupted" && actions.inviteEnabled) return <Button size="sm" variant="outline" onClick={() => actions.onResolve(business)}>Resolve</Button>;
    if (reason === "ready" && actions.activationEnabled) return <Button size="sm" onClick={() => actions.onActivate(business)}>Activate</Button>;
    if (reason === "expiring" && actions.inviteEnabled) return <Button size="sm" variant="outline" onClick={() => actions.onReissue(business)}>Reissue</Button>;
    if ((reason === "expired" || reason === "no-admin") && (actions.inviteEnabled || actions.assignEnabled)) return <Button size="sm" variant="outline" onClick={() => actions.onSetUpAdmin(business)}>{actions.inviteEnabled ? "Invite" : "Assign"}</Button>;
    return null;
  }

  const heading = view === "overview" ? { title: "Overview", subtitle: "Onboarding health across every business on the platform." } : { title: "Businesses", subtitle: "Register businesses, invite their first admin and activate them." };

  return <div className="flex min-h-screen flex-col bg-background lg:flex-row">
    <aside className="flex flex-col bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0">
      <div className="flex items-center justify-between gap-3 px-4 py-4 lg:px-5 lg:py-5">
        <PlatformBrand tone="inverse" subtitle="Superadmin" />
        <div className="lg:hidden"><SignOutButton variant="compact" /></div>
      </div>
      <nav aria-label="Platform navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
        {NAV.map(item => <button key={item.view} type="button" aria-current={view === item.view ? "page" : undefined} onClick={() => setView(item.view)}
          className={cn("flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors", view === item.view ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-slate-400 hover:bg-sidebar-accent/60 hover:text-white")}>
          <item.icon className="size-4" aria-hidden />{item.label}
          {item.view === "businesses" && attention.length > 0 && <span className="ml-auto rounded-full bg-indigo-500/20 px-1.5 text-[11px] font-semibold text-indigo-200">{attention.length}</span>}
        </button>)}
      </nav>
      <div className="mt-auto hidden border-t border-sidebar-border p-4 lg:block">
        <p className="mb-3 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="size-3.5" aria-hidden />Platform access only — no customer data.</p>
        <SignOutButton variant="compact" />
      </div>
    </aside>

    <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{heading.title}</h1>
            <p className="text-sm text-muted-foreground">{heading.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {businessAppOrigin && <Button asChild variant="ghost" size="sm"><a href={`${businessAppOrigin}/workspaces`}>Business app<ArrowRight className="size-3.5" /></a></Button>}
            <Button variant="outline" size="sm" onClick={() => void list.refresh(true)} disabled={list.loading} aria-label="Refresh"><RefreshCw className={cn("size-4", list.loading && "animate-spin")} /><span className="hidden sm:inline">Refresh</span></Button>
            {registrationEnabled && <Button size="sm" onClick={() => setRegistering(true)}><Plus className="size-4" />Add business</Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {!registrationEnabled && <Banner tone="info">Business registration is not enabled in this environment. You can review the business directory.</Banner>}
        {notice && <Banner tone="success">{notice}</Banner>}
        {statusUnknown && <Banner tone="info">Invitation status is temporarily unavailable, so admin setup is paused to avoid replacing a link already shared. Refresh to try again.</Banner>}
        {list.error && <Banner tone="danger">{list.error}<Button variant="ghost" onClick={() => void list.refresh()}>Retry</Button></Banner>}

        {list.loading && !businesses ? <LoadingState label="Loading businesses…" /> : view === "overview" ? <>
          <section aria-label="Business overview" className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatTile label="Businesses" value={counts.total} />
            <StatTile label="Active" value={counts.active} />
            <StatTile label="In setup" value={counts.inSetup} />
            <StatTile label="Awaiting admin" value={counts.awaitingAdmin} />
            <StatTile label="Pending invites" value={counts.pendingInvites} />
          </section>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel title="Needs attention" description="Next onboarding steps, most urgent first.">
              {attention.length ? <ul className="divide-y">
                {attention.map(item => {
                  const meta = ATTENTION[item.reason];
                  return <li key={`${item.business.id}-${item.reason}`} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-lg", meta.tone)}><meta.icon className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.business.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{meta.title}</p>
                    </div>
                    {attentionAction(item)}
                  </li>;
                })}
              </ul> : <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <CheckCircle2 className="size-6 text-emerald-500" aria-hidden />
                <p className="text-sm font-medium">All caught up</p>
                <p className="text-xs text-muted-foreground">No business is waiting on a platform action.</p>
              </div>}
            </Panel>
            <Panel title="Recently added" action={<Button variant="ghost" size="sm" onClick={() => setView("businesses")}>View all<ArrowRight className="size-3.5" /></Button>}>
              {businesses?.length ? <ul className="divide-y">
                {[...businesses].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5).map(business => <li key={business.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{business.name}</p><p className="truncate font-mono text-xs text-muted-foreground">/{business.slug}</p></div>
                  <StatusPill status={business.status} />
                </li>)}
              </ul> : <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <MailPlus className="size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">No businesses registered yet.</p>
                {registrationEnabled && <Button size="sm" onClick={() => setRegistering(true)}><Plus className="size-4" />Add your first business</Button>}
              </div>}
            </Panel>
          </div>
        </> : <Panel id="businesses" title="Business directory" description={`${visible.length} of ${counts.total} businesses`}
            action={<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Search businesses" placeholder="Search name or address" value={query} onChange={event => setQuery(event.target.value)} className="h-9 pl-8" />
              </div>
              <div role="group" aria-label="Filter businesses" className="flex rounded-lg bg-muted p-0.5">
                {FILTERS.map(option => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}
                  className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", filter === option.value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>{option.label}</button>)}
              </div>
            </div>}>
          {visible.length ? <ul className="divide-y">{visible.map(business => <BusinessCard key={business.id} business={business} actions={actions} />)}</ul>
            : <p className="px-6 py-10 text-center text-sm text-muted-foreground">{counts.total ? "No businesses match these filters." : "No businesses registered yet."}</p>}
          {businesses?.length === 100 && <p className="border-t px-5 py-3 text-xs text-muted-foreground">Showing the first 100 businesses. Counts reflect this list.</p>}
        </Panel>}
      </main>
    </div>

    <RegisterBusinessDialog open={registering} onOpenChange={setRegistering} onRegistered={() => { setNotice("Business registered. Invite its first admin, then activate it."); setView("businesses"); void list.refresh(true); }} />
    <InitialAdminDialog
      request={adminRequest}
      allowInvite={actions.inviteEnabled}
      allowExisting={actions.assignEnabled}
      onClose={() => setAdminRequest(null)}
      onInvited={() => { setNotice("Invitation created. The business stays in setup until the admin accepts and you activate it."); void list.refresh(true); }}
      onAssigned={() => { setAdminRequest(null); setNotice("Admin assigned. The business remains in setup until you activate it."); void list.refresh(true); }}
    />
    <ConfirmDialog open={activating !== null} onOpenChange={open => { if (!open) setActivating(null); }} title="Activate business"
      description={activating ? `Activate ${activating.name} so its admin can sign in and set up the business.` : undefined} confirmLabel="Activate" tone="default" onConfirm={activate} />
    <ConfirmDialog open={revoking !== null} onOpenChange={open => { if (!open) setRevoking(null); }} title="Revoke invitation"
      description={revoking?.invitation && invitationStatus(revoking.invitation) === "pending" ? `The link sent to ${revoking.invitation.email} will stop working. You can issue a new one afterwards.` : undefined} confirmLabel="Revoke" onConfirm={revoke} />
    <ConfirmDialog open={resolving !== null} onOpenChange={open => { if (!open) setResolving(null); }} title="Resolve interrupted setup"
      description={resolving?.invitation ? `If ${resolving.invitation.email} already created their login, their admin setup is finished. Otherwise the invitation is cancelled and you can issue a new link.` : undefined} confirmLabel="Resolve" tone="default" onConfirm={resolve} />
  </div>;
}
