"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Banner } from "@/components/shared/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/shared/Spinner";
import { supabase } from "@/lib/supabase/client";
import { activeRole, safeNextPath } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
import { loadSessionProfile } from "@/features/workspaces/session";

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
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

      if (next === "/superadmin") {
        const permission = await supabase.rpc("platform_is_administrator");
        if (!permission.error && permission.data === true) { router.replace("/superadmin"); router.refresh(); return; }
        throw new Error("Platform access is required for this account.");
      }

      const { profile, error: profileError } = await loadSessionProfile(supabase, data.user.id);

      const role = activeRole(profileError ? null : profile);
      if (!role) {
        if (businessWorkspacesEnabled()) { router.replace("/workspaces"); router.refresh(); return; }
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("This account is not active. Contact your admin.");
      }
      router.replace(safeNextPath(next, role));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={next === "/superadmin" ? "Superadmin sign in" : "Welcome back"}
      subtitle={next === "/superadmin" ? "Sign in to manage businesses on the platform." : "Sign in to keep the kitchen moving."}
      showBrand={next !== "/superadmin"}
      brandName={next === "/superadmin" ? "Platform administration" : undefined}
    >
      {(activated || reset) && (
        <Banner tone="success" className="mb-4">
          {activated
            ? "Your account is ready. Sign in to continue."
            : "Password reset successfully. Sign in with your new password."}
        </Banner>
      )}
      {params.get("reason") === "account_inactive" && <Banner tone="danger" className="mb-4">This account is not active. Contact your admin.</Banner>}

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
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        <Button
          type="submit"
          size="sm"
          className="mx-auto flex h-10 w-full max-w-40 px-4 sm:h-9"
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
