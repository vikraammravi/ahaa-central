import { expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { CurrentUserProvider, useCurrentUser } from "./useCurrentUser";
import { db, queryResult } from "@tests/mocks/supabase";
import { profile } from "@tests/mocks/fixtures";
import { businessWorkspace, otherBusinessId, workspaceProfile } from "@tests/mocks/workspaces";
function Reader({label}:{label:string}) { const user=useCurrentUser(); return <p>{label}: {user.loading ? "loading" : user.profile?.full_name ?? "signed out"}</p>; }
it("remounts user-scoped page state when the authorized business changes",async()=>{
 vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED","true");
 db.auth.getUser.mockResolvedValue({data:{user:{id:workspaceProfile.id}},error:null});
 db.rpc.mockReturnValue(queryResult(businessWorkspace));
 function Draft(){const [value,setValue]=useState("draft");return <input aria-label="Workspace draft" value={value} onChange={e=>setValue(e.target.value)}/>;}
 render(<CurrentUserProvider><Draft/></CurrentUserProvider>);
 const initial=await screen.findByLabelText("Workspace draft");
 db.rpc.mockReturnValue(queryResult({...businessWorkspace,business:{...businessWorkspace.business,id:otherBusinessId}}));
 act(()=>window.dispatchEvent(new Event("focus")));
 await waitFor(()=>expect(screen.getByLabelText("Workspace draft")).not.toBe(initial));
 expect(db.from).not.toHaveBeenCalled();
});
it("shares one user/profile fetch between a shell and page",async()=>{
 db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});db.from.mockReturnValue(queryResult(profile));
 render(<CurrentUserProvider><Reader label="shell"/><Reader label="page"/></CurrentUserProvider>);
 await screen.findByText("page: Test Manager");
 expect(screen.getByText("shell: Test Manager")).toBeVisible();
 expect(db.auth.getUser).toHaveBeenCalledTimes(1);expect(db.from).toHaveBeenCalledTimes(1);
});
it("clears shared profile on sign-out and ignores the previous in-flight response",async()=>{
 let event!: (event: AuthChangeEvent, session: Session | null) => void;
 let finish!: (value: unknown) => void;
 db.auth.onAuthStateChange.mockImplementation(cb=>{event=cb;return {data:{subscription:{unsubscribe:vi.fn()}}};});
 db.auth.getUser.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 render(<CurrentUserProvider><Reader label="page"/></CurrentUserProvider>);
 await act(async()=>event("SIGNED_OUT",null));
 expect(screen.getByText("page: signed out")).toBeVisible();
 await act(async()=>finish({data:{user:{id:profile.id}},error:null}));
 expect(db.from).not.toHaveBeenCalled();
 expect(screen.getByText("page: signed out")).toBeVisible();
});
it("supports standalone consumers and refreshes profile changes on focus",async()=>{
 db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});db.from.mockReturnValue(queryResult(profile));
 const {result}=renderHook(()=>useCurrentUser());await waitFor(()=>expect(result.current.profile?.full_name).toBe(profile.full_name));
 db.from.mockReturnValue(queryResult({...profile,full_name:"Updated Manager"}));
 act(()=>window.dispatchEvent(new Event("focus")));
 await waitFor(()=>expect(result.current.profile?.full_name).toBe("Updated Manager"));
});

it("does not unmount unsaved form state on a same-user auth refresh",async()=>{
 let event!: (event: AuthChangeEvent, session: Session | null) => void;
 db.auth.onAuthStateChange.mockImplementation(cb=>{event=cb;return {data:{subscription:{unsubscribe:vi.fn()}}};});
 db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});db.from.mockReturnValue(queryResult(profile));
 function Draft(){const [value,setValue]=useState("draft");return <input aria-label="Unsaved draft" value={value} onChange={e=>setValue(e.target.value)}/>;}
 render(<CurrentUserProvider><Draft/></CurrentUserProvider>);
 const input=await screen.findByLabelText("Unsaved draft");
 await act(async()=>event("SIGNED_IN",{user:{id:profile.id}} as Session));
 await waitFor(()=>expect(db.auth.getUser).toHaveBeenCalledTimes(2));
 expect(screen.getByLabelText("Unsaved draft")).toBe(input);
});
