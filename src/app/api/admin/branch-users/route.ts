import { POST as legacyCreate } from "@/server/modules/users/create-user";
import { createBusinessUser } from "@/server/modules/users/workspace-users";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
export function POST(request: Request) { return businessWorkspacesEnabled() ? createBusinessUser(request) : legacyCreate(request); }
export const runtime = "nodejs";
