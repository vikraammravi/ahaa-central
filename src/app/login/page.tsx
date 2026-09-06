"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Banner } from "@/components/shared/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/shared/Spinner";
import { supabase } from "@/lib/supabase/client";

function LoginInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activated = params.get("activated") === "1";
  const reset = params.get("reset") === "1";
  const next = params.get("next");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", data.user.id)
        .single();

      if (profileError) throw profileError;
      if (profile.status === "disabled") {
        throw new Error("This account has been disabled. Contact your admin.");
      }

      const dest =
        next ??
        (profile.role === "CENTRAL_ADMIN"
          ? "/admin/dashboard"
          : "/branch/home");

      // Hard navigation guarantees the auth cookies are read fresh by middleware.
      window.location.assign(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to keep the kitchen moving."
      footer={
        <>
          Got an invitation?{" "}
          <Link
            href="/activate-account"
            className="text-saffron-hover font-medium"
          >
            Activate account
          </Link>
        </>
      }
    >
      {(activated || reset) && (
        <Banner tone="success" className="mb-4">
          {activated
            ? "Your account is ready. Sign in to continue."
            : "Password reset successfully. Sign in with your new password."}
        </Banner>
      )}

      {error && (
        <Banner tone="danger" className="mb-4">
          {error}
        </Banner>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@aaha.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-saffron-hover"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          {submitting && <Spinner size="xs" className="text-primary-foreground" />}
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
