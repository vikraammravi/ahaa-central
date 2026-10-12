import { expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

it("search debounce waits before changing the query value",()=>{
  vi.useFakeTimers();const view=renderHook(({value})=>useDebouncedValue(value),{initialProps:{value:"old"}});view.rerender({value:"new"});expect(view.result.current).toBe("old");act(()=>{vi.advanceTimersByTime(300);});expect(view.result.current).toBe("new");
});
