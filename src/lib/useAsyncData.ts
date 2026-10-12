"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAsyncData<T>(load: (signal: AbortSignal) => Promise<T>, {
  pollInterval, enabled = true,
}: { pollInterval?: number; enabled?: boolean } = {}) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: enabled, error: null });
  const activeRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(async (quiet = false) => {
    if (!enabled) return null;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    if (!quiet) setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const data = await load(controller.signal);
      if (controller.signal.aborted) return null;
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      if (!controller.signal.aborted) setState((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : "Unable to load data." }));
      return null;
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, [load, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const initial = window.setTimeout(() => { void refresh(); }, 0);
    const update = () => { if (!document.hidden && !activeRequest.current) void refresh(true); };
    const timer = pollInterval ? window.setInterval(update, pollInterval) : undefined;
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(initial);
      if (timer) window.clearInterval(timer);
      activeRequest.current?.abort();
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh, enabled, pollInterval]);

  return { ...state, loading: enabled && state.loading, refresh };
}
