import { CurrentUserProvider } from "@/lib/useCurrentUser";
import { BranchShell } from "@/components/branch/BranchShell";

export default function BranchLayout({ children }: LayoutProps<"/branch">) {
  return <CurrentUserProvider><BranchShell>{children}</BranchShell></CurrentUserProvider>;
}
