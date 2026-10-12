"use client";

import Link from "next/link";
import { Suspense, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { Banner } from "@/components/shared/Banner";

function InvalidResetLink() {
  const params=useSearchParams();
  return params.get("error")==="invalid_link" ? <Banner tone="danger">This reset link is invalid or expired. Request a new one below.</Banner> : null;
}

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);setBusy(true);
    try {
      const result=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/auth/confirm`});
      if(result.error) throw result.error;
      setSent(true);
    } catch(error) {setError(error instanceof Error?error.message:"Unable to send a reset link. Try again.");}
    finally{setBusy(false);}
  }

  return (
    <AuthShell
      title={sent ? "Check your inbox" : "Forgot password?"}
      subtitle={
        sent
          ? "If an account exists for that email, we've sent a reset link."
          : "Enter the email associated with your account and we'll send a reset link."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-saffron-hover font-medium">
            Back to login
          </Link>
        </>
      }
    >
      {sent ? (
        <Link href="/login" className="block">
          <Button size="lg" className="w-full">
            Back to Login
          </Button>
        </Link>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Suspense><InvalidResetLink /></Suspense>
          {error&&<Banner tone="danger">{error}</Banner>}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@aaha.com"
              required
              autoComplete="email"
              value={email}
              onChange={event=>setEmail(event.target.value)}
              disabled={busy}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy?"Sending…":"Send Reset Link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
