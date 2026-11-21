"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Banner } from "@/components/shared/Banner";
import { assignBusinessOwner, inviteBusinessOwner, type PlatformBusiness } from "../data";

type Mode = "invite" | "existing";
export type AdminDialogRequest = { business: PlatformBusiness; name?: string; email?: string };

/**
 * First-admin setup for a business in setup. Inviting a new admin is the default;
 * an existing account (for example someone who already uses another business) can be assigned instead.
 */
export function InitialAdminDialog({ request, allowInvite = false, allowExisting = false, onClose, onAssigned, onInvited }: {
  request: AdminDialogRequest | null;
  allowInvite?: boolean;
  allowExisting?: boolean;
  onClose: () => void;
  onAssigned: () => void;
  onInvited: () => void;
}) {
  const business = request?.business ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [invitation, setInvitation] = useState<{ invitationUrl: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const activeMode: Mode = mode ?? (allowInvite ? "invite" : "existing");

  function close() {
    if (busy) return;
    const issued = invitation !== null;
    setError(""); setMode(null); setInvitation(null); setCopied(false);
    onClose();
    if (issued) onInvited();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") || "").trim();
    setBusy(true); setError("");
    try {
      if (activeMode === "invite") {
        setInvitation(await inviteBusinessOwner(business.id, String(values.get("name") || ""), email));
        setCopied(false);
      } else {
        await assignBusinessOwner(business.id, email);
        setMode(null); onAssigned();
      }
    }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to set up the admin."); }
    finally { setBusy(false); }
  }
  async function copy() {
    if (!invitation) return;
    if (!navigator.clipboard?.writeText) { setError("Copy unavailable. Select the link and copy it manually."); return; }
    try { await navigator.clipboard.writeText(invitation.invitationUrl); setCopied(true); setError(""); }
    catch { setError("Copy failed. Select the link and copy it manually."); }
  }

  const reissue = Boolean(request?.email);
  return <Dialog open={business !== null} onOpenChange={open => { if (!open) close(); }}>
    <DialogContent
      className="sm:max-w-md"
      showCloseButton={invitation === null}
      // The one-time link cannot be shown again: only "Done" closes the dialog once it is visible.
      onInteractOutside={event => { if (invitation) event.preventDefault(); }}
      onEscapeKeyDown={event => { if (invitation) event.preventDefault(); }}
    >
      <DialogHeader>
        <DialogTitle>{reissue ? "Reissue invitation" : "Set up first admin"}</DialogTitle>
        <DialogDescription>{business?.name} stays in setup until you activate it. No email is sent; share the link privately.</DialogDescription>
      </DialogHeader>
      {invitation ? <div className="space-y-3">
        <p className="text-sm">Share this one-time link with the intended admin. It expires in 24 hours. Copy it now; it won’t be shown again.{reissue && " Any earlier link no longer works."}</p>
        <Label htmlFor="invitation-link">Invitation link</Label>
        <Input id="invitation-link" readOnly value={invitation.invitationUrl} onFocus={event => event.currentTarget.select()} />
        {error && <Banner tone="danger">{error}</Banner>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</Button>
          <Button type="button" onClick={close}>Done</Button>
        </div>
      </div> : <>
        {allowInvite && allowExisting && !reissue && <div className="flex flex-wrap gap-2" role="group" aria-label="Admin setup method">
          <Button type="button" variant={activeMode === "invite" ? "default" : "outline"} aria-pressed={activeMode === "invite"} disabled={busy} onClick={() => { setMode("invite"); setError(""); }}>Invite new admin</Button>
          <Button type="button" variant={activeMode === "existing" ? "default" : "outline"} aria-pressed={activeMode === "existing"} disabled={busy} onClick={() => { setMode("existing"); setError(""); }}>Existing account</Button>
        </div>}
        <form key={`${business?.id}-${activeMode}`} onSubmit={submit} className="space-y-4">
          {error && <Banner tone="danger">{error}</Banner>}
          {activeMode === "invite" && <div className="space-y-2"><Label htmlFor="initial-admin-name">Admin name</Label><Input id="initial-admin-name" name="name" maxLength={200} required disabled={busy} defaultValue={request?.name} /></div>}
          <div className="space-y-2"><Label htmlFor="initial-admin-email">Admin email</Label><Input id="initial-admin-email" name="email" type="email" maxLength={254} required disabled={busy} defaultValue={request?.email} /></div>
          {activeMode === "existing" && <p className="text-xs text-muted-foreground">The account must already exist and be active.</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : activeMode === "invite" ? "Create invitation" : "Assign admin"}</Button>
        </form>
      </>}
    </DialogContent>
  </Dialog>;
}
