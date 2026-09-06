"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, FormEvent } from "react";
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    router.push(c.next);
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
            placeholder="At least 8 characters"
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
            required
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div className="text-xs text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full">
          {c.cta}
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
