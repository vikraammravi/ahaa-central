import "server-only";
import { hasSameOrigin } from "@/lib/request-origin";
import { PlatformAccessError, platformSession } from "./access";

const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const known = error instanceof PlatformAccessError;
  return Response.json({ error: known ? error.message : "Unable to manage businesses. Please try again." }, { status: known ? error.status : 503, headers });
}
export async function listBusinesses() {
  try {
    const session = await platformSession();
    const { data, error } = await session.from("businesses").select("id,name,slug,status,isolation_ready,created_at").order("name").limit(100);
    if (error) throw error;
    return Response.json({ businesses: data }, { headers });
  } catch (error) { return failure(error); }
}
export async function createBusiness(request: Request) {
  try {
    if (!hasSameOrigin(request)) throw new PlatformAccessError("Request not allowed.", 403);
    const session = await platformSession();
    const raw = await request.text();
    if (raw.length > 4096) throw new PlatformAccessError("Business details are too large.", 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new PlatformAccessError("Invalid business details.", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new PlatformAccessError("Invalid business details.", 400);
    const values = input as Record<string, unknown>;
    const name = typeof values.name === "string" ? values.name.trim() : "";
    const slug = typeof values.slug === "string" ? values.slug.trim() : "";
    if (!name || name.length > 200 || slug.length < 2 || slug.length > 60 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new PlatformAccessError("Enter a business name and a lowercase address using letters, numbers and hyphens.", 400);
    const result = await session.rpc("platform_create_business", { p_name: name, p_slug: slug });
    if (result.error) {
      if (result.error.code === "23505") throw new PlatformAccessError("That business address is already in use.", 409);
      throw result.error;
    }
    return Response.json({ business: result.data }, { status: 201, headers });
  } catch (error) { return failure(error); }
}
