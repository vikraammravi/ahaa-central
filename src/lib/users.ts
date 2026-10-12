import type { UserRole } from "./supabase/types";
export type BranchUserRole = Extract<UserRole,"BRANCH_MANAGER"|"BRANCH_EMPLOYEE">;
export const USER_ROLE_LABELS:Record<UserRole,string>={CENTRAL_ADMIN:"Central Admin",BRANCH_MANAGER:"Branch Manager",BRANCH_EMPLOYEE:"Branch Employee"};
export function isBranchUserRole(value:unknown):value is BranchUserRole{return value==="BRANCH_MANAGER"||value==="BRANCH_EMPLOYEE";}
