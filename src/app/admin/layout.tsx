import { CurrentUserProvider } from "@/lib/useCurrentUser";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <CurrentUserProvider><AdminShell>{children}</AdminShell></CurrentUserProvider>;
}
