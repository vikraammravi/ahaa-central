import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
export function BackLink({href,children}:{href:string;children:React.ReactNode}){return <Button asChild variant="outline" size="sm"><Link href={href}><ChevronLeft className="size-4"/>{children}</Link></Button>;}
