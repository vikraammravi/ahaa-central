"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
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
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@aaha.com"
              required
              autoComplete="email"
            />
          </div>
          <Button type="submit" size="lg" className="w-full">
            Send Reset Link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
