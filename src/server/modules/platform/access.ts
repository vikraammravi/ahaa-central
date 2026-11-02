import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";

export class PlatformAccessError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function platformSession() {
  if (process.env.PLATFORM_CONSOLE_ENABLED !== "true") throw new PlatformAccessError("Not found.", 404);
  // Platform authorization is independent of the selected customer and customer role.
  const session = await createSupabaseServer({ workspace: false });
  const { data: { user }, error } = await session.auth.getUser();
  if (!user || error) throw new PlatformAccessError("Sign in to continue.", 401);
  const permission = await session.rpc("platform_is_administrator");
  if (permission.error || permission.data !== true) throw new PlatformAccessError("Platform access is required.", 403);
  return session;
}
