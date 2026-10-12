"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { validateNewPassword } from "@/lib/passwords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "./FormDialog";
import { FormField } from "./FormField";

export function ChangePasswordDialog() {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [current,setCurrent]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  function toggle(value:boolean){setOpen(value);if(!value){setCurrent("");setPassword("");setConfirm("");}}
  async function save(){
    validateNewPassword(password,confirm);
    if(!current)throw new Error("Enter your current password.");
    if(current===password)throw new Error("Choose a different new password.");
    const {error}=await supabase.auth.updateUser({password,current_password:current});
    if(error)throw error;
    setCurrent("");setPassword("");setConfirm("");
    const result=await supabase.auth.signOut({scope:"global"});
    if(result.error)throw new Error("Password updated. Please sign out and sign in with the new password.");
    router.replace("/login?reset=1");router.refresh();
  }
  return <>
    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>toggle(true)}><KeyRound className="size-4"/>Change Password</Button>
    {open&&<FormDialog open onOpenChange={toggle} title="Change Password" description="Enter your current password and a new one. You will sign in again after saving." submitLabel="Update Password" onSubmit={save}>
      <FormField label="Current Password" htmlFor="change-current" required><Input id="change-current" type="password" autoComplete="current-password" required value={current} onChange={event=>setCurrent(event.target.value)}/></FormField>
      <FormField label="New Password" htmlFor="change-new" required><Input id="change-new" type="password" autoComplete="new-password" required minLength={12} maxLength={128} placeholder="At least 12 characters" value={password} onChange={event=>setPassword(event.target.value)}/></FormField>
      <FormField label="Confirm New Password" htmlFor="change-confirm" required><Input id="change-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={event=>setConfirm(event.target.value)}/></FormField>
    </FormDialog>}
  </>;
}
