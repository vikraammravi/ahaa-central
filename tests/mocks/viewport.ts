import { vi } from "vitest";

export function mockViewport(width:number) {
  vi.mocked(window.matchMedia).mockImplementation(query=>({
    matches:width<=Number(query.match(/max-width:\s*(\d+)px/)?.[1]??0),
    media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),
    addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn(),
  }));
}
