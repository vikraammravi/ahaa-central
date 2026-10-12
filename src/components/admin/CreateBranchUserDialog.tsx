"use client";
import { FormSelect } from "@/components/shared/FormSelect";
import { USER_ROLE_LABELS, type BranchUserRole } from "@/lib/users";
import { useState } from "react";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";
import type { Location } from "@/lib/supabase/types";

export function CreateBranchUserDialog({locations,open,onOpenChange,onCreated}:{locations:Location[];open:boolean;onOpenChange:(open:boolean)=>void;onCreated:()=>void}) {
 const [role,setRole]=useState<BranchUserRole>("BRANCH_EMPLOYEE");
 const [fullName,setFullName]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [locationId,setLocationId]=useState("");
 async function submit(){const response=await fetch("/api/admin/branch-users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fullName,email,password,locationId,role})});const result=await response.json();if(!response.ok)throw new Error(result.error??"Unable to create branch user.");setPassword("");onCreated();}
 return <FormDialog open={open} onOpenChange={onOpenChange} title="Add Branch User" description={role==="BRANCH_EMPLOYEE"?"Employees can record daily inventory for their assigned branch. They cannot place orders or view invoices.":"Managers can place orders, view invoices and review employee inventory for their branch."} submitLabel="Create User" onSubmit={submit}>
 <FormField label="Role" htmlFor="new-user-role" required><FormSelect<BranchUserRole> id="new-user-role" value={role} onChange={setRole} options={[{value:"BRANCH_MANAGER",label:USER_ROLE_LABELS.BRANCH_MANAGER},{value:"BRANCH_EMPLOYEE",label:USER_ROLE_LABELS.BRANCH_EMPLOYEE}]}/></FormField>
 <FormField label="Full Name" htmlFor="employee-name" required><Input id="employee-name" value={fullName} onChange={e=>setFullName(e.target.value)} maxLength={200} required/></FormField>
 <FormField label="Email" htmlFor="employee-email" required><Input id="employee-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required/></FormField>
 <FormField label="Branch" htmlFor="employee-branch" required><select id="employee-branch" className="w-full rounded-md border border-input bg-background p-2 text-sm" value={locationId} onChange={e=>setLocationId(e.target.value)} required><option value="">Choose branch</option>{locations.filter(l=>!l.is_central).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></FormField>
 <FormField label="Starting Password" htmlFor="employee-password" hint="At least 12 characters. Share the sign-in details directly with this user." required><Input id="employee-password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} maxLength={128} required/></FormField>
 </FormDialog>;
}
