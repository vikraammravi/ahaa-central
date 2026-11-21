"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Banner } from "@/components/shared/Banner";
import { registerBusiness } from "../data";

export function RegisterBusinessDialog({ open, onOpenChange, onRegistered }: { open: boolean; onOpenChange: (open: boolean) => void; onRegistered: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await registerBusiness(String(values.get("name")), String(values.get("slug")));
      onOpenChange(false); onRegistered();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to register business."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) { setError(""); onOpenChange(value); } }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Add business</DialogTitle>
        <DialogDescription>Register a separate customer business. It stays in setup until its first admin is ready and you activate it.</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        {error && <Banner tone="danger">{error}</Banner>}
        <div className="space-y-2"><Label htmlFor="business-name">Business name</Label><Input id="business-name" name="name" required maxLength={200} disabled={busy} /></div>
        <div className="space-y-2">
          <Label htmlFor="business-slug">Business address</Label>
          <Input id="business-slug" name="slug" required minLength={2} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="example-business" disabled={busy} />
          <p className="text-xs text-muted-foreground">A unique identifier using lowercase letters, numbers and hyphens.</p>
        </div>
        <Button className="w-full" type="submit" disabled={busy}>{busy ? "Registering…" : "Register business"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
