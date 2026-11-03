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
  return <PlatformConsole registrationEnabled={process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED === "true"} ownerAssignmentEnabled={process.env.PLATFORM_OWNER_ASSIGNMENT_ENABLED === "true"} newOwnerEnabled={process.env.PLATFORM_NEW_OWNER_CREATION_ENABLED === "true"} />;
}
