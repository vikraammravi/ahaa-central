"use client";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { invitationStatus, type InvitationStatus, type PlatformBusiness } from "../data";

export type BusinessActions = {
  inviteEnabled: boolean;
  assignEnabled: boolean;
  activationEnabled: boolean;
  /** When invitation status could not be loaded, a live link may exist: block new admin setup. */
  invitationStatusUnknown: boolean;
  businessAppOrigin: string | null;
  onSetUpAdmin: (business: PlatformBusiness) => void;
  onReissue: (business: PlatformBusiness) => void;
  onRevoke: (business: PlatformBusiness) => void;
  onActivate: (business: PlatformBusiness) => void;
  onResolve: (business: PlatformBusiness) => void;
};

const BUSINESS_STATUS: Record<PlatformBusiness["status"], { label: string; className: string; dot: string }> = {
  provisioning: { label: "In setup", className: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  active: { label: "Active", className: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  suspended: { label: "Suspended", className: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
};

export function StatusPill({ status }: { status: PlatformBusiness["status"] }) {
  const style = BUSINESS_STATUS[status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", style.className)}>
    <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />{style.label}
  </span>;
}

function adminStep(business: PlatformBusiness, invite: InvitationStatus): { done: boolean; text: string; tone?: "warn" | "danger" } {
  if (business.owner_assigned) return { done: true, text: invite === "accepted" ? "Admin accepted invitation" : "Admin assigned" };
  const invitation = business.invitation;
  switch (invite) {
    case "pending": return { done: false, text: `Invited ${invitation!.email} · expires ${formatDateTime(invitation!.expires_at)}` };
    case "expired": return { done: false, text: `Invitation to ${invitation!.email} expired`, tone: "warn" };
    case "review": return { done: false, text: `Setup by ${invitation!.email} was interrupted. Resolve it to continue.`, tone: "danger" };
    case "revoked": return { done: false, text: "Invitation revoked" };
    default: return { done: false, text: "No admin yet" };
  }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join("") || "?";
}

/** One business in the platform directory: identity, status, onboarding progress and the next action. */
export function BusinessCard({ business, actions }: { business: PlatformBusiness; actions: BusinessActions }) {
  const invite = invitationStatus(business.invitation);
  const inSetup = business.status === "provisioning" && !business.isolation_ready;
  const statusUnknown = actions.invitationStatusUnknown && inSetup && !business.owner_assigned;
  const admin = statusUnknown ? { done: false, text: "Invitation status unavailable", tone: "warn" as const } : adminStep(business, invite);
  const canSetUpAdmin = inSetup && !business.owner_assigned && !statusUnknown && invite !== "pending" && invite !== "review" && (actions.inviteEnabled || actions.assignEnabled);
  const canManageInvite = inSetup && !business.owner_assigned && invite === "pending" && actions.inviteEnabled;
  const canResolve = inSetup && !business.owner_assigned && !statusUnknown && invite === "review" && actions.inviteEnabled;
  const canActivate = inSetup && business.owner_assigned && actions.activationEnabled;
  const steps = [
    { label: "Registered", done: true },
    { label: "Admin ready", done: admin.done },
    { label: "Activated", done: business.status === "active" },
  ];

  return <li className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_auto] md:items-center md:gap-6">
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground ring-1 ring-inset ring-border">{initials(business.name)}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{business.name}</h3>
          <StatusPill status={business.status} />
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground">/{business.slug}</p>
      </div>
    </div>

    <div className="min-w-0 space-y-1.5">
      {business.status === "provisioning"
        ? <>
            <ol aria-label={`Setup progress for ${business.name}`} className="flex flex-wrap items-center gap-1.5">
              {steps.map((step, index) => <li key={step.label} className="flex items-center gap-1.5">
                <span className={cn("grid size-4 place-items-center rounded-full ring-1 ring-inset", step.done ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-transparent ring-border")}>
                  <Check aria-hidden className="size-2.5" />
                </span>
                <span className={cn("whitespace-nowrap text-xs", step.done ? "text-foreground" : "text-muted-foreground")}><span className="sr-only">{step.done ? "Done: " : "To do: "}</span>{step.label}</span>
                {index < steps.length - 1 && <span aria-hidden className={cn("h-px w-4", step.done ? "bg-primary" : "bg-border")} />}
              </li>)}
            </ol>
            <p className={cn("truncate text-xs", admin.tone === "danger" ? "text-red-700" : admin.tone === "warn" ? "text-amber-700" : "text-muted-foreground")} title={admin.text}>{admin.text}</p>
          </>
        : <p className="text-xs text-muted-foreground">{business.status === "suspended" ? "Access suspended" : business.isolation_ready ? "Available to members" : "Existing access"}</p>}
    </div>

    <div className="flex flex-wrap items-center gap-2 md:justify-end">
      {canResolve && <Button size="sm" onClick={() => actions.onResolve(business)}>Resolve interrupted setup</Button>}
      {canActivate && <Button size="sm" onClick={() => actions.onActivate(business)}>Activate business</Button>}
      {canSetUpAdmin && <Button size="sm" variant={invite === "none" ? "default" : "outline"} onClick={() => actions.onSetUpAdmin(business)}>{actions.inviteEnabled ? "Invite first admin" : "Assign first admin"}</Button>}
      {canManageInvite && <>
        <Button size="sm" variant="outline" onClick={() => actions.onReissue(business)}>Reissue link</Button>
        <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => actions.onRevoke(business)}>Revoke</Button>
      </>}
      {business.status === "active" && business.isolation_ready && actions.businessAppOrigin && <Button asChild size="sm" variant="outline">
        <a href={`${actions.businessAppOrigin}/b/${encodeURIComponent(business.slug)}`}>Open business sign-in</a>
      </Button>}
    </div>
  </li>;
}
