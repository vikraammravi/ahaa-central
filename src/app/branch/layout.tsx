import { BranchShell } from "@/components/branch/BranchShell";

export default function BranchLayout({ children }: LayoutProps<"/branch">) {
  return <BranchShell>{children}</BranchShell>;
}
