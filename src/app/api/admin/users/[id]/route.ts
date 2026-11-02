import { DELETE as legacyDelete } from "@/server/modules/users/delete-user";
import { removeBusinessUser, updateBusinessUser } from "@/server/modules/users/workspace-users";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
type Context = { params: Promise<{ id: string }> };
export function DELETE(request: Request, context: Context) { return businessWorkspacesEnabled() ? removeBusinessUser(request, context) : legacyDelete(request, context); }
export function PATCH(request: Request, context: Context) { return updateBusinessUser(request, context); }
export const runtime = "nodejs";
