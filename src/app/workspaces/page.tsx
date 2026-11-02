import { notFound } from "next/navigation";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
import WorkspaceChooser from "@/features/workspaces/components/WorkspaceChooser";
export default function WorkspacesPage() {
  if (!businessWorkspacesEnabled()) notFound();
  return <WorkspaceChooser />;
}
