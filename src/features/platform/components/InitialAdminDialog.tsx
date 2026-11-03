"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Banner } from "@/components/shared/Banner";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { assignBusinessOwner, createBusinessOwner, type PlatformBusiness } from "../data";

export function InitialAdminDialog({ business, allowNewAccount = false, onClose, onAssigned }: { business: PlatformBusiness | null; allowNewAccount?: boolean; onClose: () => void; onAssigned: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newAccount, setNewAccount] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") || "").trim();
    setBusy(true); setError("");
    try {
      if (newAccount && allowNewAccount) await createBusinessOwner(business.id, String(values.get("name") || ""), email, String(values.get("password") || ""));
      else await assignBusinessOwner(business.id, email);
      setNewAccount(false); onAssigned();
    }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to assign the admin."); }
    finally { setBusy(false); }
  }
  return <Dialog open={business !== null} onOpenChange={open => { if (!open && !busy) { setError(""); setNewAccount(false); onClose(); } }}>
    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Assign first admin</DialogTitle>
      <DialogDescription>Choose an admin for {business?.name}. No email is sent, and the business remains in setup.</DialogDescription></DialogHeader>
      {allowNewAccount && <div className="flex flex-wrap gap-2"><Button type="button" variant={!newAccount ? "default" : "outline"} disabled={busy} onClick={() => { setNewAccount(false); setError(""); }}>Existing account</Button><Button type="button" variant={newAccount ? "default" : "outline"} disabled={busy} onClick={() => { setNewAccount(true); setError(""); }}>New account</Button></div>}
      <form onSubmit={submit} className="space-y-4">{error && <Banner tone="danger">{error}</Banner>}
        {newAccount && <div className="space-y-2"><Label htmlFor="initial-admin-name">Admin name</Label><Input id="initial-admin-name" name="name" maxLength={200} required disabled={busy} /></div>}
        <div className="space-y-2"><Label htmlFor="initial-admin-email">Admin email</Label><Input id="initial-admin-email" name="email" type="email" maxLength={254} required disabled={busy} /></div>
        {newAccount && <div className="space-y-2"><Label htmlFor="initial-admin-password">Temporary password</Label><PasswordInput id="initial-admin-password" name="password" minLength={12} maxLength={128} required disabled={busy} autoComplete="new-password" /><p className="text-xs text-muted-foreground">Verify the admin’s email and share this securely. No email is sent.</p></div>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Assigning…" : "Assign admin"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
