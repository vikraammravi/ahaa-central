"use client";

import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Variant = "row" | "icon" | "compact";

export function SignOutButton({
  variant = "row",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  async function handleSignOut() {
    await supabase.auth.signOut();
    // Hard nav so middleware sees the cleared session cookies.
    window.location.assign("/login");
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        aria-label="Sign out"
        className={cn(
          "inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-[#DC2626]",
          className,
        )}
      >
        <LogOut className="size-4" />
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-[#DC2626]",
          className,
        )}
      >
        <LogOut className="size-3.5" />
        Sign out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 hover:bg-muted rounded-lg text-[#DC2626]",
        className,
      )}
    >
      <LogOut className="size-4" />
      <span className="text-sm">Sign Out</span>
    </button>
  );
}
