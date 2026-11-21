import { notFound, redirect } from "next/navigation";
import { platformSession, PlatformAccessError } from "@/server/platform/access";
import PlatformConsole from "@/features/platform/components/PlatformConsole";

export const dynamic = "force-dynamic";

function businessAppOrigin(): string | null {
  try {
    const url = new URL(process.env.BUSINESS_APP_ORIGIN || "");
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    const local = process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !local) return null;
    return url.origin;
  } catch { return null; }
}

export default async function SuperadminPage() {
  try { await platformSession(); }
  catch (error) {
    if (error instanceof PlatformAccessError && error.status === 401) redirect("/login?next=/superadmin");
    if (error instanceof PlatformAccessError) notFound();
    throw error;
  }
  return <PlatformConsole registrationEnabled={process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED === "true"} ownerAssignmentEnabled={process.env.PLATFORM_OWNER_ASSIGNMENT_ENABLED === "true"} invitationsEnabled={process.env.PLATFORM_OWNER_INVITATIONS_ENABLED === "true"} activationEnabled={process.env.PLATFORM_BUSINESS_ACTIVATION_ENABLED === "true"} businessAppOrigin={businessAppOrigin()} />;
}
