"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Banner } from "@/components/shared/Banner";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { validateNewPassword } from "@/lib/passwords";

export default function AcceptInvitationPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    window.history.replaceState(null, "", window.location.pathname);
    setToken(value);
    setLoaded(true);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy) return;
    try { validateNewPassword(password, confirm); }
    catch (error) { setError(error instanceof Error ? error.message : "Check your password."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/onboarding/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }), cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to accept this invitation.");
      setToken(""); setPassword(""); setConfirm(""); setComplete(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to accept this invitation."); }
    finally { setBusy(false); }
  }
  return <AuthShell title="Set up your account" subtitle="Choose a password for your business admin account.">
    {complete ? <div className="space-y-4"><Banner tone="success">Your account is ready. Your platform administrator must activate the business before you can sign in.</Banner><Button asChild className="w-full"><Link href="/login">Go to sign in</Link></Button></div> : <form onSubmit={submit} className="space-y-4">
      {loaded && !token && <Banner tone="danger">This invitation link is invalid or expired. Ask your platform administrator for a new link.</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <div className="space-y-2"><Label htmlFor="new-password">New password</Label><PasswordInput id="new-password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required disabled={!token || busy} /></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><PasswordInput id="confirm-password" value={confirm} onChange={event => setConfirm(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required disabled={!token || busy} /></div>
      <Button type="submit" className="w-full" disabled={!token || busy}>{busy ? "Setting up…" : "Set password"}</Button>
    </form>}
  </AuthShell>;
}
