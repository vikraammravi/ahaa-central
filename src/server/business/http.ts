import "server-only";
import { platformDeployment } from "@/lib/app-surface";

/** Business APIs enforce their deployment boundary independently of Proxy. */
export function businessEndpoint<Args extends unknown[]>(handler: (...args: Args) => Response | Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    if (platformDeployment()) return Response.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return handler(...args);
  };
}
