"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";
import type { Profile } from "./supabase/types";

export type CurrentUser = {
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
};

/**
 * One-stop hook for "who's signed in and what's their profile".
 * Used anywhere a page needs the current user's role or branch (location_id).
 * RLS handles scoping — this hook just avoids repeating the fetch pattern.
 */
export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>({
    userId: null,
    profile: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u, error: ue } = await supabase.auth.getUser();
      if (ue || !u.user) {
        if (!cancelled) {
          setState({
            userId: null,
            profile: null,
            loading: false,
            error: ue?.message ?? null,
          });
        }
        return;
      }
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .single();
      if (cancelled) return;
      setState({
        userId: u.user.id,
        profile: (p as Profile) ?? null,
        loading: false,
        error: pe?.message ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
