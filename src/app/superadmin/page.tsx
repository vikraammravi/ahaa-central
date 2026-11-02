import { notFound, redirect } from "next/navigation";
import { platformSession, PlatformAccessError } from "@/server/platform/access";
import PlatformConsole from "@/features/platform/components/PlatformConsole";

export const dynamic = "force-dynamic";

export default async function SuperadminPage() {
  try { await platformSession(); }
  catch (error) {
    if (error instanceof PlatformAccessError && error.status === 401) redirect("/login?next=/superadmin");
    if (error instanceof PlatformAccessError) notFound();
    throw error;
  }
  return <PlatformConsole registrationEnabled={process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED === "true"} />;
}
