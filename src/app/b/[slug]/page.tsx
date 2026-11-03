import { notFound } from "next/navigation";
import { businessEntrySlug, businessWorkspacesEnabled } from "@/features/workspaces/context";
import BusinessEntry from "@/features/workspaces/components/BusinessEntry";

export default async function BusinessEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!businessWorkspacesEnabled() || businessEntrySlug(`/b/${slug}`) !== slug) notFound();
  return <BusinessEntry slug={slug} />;
}
