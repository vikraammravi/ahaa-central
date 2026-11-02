"use client";
import { createContext, createElement, Fragment, useContext, useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/shared/Spinner";
import { supabase } from "./supabase/client";
import type { Profile } from "./supabase/types";
import { loadSessionProfile } from "@/features/workspaces/session";
import type { Business } from "@/features/workspaces/context";
export type CurrentUser = { userId: string | null; profile: Profile | null; business?: Business | null; loading: boolean; error: string | null };
const initial: CurrentUser = { userId: null, profile: null, loading: true, error: null };
const signedOut: CurrentUser = { ...initial, loading: false };
const CurrentUserContext = createContext<CurrentUser | null>(null);
function useUserQuery(enabled: boolean): CurrentUser {
 const [state, setState] = useState<CurrentUser>(initial);
 useEffect(() => {
  if (!enabled) return;
  let active = true, generation = 0;
  let knownUserId: string | null = null;
  let controller: AbortController | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  async function refresh() {
   const request = ++generation;
   controller?.abort(); controller = new AbortController();
   const signal = controller.signal;
   try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!active || request !== generation) return;
    if (error || !user) { knownUserId = null; setState({ ...signedOut, error: error?.message ?? null }); return; }
    knownUserId = user.id;
    const result = await loadSessionProfile(supabase, user.id, signal);
    if (!active || request !== generation) return;
    setState({ userId: user.id, profile: result.profile, business: result.business, loading: false, error: result.error?.message ?? null });
   } catch (error) {
    if (active && request === generation) setState({ ...signedOut, error: error instanceof Error ? error.message : "Unable to load profile." });
   }
  }
  void refresh();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
   if (!active) return;
   if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") { timers.forEach(clearTimeout); timers.clear(); }
   if (event === "SIGNED_OUT") { ++generation; knownUserId = null; controller?.abort(); setState(signedOut); }
   else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
    // Defer Supabase queries until its auth callback has released its lock.
    ++generation; controller?.abort();
    if (event === "SIGNED_IN" && session?.user.id !== knownUserId) {
      knownUserId = session?.user.id ?? null;
      setState(initial);
    }
    const timer = setTimeout(() => { timers.delete(timer); if (active) void refresh(); }, 0);
    timers.add(timer);
   }
  });
  const onFocus = () => { if (!document.hidden) void refresh(); };
  window.addEventListener("focus", onFocus);
  return () => { active = false; ++generation; controller?.abort(); subscription.unsubscribe(); timers.forEach(clearTimeout); window.removeEventListener("focus", onFocus); };
 }, [enabled]);
 return state;
}
/** Protected layouts own one profile request shared by their shell and pages. */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
 const value = useUserQuery(true);
 return createElement(CurrentUserContext.Provider, { value }, value.loading
  ? createElement(LoadingState, { label: "Loading your workspace…", minHeight: "min-h-screen" })
  : createElement(Fragment, { key: `${value.userId ?? "signed-out"}:${value.business?.id ?? "legacy"}` }, children));
}
/** Standalone consumers retain their existing behavior outside a layout provider. */
export function useCurrentUser(): CurrentUser {
 const shared = useContext(CurrentUserContext);
 const fallback = useUserQuery(shared === null);
 return shared ?? fallback;
}
