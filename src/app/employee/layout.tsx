import { CurrentUserProvider } from "@/lib/useCurrentUser";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
export default function Layout({children}:{children:React.ReactNode}){return <CurrentUserProvider><EmployeeShell>{children}</EmployeeShell></CurrentUserProvider>;}
