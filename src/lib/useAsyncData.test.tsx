import { expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAsyncData } from "@/lib/useAsyncData";

it("disabled queries never load",async()=>{
  const load=vi.fn();const {result}=renderHook(()=>useAsyncData(load,{enabled:false}));expect(result.current.loading).toBe(false);await act(async()=>{await result.current.refresh();});expect(load).not.toHaveBeenCalled();
});

it("query errors preserve data and can recover on retry",async()=>{
  const load=vi.fn().mockResolvedValueOnce("initial").mockRejectedValueOnce(new Error("Offline")).mockResolvedValue("updated");const {result}=renderHook(()=>useAsyncData(load));await waitFor(()=>expect(result.current.data).toBe("initial"));await act(async()=>{await result.current.refresh(true);});expect(result.current.data).toBe("initial");expect(result.current.error).toBe("Offline");await act(async()=>{await result.current.refresh();});expect(result.current.data).toBe("updated");expect(result.current.error).toBeNull();
});

it("query cleanup cancels the active request",async()=>{
  let signal:AbortSignal|undefined;const load=vi.fn((input:AbortSignal)=>{signal=input;return new Promise(()=>{});});const view=renderHook(()=>useAsyncData(load));await waitFor(()=>expect(load).toHaveBeenCalled());view.unmount();expect(signal?.aborted).toBe(true);
});
