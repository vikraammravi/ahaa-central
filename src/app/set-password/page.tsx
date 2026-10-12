"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Flow = "activate" | "reset";

const copy: Record<Flow, { title: string; subtitle: string; cta: string; next: string }> = {
  activate: {
    title: "Set your password",
    subtitle: "Choose a secure password to activate your account.",
    cta: "Continue",
    next: "/login?activated=1",
  },
  reset: {
    title: "Reset your password",
    subtitle: "Choose a new password for your account.",
    cta: "Reset Password",
    next: "/login?reset=1",
  },
};

function SetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const flow: Flow = params.get("flow") === "reset" ? "reset" : "activate";
  const c = copy[flow];

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;
    void supabase.auth.getUser().then(({data,error})=>{
      if(!active)return;
      setReady(!!data.user&&!error);
      if(!data.user||error)setError("This link is invalid or expired. Request a new password reset link.");
    });
    return()=>{active=false;};
  },[]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 12 || password.length > 128) {
      setError("Password must be 12–128 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);setError(null);
    try {
      const result=await supabase.auth.updateUser({password});
      if(result.error)throw result.error;
      const signedOut=await supabase.auth.signOut({scope:"global"});
      if(signedOut.error)throw new Error("Password updated. Please sign out and sign in with your new password.");
      router.replace(c.next);router.refresh();
    }catch(error){setError(error instanceof Error?error.message:"Unable to update password.");}
    finally{setBusy(false);}
  }

  return (
    <AuthShell title={c.title} subtitle={c.subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 12 characters"
            minLength={12}
            maxLength={128}
            disabled={!ready||busy}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={!ready||busy}
            required
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div className="text-xs text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {!ready&&<Link className="text-sm underline" href="/forgot-password">Request a new reset link</Link>}
        <Button type="submit" size="lg" className="w-full" disabled={!ready||busy}>
          {busy?"Updating…":c.cta}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordInner />
    </Suspense>
  );
}
