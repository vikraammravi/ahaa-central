import "@testing-library/jest-dom/vitest";
import { cleanup,render } from "@testing-library/react";
import { ConfirmationHost } from "@/components/shared/ConfirmationHost";
import { afterEach, beforeEach, vi } from "vitest";
import { db, router, queryResult } from "./mocks/supabase";

vi.mock("@/lib/supabase/client",()=>({supabase:db}));
vi.mock("next/navigation",()=>({useRouter:()=>router,usePathname:()=>"/admin/dashboard",useSearchParams:()=>new URLSearchParams()}));
// Use the real Link component; it renders an anchor without navigating in jsdom.
beforeEach(()=>{
  vi.resetAllMocks();
  db.from.mockReturnValue(queryResult([]));
  db.rpc.mockReturnValue(queryResult(null));
  db.auth.getUser.mockResolvedValue({data:{user:null},error:null});
  db.auth.signOut.mockResolvedValue({error:null});
  db.auth.updateUser.mockResolvedValue({error:null});
  db.auth.resetPasswordForEmail.mockResolvedValue({error:null});
  vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("Unexpected network request in UI tests")));
  Element.prototype.scrollIntoView=vi.fn();
  window.matchMedia=vi.fn().mockReturnValue({matches:false,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn()});
  render(<ConfirmationHost/>);
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
